import type { UserRole } from '../common/utils/jwt';

declare global {
  namespace Express {
    interface Request {
      /** Authenticated principal populated by `authenticate` middleware. */
      user?: { id: string; role: UserRole };
      /** Zod-validated request input populated by `validate` middleware. */
      valid?: { body?: any; query?: any; params?: any };
    }
  }
}

export {};
