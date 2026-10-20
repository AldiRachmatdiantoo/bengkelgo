import { Pool, types } from 'pg';
import { env } from './env';
import { logger } from './logger';

// Return NUMERIC / BIGINT as JS numbers (amounts & counts in this app stay well within safe range).
types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));
// Keep DATE columns as 'YYYY-MM-DD' strings to avoid timezone shifts.
types.setTypeParser(types.builtins.DATE, (v) => v);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => logger.error({ err }, 'Unexpected PostgreSQL pool error'));

// Note: no session-level timezone is set. Queries that turn instants into local dates pass the business
// timezone explicitly (`AT TIME ZONE $n`), which also stays correct behind transaction-mode poolers
// (e.g. Supabase) where session settings don't persist between transactions.
