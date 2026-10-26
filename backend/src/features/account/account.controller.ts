import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import { sendStored } from '../../common/utils/storage';
import { REFRESH_COOKIE } from '../auth/auth.controller';
import type { ChangePasswordInput, DeleteAccountInput, EmailChangeInput, UpdateProfileInput } from './account.schema';
import { accountService as s } from './account.service';

const uid = (req: Request) => currentUser(req).id;
/** The device's own session, to keep it signed in (cookie in browsers, body for other clients). */
const refreshToken = (req: Request): string | undefined => req.cookies?.[REFRESH_COOKIE] ?? (typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : undefined);

export const accountController = {
  async update(req: Request, res: Response) {
    ok(res, { user: await s.updateProfile(uid(req), input<UpdateProfileInput>(req).body) });
  },

  async setPhoto(req: Request, res: Response) {
    ok(res, { user: await s.setPhoto(uid(req), req.file!) });
  },

  async removePhoto(req: Request, res: Response) {
    ok(res, { user: await s.removePhoto(uid(req)) });
  },

  async photo(req: Request, res: Response) {
    const key = await s.photoFile(uid(req));
    // Only the owner of the account may see it; the URL changes with every new photo.
    res.setHeader('Cache-Control', 'private, max-age=86400');
    await sendStored(res, key);
  },

  async changePassword(req: Request, res: Response) {
    ok(res, await s.changePassword(uid(req), input<ChangePasswordInput>(req).body, refreshToken(req)));
  },

  async pendingEmailChange(req: Request, res: Response) {
    ok(res, await s.pendingEmailChange(uid(req)));
  },

  async requestEmailChange(req: Request, res: Response) {
    ok(res, await s.requestEmailChange(uid(req), input<EmailChangeInput>(req).body));
  },

  async confirmEmailChange(req: Request, res: Response) {
    ok(res, { user: await s.confirmEmailChange(uid(req), input<{ code: string }>(req).body.code) });
  },

  async cancelEmailChange(req: Request, res: Response) {
    ok(res, await s.cancelEmailChange(uid(req)));
  },

  async sessions(req: Request, res: Response) {
    ok(res, await s.sessions(uid(req), refreshToken(req)));
  },

  async revokeSession(req: Request, res: Response) {
    ok(res, await s.revokeSession(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
  },

  async revokeOtherSessions(req: Request, res: Response) {
    ok(res, await s.revokeOtherSessions(uid(req), refreshToken(req)));
  },

  async deleteAccount(req: Request, res: Response) {
    ok(res, await s.deleteAccount(uid(req), input<DeleteAccountInput>(req).body));
  },
};
