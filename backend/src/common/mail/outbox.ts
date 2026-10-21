import { sendMail, type Mail } from '../../config/mailer';
import { logger } from '../../config/logger';
import { afterCommit, db, type Queryable } from '../db/transaction';

/**
 * Durable email queue (table email_outbox). An email is inserted in the same transaction as the action that
 * causes it, so it exists exactly when the action committed; delivery is tried right after the commit and,
 * on failure, again by the outbox job with growing delays. Nothing lives only in memory, so an API restart
 * never loses an email. Rows are claimed with SKIP LOCKED plus a short lease, so several replicas never send
 * the same email at once (a crash mid-send can at worst send it twice, never zero times).
 */

/** Wait before the next attempt, by number of failed attempts so far. */
export const RETRY_DELAYS_SECONDS = [15, 60, 5 * 60, 15 * 60, 60 * 60, 3 * 60 * 60];
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;
/** A claimed row becomes due again after this long if its sender died mid-send. */
const LEASE_SECONDS = 120;
const KEEP_DAYS = 30;

interface OutboxRow {
  id: string;
  to_address: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  context: Record<string, unknown> | null;
  attempts: number;
}

/** Queues an email inside the caller's transaction (or right away on the pool) and returns its id. */
export async function queueEmail(q: Queryable, mail: Mail, context?: Record<string, unknown>) {
  const { rows } = await q.query<{ id: string }>(
    `INSERT INTO email_outbox (to_address, subject, body_text, body_html, context) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [mail.to, mail.subject, mail.text, mail.html ?? null, context ?? null],
  );
  return rows[0].id;
}

/** Queues an email and tries to send it as soon as the caller's transaction commits. */
export async function queueEmailAfterCommit(tx: Queryable, mail: Mail, context?: Record<string, unknown>) {
  const id = await queueEmail(tx, mail, context);
  afterCommit(tx, () => deliverOne(id));
  return id;
}

const CLAIM = (where: string) => `
  UPDATE email_outbox SET attempts = attempts + 1, next_attempt_at = NOW() + make_interval(secs => ${LEASE_SECONDS})
  WHERE id IN (SELECT id FROM email_outbox WHERE status = 'PENDING' AND next_attempt_at <= NOW() AND ${where}
               ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED)
  RETURNING id, to_address, subject, body_text, body_html, context, attempts`;

async function send(row: OutboxRow): Promise<boolean> {
  try {
    await sendMail({ to: row.to_address, subject: row.subject, text: row.body_text, html: row.body_html ?? undefined });
    await db.query(`UPDATE email_outbox SET status = 'SENT', sent_at = NOW(), last_error = NULL WHERE id = $1`, [row.id]);
    return true;
  } catch (err) {
    const message = (err as Error).message?.slice(0, 500) ?? 'unknown error';
    const delay = RETRY_DELAYS_SECONDS[row.attempts - 1];
    if (delay === undefined || row.attempts >= MAX_ATTEMPTS) {
      await db.query(`UPDATE email_outbox SET status = 'FAILED', last_error = $2 WHERE id = $1`, [row.id, message]);
      logger.error({ err, outboxId: row.id, context: row.context, subject: row.subject }, 'Email failed after all retries');
    } else {
      await db.query(`UPDATE email_outbox SET last_error = $2, next_attempt_at = NOW() + make_interval(secs => $3) WHERE id = $1`, [row.id, message, delay]);
      logger.warn({ err, outboxId: row.id, context: row.context, attempt: row.attempts, retryInSeconds: delay }, 'Email failed; will retry');
    }
    return false;
  }
}

/** Sends one queued email now if it is still pending and due (another replica may already have it). */
export async function deliverOne(id: string): Promise<boolean | null> {
  const { rows } = await db.query<OutboxRow>(CLAIM('id = $2'), [1, id]);
  return rows[0] ? send(rows[0]) : null;
}

/** Outbox job: sends every due email (oldest first) and purges old sent/failed rows. */
export async function deliverDue(batchSize = 50): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (;;) {
    const { rows } = await db.query<OutboxRow>(CLAIM('TRUE'), [batchSize]);
    for (const row of rows) (await send(row)) ? sent++ : failed++;
    if (rows.length < batchSize) break;
  }
  await db.query(`DELETE FROM email_outbox WHERE status <> 'PENDING' AND created_at < NOW() - make_interval(days => $1)`, [KEEP_DAYS]);
  return { sent, failed };
}
