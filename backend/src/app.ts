import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { pool } from './config/database';
import { errorHandler, notFoundHandler } from './common/middlewares/errorHandler';
import { globalLimiter } from './common/middlewares/rateLimiter';
import routes from './routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind NGINX / Cloudflare: trust N proxy hops so req.ip is the real client (rate limiting).
  app.set('trust proxy', env.TRUST_PROXY);

  // Security headers (PRD 6.1): CSP, HSTS, X-Frame-Options, X-Content-Type-Options, ...
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], imgSrc: ["'self'"], frameAncestors: ["'none'"] } },
      hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
      frameguard: { action: 'deny' },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  if (!env.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unreachable' });
    }
  });

  app.use(env.API_PREFIX, globalLimiter, routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
