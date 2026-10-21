/**
 * Empties the database except the admin accounts, and deletes every uploaded file (QRIS, payment proofs,
 * photos). The schema stays at the latest migration; order/invoice numbers start again from 1. Admins keep
 * their password but must sign in again.
 *
 * Irreversible, so it refuses to run unless the database host is typed back:
 *   npm run db:reset -- --confirm=<database host>                         (laptop, DATABASE_URL from .env)
 *   docker compose exec api node dist/db/reset.js --confirm=db             (local Docker stack)
 * Without --confirm it only shows what would be deleted. --only-admin=<email> keeps just that admin (e.g. to
 * drop test admins); by default every admin account is kept.
 */
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { pool } from '../config/database';

const KEEP_TABLES = ['spatial_ref_sys', 'schema_migrations', 'users'];
const SEQUENCES = ['order_number_seq', 'invoice_number_seq'];
const FOLDERS = ['qris', 'proofs', 'photos'];

const host = (() => {
  try {
    return new URL(env.DATABASE_URL).hostname;
  } catch {
    return '(unknown)';
  }
})();

async function counts() {
  const { rows } = await pool.query<{ users: number; admins: number; workshops: number; orders: number }>(
    `SELECT (SELECT COUNT(*)::int FROM users) AS users, (SELECT COUNT(*)::int FROM users WHERE role = 'ADMIN') AS admins,
            (SELECT COUNT(*)::int FROM workshops) AS workshops, (SELECT COUNT(*)::int FROM orders) AS orders`,
  );
  return rows[0];
}

async function resetDatabase(onlyAdmin: string | null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Snapshot the admins first, so they survive even if a cascade reaches the users table.
    const { rows: admins } = await client.query(`SELECT * FROM users WHERE role = 'ADMIN' AND ($1::text IS NULL OR email = $1)`, [onlyAdmin]);
    const { rows: tables } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT (tablename = ANY($1::text[]))`,
      [KEEP_TABLES],
    );
    if (tables.length) await client.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    await client.query(`DELETE FROM users WHERE id <> ALL($1::uuid[])`, [admins.map((a) => a.id)]);
    for (const seq of SEQUENCES) await client.query(`ALTER SEQUENCE IF EXISTS ${seq} RESTART WITH 1`);
    for (const a of admins) {
      const cols = Object.keys(a);
      await client.query(
        `INSERT INTO users (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (id) DO NOTHING`,
        cols.map((c) => a[c]),
      );
    }
    await client.query('COMMIT');
    return admins.length;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Deletes every stored upload; returns how many files were removed. */
async function resetStorage(): Promise<number> {
  if (env.STORAGE_DRIVER === 'supabase') {
    const base = `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object`;
    const headers = { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
    let removed = 0;
    for (const folder of FOLDERS) {
      for (;;) {
        const res = await fetch(`${base}/list/${env.SUPABASE_BUCKET}`, { method: 'POST', headers, body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0 }) });
        if (res.status === 400 || res.status === 404) break; // bucket or folder doesn't exist yet
        if (!res.ok) throw new Error(`Supabase list failed (${res.status})`);
        const names = ((await res.json()) as { name: string; id: string | null }[]).filter((o) => o.id).map((o) => `${folder}/${o.name}`);
        if (!names.length) break;
        const del = await fetch(`${base}/${env.SUPABASE_BUCKET}`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: names }) });
        if (!del.ok) throw new Error(`Supabase delete failed (${del.status})`);
        removed += names.length;
      }
    }
    return removed;
  }
  let removed = 0;
  for (const folder of FOLDERS) {
    const dir = path.resolve(env.UPLOAD_DIR, folder);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    for (const f of files) {
      await fs.rm(path.join(dir, f), { force: true });
      removed++;
    }
  }
  return removed;
}

async function main() {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) || null;
  const confirm = arg('confirm');
  const onlyAdmin = arg('only-admin')?.toLowerCase() ?? null;
  const before = await counts();
  console.log(`Database: ${host} · storage: ${env.STORAGE_DRIVER}`);
  console.log(`Now: ${before.users} accounts (${before.admins} admin), ${before.workshops} workshops, ${before.orders} orders`);
  if (before.admins === 0) throw new Error('No admin account found: refusing to reset (nobody could sign in afterwards). Run the seed first.');
  if (onlyAdmin) {
    const { rows } = await pool.query(`SELECT 1 FROM users WHERE role = 'ADMIN' AND email = $1`, [onlyAdmin]);
    if (!rows.length) throw new Error(`No admin account with email ${onlyAdmin}: refusing to reset.`);
  }
  const kept = onlyAdmin ? `the admin account ${onlyAdmin}` : `the ${before.admins} admin account(s)`;
  if (confirm !== host) {
    console.log(`\nNothing deleted. To delete everything except ${kept} and all uploaded files, run again with --confirm=${host}`);
    return;
  }
  const admins = await resetDatabase(onlyAdmin);
  const files = await resetStorage();
  const after = await counts();
  console.log(`Done: kept ${admins} admin account(s); ${after.users} accounts, ${after.workshops} workshops, ${after.orders} orders left; ${files} uploaded files deleted.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
