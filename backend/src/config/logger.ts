import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.isTest ? 'silent' : env.isProd ? 'info' : 'debug'),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.refresh_token'],
    censor: '[REDACTED]',
  },
});
