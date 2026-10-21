import { env } from '../../config/env';
import type { Mail } from '../../config/mailer';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Verification-code email: table-based HTML with inline styles (email clients), plus plain text. */
export function verificationEmail(to: string, name: string, code: string, minutes: number): Mail {
  const first = name.split(' ')[0];
  const link = `${env.APP_URL.replace(/\/$/, '')}/verifikasi-email`;
  // The code stays out of the subject: subjects end up in server logs when a send fails.
  const subject = 'Kode verifikasi email BengkelGo';
  const text = [
    `Halo ${first},`,
    '',
    `Kode verifikasi email Anda: ${code}`,
    `Masukkan kode ini di BengkelGo dalam ${minutes} menit: ${link}`,
    '',
    'Abaikan email ini bila Anda tidak mendaftar di BengkelGo.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="id"><body style="margin:0;background:#F8F9FC;font-family:Arial,Helvetica,sans-serif;color:#192557">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FC;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden">
<tr><td style="background:#4361EE;padding:18px 24px;color:#FFFFFF;font-size:18px;font-weight:bold">BengkelGo</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px;font-size:15px">Halo ${esc(first)},</p>
<p style="margin:0 0 16px;font-size:14px;line-height:1.5">Masukkan kode ini untuk memverifikasi email Anda:</p>
<p style="margin:0 0 16px;text-align:center"><span style="display:inline-block;padding:12px 20px;border-radius:8px;background:#F0F3FF;font-size:30px;font-weight:bold;letter-spacing:8px;color:#192557">${esc(code)}</span></p>
<p style="margin:0 0 20px;font-size:13px;color:#5B6478">Kode berlaku ${minutes} menit.</p>
<p style="margin:0 0 20px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:#4361EE;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 20px;border-radius:8px">Buka halaman verifikasi</a></p>
<p style="margin:0;font-size:12px;color:#8A93A6">Abaikan email ini bila Anda tidak mendaftar di BengkelGo.</p>
</td></tr></table></td></tr></table>
</body></html>`;
  return { to, subject, text, html };
}
