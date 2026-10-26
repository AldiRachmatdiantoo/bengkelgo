import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { accountLimiter, verificationLimiter } from '../../common/middlewares/rateLimiter';
import { imageUpload } from '../../common/middlewares/upload';
import { uuidParam, validate } from '../../common/middlewares/validate';
import { verifyEmailSchema } from '../auth/auth.schema';
import { accountController as c } from './account.controller';
import { changePasswordSchema, deleteAccountSchema, emailChangeSchema, updateProfileSchema } from './account.schema';

/**
 * "Akun saya", mounted at /auth/me (GET /auth/me itself stays in the auth routes). Under /auth so the browser
 * sends the session cookie, which tells which device is asking (kept signed in when others are signed out).
 */
const r = Router();
// Guest accounts (SOS without signing up) have no email or password: only their name and number.
const registered = authorize('CUSTOMER', 'WORKSHOP_OWNER', 'ADMIN');

r.use(authenticate);
r.patch('/', validate({ body: updateProfileSchema }), c.update);

r.get('/photo', registered, c.photo);
r.put('/photo', registered, imageUpload('photo', { maxSide: 512 }), c.setPhoto);
r.delete('/photo', registered, c.removePhoto);

r.put('/password', registered, accountLimiter, validate({ body: changePasswordSchema }), c.changePassword);

r.get('/email-change', registered, c.pendingEmailChange);
r.post('/email-change', registered, accountLimiter, validate({ body: emailChangeSchema }), c.requestEmailChange);
r.post('/email-change/confirm', registered, verificationLimiter, validate({ body: verifyEmailSchema }), c.confirmEmailChange);
r.delete('/email-change', registered, c.cancelEmailChange);

r.get('/sessions', c.sessions);
r.post('/sessions/revoke-others', c.revokeOtherSessions);
r.delete('/sessions/:id', validate({ params: uuidParam('id') }), c.revokeSession);

r.post('/delete', registered, accountLimiter, validate({ body: deleteAccountSchema }), c.deleteAccount);

export default r;
