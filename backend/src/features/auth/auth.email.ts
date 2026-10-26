import { env } from '../../config/env';
import type { Mail } from '../../config/mailer';
import { renderEmail } from '../../common/mail/layout';

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

const appUrl = (path: string) => `${env.APP_URL.replace(/\/$/, '')}${path}`;

/** "Buat password baru" link (single use, expires after `minutes`). */
export function passwordResetEmail(to: string, name: string, token: string, minutes: number): Mail {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return {
    to,
    ...renderEmail({
      subject: 'Buat password baru BengkelGo',
      tag: 'Lupa password',
      preheader: `Tautan untuk membuat password baru, berlaku ${minutes} menit.`,
      name,
      intro: 'Kami menerima permintaan untuk membuat password baru akun BengkelGo Anda. Tekan tombol di bawah untuk melanjutkan.',
      rows: [['Berlaku', `${minutes} menit, hanya bisa dipakai sekali`]],
      button: { text: 'Buat password baru', url: link },
      tips: [
        'Bukan Anda yang meminta? Abaikan email ini; password Anda tidak berubah.',
        'Jangan teruskan email ini ke siapa pun.',
      ],
      footer: 'Email ini dikirim otomatis karena ada permintaan lupa password untuk akun BengkelGo Anda. Mohon tidak membalas email ini.',
    }),
  };
}

/**
 * Sent after the password changed: through a reset link (every device signed out), on the "Akun saya" page
 * (the other devices signed out), or set for the first time by an account made with Google.
 */
export function passwordChangedEmail(to: string, name: string, how: 'reset' | 'changed' | 'created' = 'reset'): Mail {
  const created = how === 'created';
  const devices = how === 'reset' ? 'Semua perangkat yang sebelumnya masuk sudah dikeluarkan.' : 'Perangkat lain yang sedang masuk sudah dikeluarkan.';
  return {
    to,
    ...renderEmail({
      subject: created ? 'Password BengkelGo Anda sudah dibuat' : 'Password BengkelGo Anda sudah diganti',
      tag: 'Keamanan akun',
      preheader: created ? 'Akun BengkelGo Anda kini juga bisa masuk dengan email dan password.' : 'Password akun BengkelGo Anda baru saja diganti.',
      name,
      intro: created
        ? `Akun BengkelGo Anda kini punya password, jadi bisa masuk dengan email dan password selain lewat Google. ${devices}`
        : `Password akun BengkelGo Anda baru saja diganti. ${devices}`,
      rows: [['Waktu', new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: env.CRON_TIMEZONE }).format(new Date()) + ' WIB']],
      button: { text: 'Masuk ke BengkelGo', url: appUrl('/login') },
      tips: ['Bukan Anda yang mengganti? Segera buat password baru lewat "Lupa password?" di halaman masuk.'],
      footer: 'Email ini dikirim otomatis untuk menjaga keamanan akun Anda. Mohon tidak membalas email ini.',
    }),
  };
}
