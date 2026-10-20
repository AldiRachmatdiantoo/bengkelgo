import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { pool } from './config/database';
import { closeRedis, getRedis } from './config/redis';
import { runMigrations } from './db/migrate';
import { startScheduler, stopScheduler } from './jobs/scheduler';

async function main() {
  if (process.env.RUN_MIGRATIONS_ON_BOOT === 'true') await runMigrations((m) => logger.info(m));

  // Connect Redis before accepting traffic so the first requests are limited by the shared store.
  const redis = getRedis();
  if (redis && redis.status !== 'ready') {
    await new Promise<void>((resolve) => {
      redis.once('ready', resolve);
      setTimeout(resolve, 5_000).unref(); // don't block boot forever; limiter falls back to memory
    });
  }

  const server = createApp().listen(env.PORT, () => logger.info(`API listening on :${env.PORT}${env.API_PREFIX}`));
  startScheduler();

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopScheduler();
    server.close(async () => {
      await Promise.allSettled([pool.end(), closeRedis()]);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start');
  process.exit(1);
});
