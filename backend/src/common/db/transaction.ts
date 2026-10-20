import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from '../../config/database';
import { logger } from '../../config/logger';

/** Anything that can run a parameterised query: the pool or a client inside a transaction. */
export interface Queryable {
  query<R extends QueryResultRow = any>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }>;
}

export type TxClient = PoolClient;

/** Side effects (e.g. emails) registered by a transaction, run only once it has committed. */
const afterCommitTasks = new WeakMap<object, (() => Promise<unknown>)[]>();

/**
 * Runs `task` after the surrounding transaction commits (never on rollback), without delaying the caller;
 * failures are only logged. Outside a transaction it runs right away.
 */
export function afterCommit(q: Queryable, task: () => Promise<unknown>) {
  const tasks = afterCommitTasks.get(q);
  if (tasks) tasks.push(task);
  else runDetached([task]);
}

function runDetached(tasks: (() => Promise<unknown>)[]) {
  for (const task of tasks) {
    Promise.resolve()
      .then(task)
      .catch((err) => logger.error({ err }, 'After-commit task failed'));
  }
}

/**
 * Transaction Manager (PRD core principle #2).
 * Runs `work` inside BEGIN ... COMMIT; any thrown error triggers ROLLBACK so no partial
 * insert/update (orphaned rows) survives. The client is always released back to the pool.
 */
export async function withTransaction<T>(
  work: (tx: TxClient) => Promise<T>,
  options: { isolation?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' } = {},
): Promise<T> {
  const client = await pool.connect();
  const tasks: (() => Promise<unknown>)[] = [];
  afterCommitTasks.set(client, tasks);
  try {
    await client.query(options.isolation ? `BEGIN ISOLATION LEVEL ${options.isolation}` : 'BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    runDetached(tasks);
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    afterCommitTasks.delete(client);
    client.release();
  }
}

export const db: Queryable = pool;
