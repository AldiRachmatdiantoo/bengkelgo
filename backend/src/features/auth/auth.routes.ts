import { Router } from 'express';
import { authenticate } from '../../common/middlewares/auth';
import { authLimiter, loginAccountLimiter, passwordResetAccountLimiter, verificationLimiter } from '../../common/middlewares/rateLimiter';
import { validate } from '../../common/middlewares/validate';
import { authController as c } from './auth.controller';
import { forgotPasswordSchema, googleSchema, guestSchema, loginSchema, refreshSchema, registerCustomerSchema, registerWorkshopSchema, resetPasswordSchema, verifyEmailSchema } from './auth.schema';

const r = Router();

r.post('/register/customer', authLimiter, validate({ body: registerCustomerSchema }), c.registerCustomer);
r.post('/register/workshop', authLimiter, validate({ body: registerWorkshopSchema }), c.registerWorkshop);
r.post('/login', authLimiter, validate({ body: loginSchema }), loginAccountLimiter, c.login);
r.post('/google', authLimiter, validate({ body: googleSchema }), c.google);
r.post('/guest', authLimiter, validate({ body: guestSchema }), c.guest);
r.post('/refresh', validate({ body: refreshSchema }), c.refresh);
r.post('/logout', validate({ body: refreshSchema }), c.logout);
r.get('/me', authenticate, c.me);
// Forgot password: capped per IP and per email (so nobody can flood someone's inbox).
r.post('/password/forgot', authLimiter, validate({ body: forgotPasswordSchema }), passwordResetAccountLimiter, c.forgotPassword);
r.post('/password/reset', authLimiter, validate({ body: resetPasswordSchema }), c.resetPassword);
// Per account: code guesses and resends (the code itself also allows only 5 wrong guesses).
r.post('/email/verify', authenticate, verificationLimiter, validate({ body: verifyEmailSchema }), c.verifyEmail);
r.post('/email/resend', authenticate, verificationLimiter, c.resendVerification);

export default r;
