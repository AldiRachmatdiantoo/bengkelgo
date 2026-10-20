import nodemailer, { type Transporter } from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { env } from './env';
import { logger } from './logger';

let transporter: Transporter | null = null;

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * How email leaves the server:
 * - `gmail-api`: Gmail API over HTTPS (port 443), for hosts that block SMTP ports (e.g. Render Free);
 * - `smtp`: any SMTP server, e.g. Gmail + App Password on port 587;
 * - `log`: nothing is sent, the email is only logged (development).
 */
export const mailTransport: 'gmail-api' | 'smtp' | 'log' = env.GMAIL_REFRESH_TOKEN ? 'gmail-api' : env.SMTP_HOST ? 'smtp' : 'log';

export function describeMailTransport() {
  if (mailTransport === 'gmail-api') return `Gmail API as ${env.MAIL_FROM}`;
  if (mailTransport === 'smtp') return `SMTP: ${env.SMTP_HOST} as ${env.SMTP_USER}`;
  return 'Email not configured: emails are only logged';
}

export async function sendMail(mail: Mail): Promise<void> {
  if (mailTransport === 'log') {
    logger.info({ to: mail.to, subject: mail.subject }, '[mail:dev] email not configured, email logged only');
    return;
  }
  if (mailTransport === 'gmail-api') return gmail.send(mail);
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  await transporter.sendMail({ from: env.MAIL_FROM, ...mail });
}

/**
 * Gmail API (users.messages.send) authorised by a long-lived OAuth refresh token for the sending account
 * (scope gmail.send). Access tokens last about an hour and are refreshed on demand.
 */
const gmail = {
  token: null as { value: string; expiresAt: number } | null,

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        refresh_token: env.GMAIL_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !body.access_token) throw new Error(`Gmail token refresh failed (${res.status} ${body.error ?? ''})`.trim());
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return this.token.value;
  },

  async send(mail: Mail) {
    const raw = await new MailComposer({ from: env.MAIL_FROM, ...mail }).compile().build();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: raw.toString('base64url') }),
    });
    if (res.status === 401) this.token = null; // revoked or expired early: refresh on the next attempt
    if (!res.ok) throw new Error(`Gmail API send failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  },
};
