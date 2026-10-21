/**
 * Booking emails to the customer: confirmation, waitlist, promoted from the waitlist, rescheduled, and the
 * day-before / ~2-hours-before reminders. The look comes from the shared email layout (common/mail/layout.ts).
 */
import { env } from '../../config/env';
import type { Queryable } from '../../common/db/transaction';
import { queueEmailAfterCommit } from '../../common/mail/outbox';
import { renderEmail } from '../../common/mail/layout';

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

/** "Rabu, 21 Oktober 2026" (calendar date, timezone-independent). */
export function longDateId(isoDate: string) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

const ARRIVAL_TIPS = ['Datang sekitar 10 menit sebelum jadwal.', 'Sebutkan nomor pesanan atau tunjukkan QR di halaman pesanan saat tiba.'];
const CHANGE_TIP = 'Berhalangan hadir? Ganti jadwal atau batalkan lewat halaman pesanan agar jadwalnya bisa dipakai pelanggan lain.';
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
        preheader: `Jadwal ${when} sedang penuh. Kami kabari begitu booking Anda terkonfirmasi.`,
        intro:
          `Jam yang Anda pilih sedang penuh, jadi booking Anda masuk daftar tunggu` +
          (extra.waitlistPosition ? ` (posisi ${extra.waitlistPosition}).` : '.') +
          ' Kami akan mengirim email lagi begitu booking Anda terkonfirmasi.',
        tips: ['Tidak ingin menunggu? Pilih jadwal lain lewat halaman pesanan.', 'Booking di daftar tunggu belum mendapat jadwal sampai terkonfirmasi.'],
      };
    case 'promoted':
      return {
        subject: `Kabar baik: booking Anda terkonfirmasi, ${when}`,
        tag: 'Booking terkonfirmasi',
        label: 'Jadwal servis',
        preheader: `Ada tempat kosong, booking Anda di ${r.workshop_name} kini terkonfirmasi.`,
        intro: 'Kabar baik! Ada tempat yang kosong, jadi booking Anda dari daftar tunggu kini terkonfirmasi.',
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

  return renderEmail({
    subject,
    tag,
    preheader,
    name: r.customer_name,
    intro,
    highlight: { label, title: day, subtitle: `Pukul ${r.time_slot} WIB` },
    rows,
    button: { text: 'Lihat detail booking', url: orderUrl },
    link: { text: 'Petunjuk arah', url: mapsUrl },
    tips,
    footer:
      'Email ini dikirim otomatis karena Anda memiliki booking di BengkelGo. Mohon tidak membalas email ini; ' +
      (r.workshop_phone ? `hubungi bengkel di ${r.workshop_phone} bila ada pertanyaan.` : 'hubungi bengkel melalui halaman pesanan bila ada pertanyaan.'),
  });
}

/**
 * Emails the customer about a booking: queued in the caller's transaction (nothing is sent on rollback) and
 * delivered right after the commit, without slowing the request down; failed sends are retried from the
 * email outbox. The data is read inside the transaction so it matches what was committed. Accounts without
 * an email (guests) are skipped.
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
  await queueEmailAfterCommit(tx, mail, { order_id: orderId, kind });
}
