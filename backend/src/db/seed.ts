import { pool } from '../config/database';
import { hashPassword } from '../common/utils/crypto';

/** Creates (or updates the password of) the initial platform admin from SEED_ADMIN_* env vars. */
async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 12 chars) are required');
  }
  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Platform Admin', $1, $2, 'ADMIN')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'ADMIN', updated_at = NOW()`,
    [email, hash],
  );
  console.log(`Admin account ready: ${email}`);
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
