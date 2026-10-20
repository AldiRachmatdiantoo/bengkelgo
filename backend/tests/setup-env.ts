import os from 'os';
import path from 'path';

// Deterministic, isolated configuration for every test run (loaded before any src module).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://unused:unused@127.0.0.1:1/unused';
process.env.DATABASE_POOL_MAX = '20';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? '';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-long-enough-123456';
process.env.ENABLE_CRON = 'false';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'bengkel-test-uploads');
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5173/auth/google/callback';
// Never send real email from tests, even when backend/.env has SMTP set (dotenv does not override these).
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.GMAIL_REFRESH_TOKEN = '';
process.env.STORAGE_DRIVER = 'local';
