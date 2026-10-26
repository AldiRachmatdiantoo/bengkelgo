import type { Queryable } from '../../common/db/transaction';

export interface SessionRow {
  family_id: string;
  user_agent: string | null;
  /** When the session last renewed itself (about every 15 minutes while the app is open). */
  last_active: Date;
  signed_in: Date;
}

export interface EmailChangeRow {
  new_email: string;
  code_hash: string;
  expires_at: Date;
  attempts: number;
  sent_at: Date;
}

/** Order states that are finished; anything else still involves a workshop. */
const FINISHED = ['COMPLETED', 'CANCELLED', 'UNASSIGNED'];

export const accountRepository = {
  async updateProfile(q: Queryable, userId: string, p: { name?: string; phone?: string }) {
    await q.query(`UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), updated_at = NOW() WHERE id = $1`, [
      userId,
      p.name ?? null,
      p.phone ?? null,
    ]);
  },

  /** Sets (or clears) the profile photo; returns the previous file so it can be deleted. */
  async setPhoto(q: Queryable, userId: string, key: string | null) {
    const { rows } = await q.query<{ old: string | null }>(
      `UPDATE users u SET photo_path = $2, updated_at = NOW()
       FROM (SELECT id, photo_path FROM users WHERE id = $1 FOR UPDATE) old
       WHERE u.id = old.id RETURNING old.photo_path AS old`,
      [userId, key],
    );
    return rows[0] ?? null;
  },

  /** New password; a reset link still out there stops working. */
  async setPassword(q: Queryable, userId: string, passwordHash: string) {
    await q.query('UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1', [userId, passwordHash]);
    await q.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
  },

  // ---------- sessions (one per refresh-token family = one signed-in device) ----------
  async familyOfToken(q: Queryable, userId: string, tokenHash: string) {
    const { rows } = await q.query<{ family_id: string }>('SELECT family_id FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2', [tokenHash, userId]);
    return rows[0]?.family_id ?? null;
  },

  async activeSessions(q: Queryable, userId: string) {
    const { rows } = await q.query<SessionRow>(
      `SELECT DISTINCT ON (r.family_id) r.family_id, r.user_agent, r.created_at AS last_active,
              (SELECT MIN(f.created_at) FROM refresh_tokens f WHERE f.family_id = r.family_id) AS signed_in
       FROM refresh_tokens r
       WHERE r.user_id = $1 AND r.revoked_at IS NULL AND r.expires_at > NOW()
       ORDER BY r.family_id, r.created_at DESC`,
      [userId],
    );
    return rows.sort((a, b) => b.last_active.getTime() - a.last_active.getTime());
  },

  /** Signs one device out; false when it was not signed in (or is someone else's). */
  async revokeFamily(q: Queryable, userId: string, familyId: string) {
    const r = await q.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND family_id = $2 AND revoked_at IS NULL', [userId, familyId]);
    return (r.rowCount ?? 0) > 0;
  },

  /** Signs every device out except `keepFamily` (all of them when it is null); returns how many devices. */
  async revokeOtherFamilies(q: Queryable, userId: string, keepFamily: string | null) {
    const { rows } = await q.query<{ family_id: string }>(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR family_id <> $2::uuid)
       RETURNING family_id`,
      [userId, keepFamily],
    );
    return new Set(rows.map((r) => r.family_id)).size;
  },

  // ---------- change of email ----------
  async emailTaken(q: Queryable, email: string, exceptUserId: string) {
    const { rows } = await q.query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [email, exceptUserId]);
    return rows.length > 0;
  },

  /** Stores a new pending change (replacing any earlier one) with a fresh code, expiry and attempt counter. */
  async saveEmailChange(q: Queryable, userId: string, newEmail: string, codeHash: string, ttlMinutes: number) {
    await q.query(
      `INSERT INTO email_changes (user_id, new_email, code_hash, expires_at, attempts, sent_at)
       VALUES ($1, $2, $3, NOW() + make_interval(mins => $4), 0, NOW())
       ON CONFLICT (user_id) DO UPDATE SET new_email = EXCLUDED.new_email, code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = NOW()`,
      [userId, newEmail, codeHash, ttlMinutes],
    );
  },

  async findEmailChange(q: Queryable, userId: string, forUpdate = false) {
    const { rows } = await q.query<EmailChangeRow>(
      `SELECT new_email, code_hash, expires_at, attempts, sent_at FROM email_changes WHERE user_id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
      [userId],
    );
    return rows[0] ?? null;
  },

  async countEmailChangeAttempt(q: Queryable, userId: string) {
    await q.query('UPDATE email_changes SET attempts = attempts + 1 WHERE user_id = $1', [userId]);
  },

  async deleteEmailChange(q: Queryable, userId: string) {
    await q.query('DELETE FROM email_changes WHERE user_id = $1', [userId]);
  },

  /** The new address is proven (the code reached it); codes and links sent to the old one stop working. */
  async applyEmail(q: Queryable, userId: string, newEmail: string) {
    await q.query('UPDATE users SET email = $2, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1', [userId, newEmail]);
    await q.query('DELETE FROM email_changes WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
  },

  // ---------- account deletion ----------
  async countUnfinishedOrders(q: Queryable, userId: string) {
    const { rows } = await q.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM orders WHERE customer_id = $1 AND status <> ALL($2::order_status[])`, [
      userId,
      FINISHED,
    ]);
    return rows[0].n;
  },

  /**
   * Removes the personal data and closes the account. The row stays (orders and reviews point to it, the
   * workshop keeps its records) but holds nothing that identifies the person; the email is free again.
   */
  async anonymise(q: Queryable, userId: string) {
    await q.query(
      `UPDATE users SET name = 'Pengguna dihapus', email = NULL, phone = NULL, password_hash = NULL, google_sub = NULL,
         photo_path = NULL, last_location = NULL, email_verified_at = NULL, is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [userId],
    );
    // Vehicles stay linked to past orders (brand/model), but without the plate number.
    await q.query('UPDATE vehicles SET plate = NULL, deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW() WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM email_verifications WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM email_changes WHERE user_id = $1', [userId]);
    await q.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
    await q.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  },
};
