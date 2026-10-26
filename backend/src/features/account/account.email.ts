import { env } from '../../config/env';
import type { Mail } from '../../config/mailer';
import { renderEmail } from '../../common/mail/layout';

const appUrl = (path: string) => `${env.APP_URL.replace(/\/$/, '')}${path}`;
const now = () => new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short', timeZone: env.CRON_TIMEZONE }).format(new Date()) + ' WIB';

/** "an***@gmail.com": enough for the owner to recognise, not enough to read the address. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
}

/** Code for a change of email, sent to the NEW address (proves the person can read it). */
export function emailChangeCodeEmail(to: string, name: string, code: string, minutes: number): Mail {
  return {
    to,
    ...renderEmail({
      // The code stays out of the subject: subjects end up in server logs when a send fails.
      subject: 'Kode untuk mengganti email BengkelGo',
      tag: 'Ganti email',
      preheader: `Masukkan kode ini di halaman Akun Saya dalam ${minutes} menit.`,
      name,
      intro: 'Anda meminta mengganti email akun BengkelGo ke alamat ini. Masukkan kode di bawah pada halaman Akun Saya.',
      highlight: { label: 'Kode verifikasi', title: code, subtitle: `Berlaku ${minutes} menit` },
      rows: [['Email baru', to]],
      button: { text: 'Buka Akun Saya', url: appUrl('/akun') },
      tips: ['Bukan Anda yang meminta? Abaikan email ini; email akun tidak akan berubah tanpa kode ini.'],
      footer: 'Email ini dikirim otomatis karena ada permintaan ganti email untuk akun BengkelGo. Mohon tidak membalas email ini.',
    }),
  };
}

/** Sent to the OLD address once the change went through, so a takeover does not go unnoticed. */
export function emailChangedEmail(to: string, name: string, newEmail: string): Mail {
  return {
    to,
    ...renderEmail({
      subject: 'Email akun BengkelGo Anda sudah diganti',
      tag: 'Keamanan akun',
      preheader: 'Email akun BengkelGo Anda baru saja diganti.',
      name,
      intro: 'Email akun BengkelGo Anda baru saja diganti. Mulai sekarang masuk dan semua pemberitahuan memakai email baru.',
      rows: [
        ['Email baru', maskEmail(newEmail)],
        ['Waktu', now()],
      ],
      button: { text: 'Masuk ke BengkelGo', url: appUrl('/login') },
      tips: ['Bukan Anda yang mengganti? Segera hubungi admin BengkelGo agar akun bisa diamankan.'],
      footer: 'Email ini dikirim otomatis untuk menjaga keamanan akun Anda. Mohon tidak membalas email ini.',
    }),
  };
}

/** Confirmation after a customer deleted the account (sent to the address it had). */
export function accountDeletedEmail(to: string, name: string): Mail {
  return {
    to,
    ...renderEmail({
      subject: 'Akun BengkelGo Anda sudah dihapus',
      tag: 'Akun dihapus',
      preheader: 'Data pribadi Anda sudah dihapus dari BengkelGo.',
      name,
      intro:
        'Sesuai permintaan Anda, akun BengkelGo sudah dihapus. Nama, email, nomor WhatsApp, foto, password, dan kendaraan tersimpan sudah dihapus. Riwayat pesanan tetap disimpan tanpa data diri Anda untuk catatan bengkel.',
      rows: [['Waktu', now()]],
      button: { text: 'Kunjungi BengkelGo', url: appUrl('/') },
      tips: ['Anda bisa mendaftar lagi kapan saja dengan email yang sama.', 'Bukan Anda yang menghapus? Hubungi admin BengkelGo.'],
      footer: 'Email ini dikirim otomatis sebagai bukti penghapusan akun. Mohon tidak membalas email ini.',
    }),
  };
}
