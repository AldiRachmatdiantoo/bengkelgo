import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { input } from '../../common/middlewares/validate';
import { currentUser } from '../../common/middlewares/auth';
import { AppError } from '../../common/errors/AppError';
import { ok } from '../../common/utils/http';
import { authService, type AuthResult } from './auth.service';
import type { GoogleInput, GuestInput, LoginInput, RegisterCustomerInput, RegisterWorkshopInput, VerifyEmailInput } from './auth.schema';

export const REFRESH_COOKIE = 'bengkel_rt';

const cookieOptions = (): CookieOptions => ({
  httpOnly: true, // not readable by JS -> mitigates token theft via XSS
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  path: `${env.API_PREFIX}/auth`,
});

/** Refresh token travels in an httpOnly cookie; it is also returned in the body for non-browser clients. */
function send(res: Response, r: AuthResult, status = 200, extra: Record<string, unknown> = {}) {
  res.cookie(REFRESH_COOKIE, r.refreshToken, { ...cookieOptions(), expires: r.refreshExpiresAt });
  return ok(
    res,
    { user: r.user, access_token: r.accessToken, token_type: 'Bearer', refresh_token: r.refreshToken, refresh_expires_at: r.refreshExpiresAt, ...extra },
    status,
  );
}

const ua = (req: Request) => req.get('user-agent') ?? undefined;
const refreshFrom = (req: Request): string | undefined => req.cookies?.[REFRESH_COOKIE] ?? req.valid?.body?.refresh_token;

export const authController = {
  async registerCustomer(req: Request, res: Response) {
    send(res, await authService.registerCustomer(input<RegisterCustomerInput>(req).body, ua(req)), 201);
  },

  async registerWorkshop(req: Request, res: Response) {
    const r = await authService.registerWorkshop(input<RegisterWorkshopInput>(req).body, ua(req));
    send(res, r, 201, { workshop: r.workshop });
  },

  async login(req: Request, res: Response) {
    send(res, await authService.login(input<LoginInput>(req).body, ua(req)));
  },

  async google(req: Request, res: Response) {
    const r = await authService.google(input<GoogleInput>(req).body, ua(req));
    send(res, r, r.isNewUser ? 201 : 200, { is_new_user: r.isNewUser });
  },

  async guest(req: Request, res: Response) {
    send(res, await authService.guest(input<GuestInput>(req).body, ua(req)), 201);
  },

  async refresh(req: Request, res: Response) {
    const token = refreshFrom(req);
    if (!token) throw AppError.unauthorized('Refresh token missing', 'TOKEN_MISSING');
    try {
      send(res, await authService.refresh(token, ua(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    await authService.logout(refreshFrom(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    ok(res, { logged_out: true });
  },

  async verifyEmail(req: Request, res: Response) {
    ok(res, { user: await authService.verifyEmail(currentUser(req).id, input<VerifyEmailInput>(req).body.code) });
  },

  async resendVerification(req: Request, res: Response) {
    ok(res, await authService.resendVerification(currentUser(req).id));
  },

  async me(req: Request, res: Response) {
    ok(res, await authService.me(currentUser(req).id));
  },
};
