import type { Queryable } from './transaction';

export type ActorRole = 'CUSTOMER' | 'GUEST' | 'WORKSHOP_OWNER' | 'ADMIN' | 'SYSTEM';
export interface Actor {
  id: string | null;
  role: ActorRole;
}

export const SYSTEM: Actor = { id: null, role: 'SYSTEM' };

/**
 * Tags the current transaction with who is acting, so the status-history triggers (migration 004)
 * record the actor. Transaction-local: it disappears on COMMIT/ROLLBACK and never leaks to pooled connections.
 */
export async function setActor(tx: Queryable, actor: Actor) {
  await tx.query(`SELECT set_config('app.actor_id', $1, true), set_config('app.actor_role', $2, true)`, [actor.id ?? '', actor.role]);
}

/** Append-only audit trail of important actions (approvals, payments, refunds, cancellations, ...). */
export async function audit(
  q: Queryable,
  actor: Actor,
  entry: { action: string; entity: string; entityId?: string | null; details?: Record<string, unknown> },
) {
  await q.query(
    `INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor.id, actor.role, entry.action, entry.entity, entry.entityId ?? null, JSON.stringify(entry.details ?? {})],
  );
}
