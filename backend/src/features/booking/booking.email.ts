/**
 * Booking emails to the customer: confirmation, waitlist, promoted from the waitlist, rescheduled, and the
 * day-before / ~2-hours-before reminders. Email clients ignore <style> blocks and modern CSS, so the HTML is
 * table-based with inline styles; every dynamic value is escaped.
 */
import { env } from '../../config/env';
import { sendMail, type Mail } from '../../config/mailer';
import { logger } from '../../config/logger';
import { afterCommit, type Queryable } from '../../common/db/transaction';

export interface BookingEmailData {
  order_id: string;
  order_number: string;
  booking_date: string; // YYYY-MM-DD
  time_slot: string; // HH:mm
  queue_number: number;
  customer_name: string;
  workshop_name: string;
  workshop_address: string;
  workshop_phone: string | null;
  workshop_lat: number | null;
  workshop_lng: number | null;
  service_name: string;
}

export type BookingEmailKind = 'confirmed' | 'waitlist' | 'promoted' | 'rescheduled' | 'tomorrow' | 'soon';

/** SELECT list for BookingEmailData + customer_email; expects aliases c (booking_details or rows like it), o, u (customer), w, s. */
export const BOOKING_EMAIL_COLUMNS = `
  c.order_id, o.order_number, to_char(c.booking_date, 'YYYY-MM-DD') AS booking_date,
  to_char(c.time_slot, 'HH24:MI') AS time_slot, c.queue_number,
  u.name AS customer_name, u.email AS customer_email,
  w.name AS workshop_name, w.address AS workshop_address, w.phone AS workshop_phone,
  ST_Y(w.location::geometry) AS workshop_lat, ST_X(w.location::geometry) AS workshop_lng, s.name AS service_name`;

const BRAND = '#4361EE';
const NAVY = '#192557';
const MUTED = '#5F6784';
const LINE = '#E3E7F1';
const SOFT = '#F0F3FF';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "Rabu, 21 Oktober 2026" (calendar date, timezone-independent). */
export function longDateId(isoDate: string) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const ARRIVAL_TIPS = ['Datang sekitar 10 menit sebelum jadwal.', 'Sebutkan nomor pesanan atau tunjukkan QR di halaman pesanan saat tiba.'];
const CHANGE_TIP = 'Berhalangan hadir? Ganti jadwal atau batalkan lewat halaman pesanan agar slot bisa dipakai pelanggan lain.';
const REMINDER_NOTE = 'Kami akan mengingatkan Anda lewat email sehari sebelumnya dan sekitar 2 jam sebelum jadwal.';

/** Wording per kind; `day` is the long date, `extra.waitlistPosition` only for the waitlist. */
function copyFor(kind: BookingEmailKind, r: BookingEmailData, day: string, extra: { waitlistPosition?: number | null }) {
  const when = `${day} pukul ${r.time_slot} WIB`;
  switch (kind) {
    case 'confirmed':
      return {
        subject: `Booking terkonfirmasi: ${r.service_name}, ${when}`,
        tag: 'Booking terkonfirmasi',
        label: 'Jadwal servis',
        preheader: `${r.service_name} di ${r.workshop_name}, ${when}. Nomor antrean ${r.queue_number}.`,
        intro: 'Terima kasih, booking Anda sudah kami terima dan terkonfirmasi. Simpan email ini sebagai bukti booking.',
        tips: [...ARRIVAL_TIPS, REMINDER_NOTE, CHANGE_TIP],
      };
    case 'waitlist':
      return {
        subject: `Booking masuk daftar tunggu: ${when}`,
        tag: 'Daftar tunggu',
        label: 'Jadwal yang dipilih',
        preheader: `Slot ${when} sedang penuh. Kami kabari begitu booking Anda terkonfirmasi.`,
        intro:
          `Slot yang Anda pilih sedang penuh, jadi booking Anda masuk daftar tunggu` +
          (extra.waitlistPosition ? ` (posisi ${extra.waitlistPosition}).` : '.') +
          ' Kami akan mengirim email lagi begitu booking Anda terkonfirmasi.',
        tips: ['Tidak ingin menunggu? Pilih jadwal lain lewat halaman pesanan.', 'Booking di daftar tunggu belum menjamin slot sampai terkonfirmasi.'],
      };
    case 'promoted':
      return {
        subject: `Kabar baik: booking Anda terkonfirmasi, ${when}`,
        tag: 'Booking terkonfirmasi',
        label: 'Jadwal servis',
        preheader: `Ada slot kosong, booking Anda di ${r.workshop_name} kini terkonfirmasi.`,
        intro: 'Kabar baik! Ada slot yang kosong, jadi booking Anda dari daftar tunggu kini terkonfirmasi.',
        tips: [...ARRIVAL_TIPS, CHANGE_TIP],
      };
    case 'rescheduled':
      return {
        subject: `Jadwal booking diubah: ${when}`,
        tag: 'Jadwal diubah',
        label: 'Jadwal baru',
        preheader: `Jadwal baru Anda di ${r.workshop_name}: ${when}.`,
        intro: 'Jadwal booking Anda sudah diubah. Berikut rincian jadwal yang baru.',
        tips: [...ARRIVAL_TIPS, REMINDER_NOTE],
      };
    case 'tomorrow':
      return {
        subject: `Pengingat: servis besok, ${when}`,
        tag: 'Pengingat servis',
        label: 'Besok',
        preheader: `${r.service_name} di ${r.workshop_name}, ${when}.`,
        intro: 'Kami ingin mengingatkan jadwal servis kendaraan Anda besok. Berikut rincian booking Anda.',
        tips: [...ARRIVAL_TIPS, CHANGE_TIP],
      };
    case 'soon':
      return {
        subject: `Servis Anda hari ini pukul ${r.time_slot} WIB di ${r.workshop_name}`,
        tag: 'Pengingat servis hari ini',
        label: 'Hari ini',
        preheader: `Sampai jumpa pukul ${r.time_slot} di ${r.workshop_name}. Nomor antrean ${r.queue_number}.`,
        intro: 'Jadwal servis Anda tinggal sebentar lagi. Berikut rinciannya agar Anda bisa berangkat tepat waktu.',
        tips: ['Berangkat lebih awal agar tiba sekitar 10 menit sebelum jadwal.', ARRIVAL_TIPS[1]],
      };
  }
}

export function renderBookingEmail(kind: BookingEmailKind, r: BookingEmailData, extra: { waitlistPosition?: number | null } = {}) {
  const day = longDateId(r.booking_date);
  const orderUrl = `${env.APP_URL.replace(/\/$/, '')}/orders/${r.order_id}`;
  const mapsUrl =
    r.workshop_lat != null && r.workshop_lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${r.workshop_lat},${r.workshop_lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.workshop_address)}`;
  const { subject, tag, label, preheader, intro, tips } = copyFor(kind, r, day, extra);

  const rows: [string, string][] = [
    ['Bengkel', r.workshop_name],
    ['Alamat', r.workshop_address],
    ['Layanan', r.service_name],
    ['Nomor antrean', String(r.queue_number)],
    ...(kind === 'waitlist' && extra.waitlistPosition ? ([['Posisi daftar tunggu', String(extra.waitlistPosition)]] as [string, string][]) : []),
    ['Nomor pesanan', r.order_number],
    ...(r.workshop_phone ? ([['Telepon bengkel', r.workshop_phone]] as [string, string][]) : []),
  ];

  const text = [
    `Halo ${r.customer_name},`,
    '',
    intro,
    '',
    `${'Jadwal'.padEnd(20)}: ${day}, pukul ${r.time_slot} WIB`,
    ...rows.map(([k, v]) => `${k.padEnd(20)}: ${v}`),
    '',
    'Informasi:',
    ...tips.map((t) => `- ${t}`),
    '',
    `Lihat detail booking: ${orderUrl}`,
    `Petunjuk arah: ${mapsUrl}`,
    '',
    'Salam,',
    'Tim BengkelGo',
    '',
    'Email ini dikirim otomatis. Mohon tidak membalas email ini; hubungi bengkel melalui nomor di atas bila ada pertanyaan.',
  ].join('\n');

  const detailRows = rows
    .map(
      ([k, v], i) => `
      <tr>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${LINE};` : ''}color:${MUTED};font-size:13px;width:38%;vertical-align:top;">${esc(k)}</td>
        <td style="padding:10px 0;${i ? `border-top:1px solid ${LINE};` : ''}color:${NAVY};font-size:14px;font-weight:600;vertical-align:top;">${esc(v)}</td>
      </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6FB;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <tr>
          <td style="background:${BRAND};border-radius:12px 12px 0 0;padding:18px 28px;">
            <span style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:-0.3px;">BengkelGo</span>
            <span style="color:#DDE3FF;font-size:12px;padding-left:8px;">${esc(tag)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 12px;color:${NAVY};font-size:16px;">Halo ${esc(firstName(r.customer_name))},</p>
            <p style="margin:0;color:${MUTED};font-size:14px;line-height:22px;">${esc(intro)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SOFT};border-radius:10px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;color:${MUTED};font-size:12px;letter-spacing:0.6px;text-transform:uppercase;">${esc(label)}</p>
                  <p style="margin:4px 0 0;color:${NAVY};font-size:20px;font-weight:800;">${esc(day)}</p>
                  <p style="margin:2px 0 0;color:${BRAND};font-size:16px;font-weight:700;">Pukul ${esc(r.time_slot)} WIB</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:${BRAND};border-radius:8px;">
                  <a href="${esc(orderUrl)}" style="display:inline-block;padding:12px 22px;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">Lihat detail booking</a>
                </td>
                <td style="padding-left:12px;">
                  <a href="${esc(mapsUrl)}" style="color:${BRAND};font-size:14px;font-weight:600;text-decoration:none;">Petunjuk arah &rsaquo;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 8px;">
            <p style="margin:0 0 8px;color:${NAVY};font-size:13px;font-weight:700;">Informasi penting</p>
            <ul style="margin:0;padding-left:18px;color:${MUTED};font-size:13px;line-height:21px;">
              ${tips.map((t) => `<li style="margin:0 0 4px;">${esc(t)}</li>`).join('')}
            </ul>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;">
            <p style="margin:0;color:${NAVY};font-size:14px;">Salam,<br><strong>Tim BengkelGo</strong></p>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid ${LINE};padding:16px 28px;color:${MUTED};font-size:12px;line-height:18px;">
            Email ini dikirim otomatis karena Anda memiliki booking di BengkelGo. Mohon tidak membalas email ini;
            ${r.workshop_phone ? `hubungi bengkel di ${esc(r.workshop_phone)} bila ada pertanyaan.` : 'hubungi bengkel melalui halaman pesanan bila ada pertanyaan.'}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Emails the customer about a booking once the caller's transaction commits (nothing is sent on rollback,
 * and the request isn't slowed down by SMTP). The data is read inside the transaction so it matches what
 * was committed. Accounts without an email (guests) are skipped.
 */
export async function emailBookingAfterCommit(
  tx: Queryable,
  orderId: string,
  kind: Exclude<BookingEmailKind, 'tomorrow' | 'soon'>,
  extra: { waitlistPosition?: number | null } = {},
) {
  const { rows } = await tx.query<BookingEmailData & { customer_email: string | null }>(
    `SELECT ${BOOKING_EMAIL_COLUMNS}
     FROM booking_details c
     JOIN orders o ON o.id = c.order_id
     JOIN users u ON u.id = o.customer_id
     JOIN workshops w ON w.id = o.workshop_id
     JOIN services s ON s.id = c.service_id
     WHERE c.order_id = $1`,
    [orderId],
  );
  const r = rows[0];
  if (!r?.customer_email) return;
  const mail = { to: r.customer_email, ...renderBookingEmail(kind, r, extra) };
  afterCommit(tx, () => sendWithRetry(mail, orderId));
}

/** Waits before each retry: transient failures (DNS hiccup, SMTP busy) usually clear within minutes. */
export const RETRY_DELAYS_MS = [15_000, 60_000, 5 * 60_000];

/** Sends now, retrying a few times in the background; gives up (logged) only after the last attempt. */
async function sendWithRetry(mail: Mail, orderId: string, attempt = 0): Promise<void> {
  try {
    await sendMail(mail);
  } catch (err) {
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      logger.error({ err, orderId, subject: mail.subject }, 'Booking email failed after all retries');
      return;
    }
    logger.warn({ err, orderId, attempt: attempt + 1, retryInMs: delay }, 'Booking email failed; will retry');
    setTimeout(() => void sendWithRetry(mail, orderId, attempt + 1), delay).unref();
  }
}
