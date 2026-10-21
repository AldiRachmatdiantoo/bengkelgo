/**
 * Order emails to the customer after the booking stage: cancelled (by the workshop or by the customer),
 * payment verified, and order completed. Same shared layout and outbox as the booking emails: queued in the
 * caller's transaction (nothing goes out on rollback), sent right after the commit, retried on failure.
 * Accounts without an email (guests) only get the in-app notification.
 */
import { env } from '../../config/env';
import type { Queryable } from '../../common/db/transaction';
import { renderEmail, rupiah } from '../../common/mail/layout';
import { queueEmailAfterCommit } from '../../common/mail/outbox';
import { longDateId } from '../booking/booking.email';

export type OrderEmailKind = 'cancelled_by_workshop' | 'cancelled_by_customer' | 'payment_verified' | 'completed';

export interface OrderEmailData {
  order_id: string;
  order_number: string;
  type: 'BOOKING' | 'EMERGENCY';
  total_amount: number;
  customer_name: string;
  customer_email: string | null;
  workshop_name: string | null;
  workshop_phone: string | null;
  booking_date: string | null;
  time_slot: string | null;
  service_name: string | null;
  payment_status: string | null;
  invoice_number: string | null;
  refunded_amount: number | null;
  refund_note: string | null;
  cancel_reason: string | null;
}

const appUrl = (path: string) => `${env.APP_URL.replace(/\/$/, '')}${path}`;

/** "Servis Rutin, Rabu, 21 Oktober 2026 pukul 10:00 WIB" or "Bantuan darurat (SOS)". */
function whatOf(r: OrderEmailData) {
  if (r.type === 'EMERGENCY') return 'Bantuan darurat (SOS)';
  const when = r.booking_date && r.time_slot ? `${longDateId(r.booking_date)} pukul ${r.time_slot} WIB` : null;
  return [r.service_name ?? 'Booking servis', when].filter(Boolean).join(', ');
}

export function renderOrderEmail(kind: OrderEmailKind, r: OrderEmailData) {
  const what = whatOf(r);
  const orderUrl = appUrl(`/orders/${r.order_id}`);
  const searchUrl = appUrl('/workshops');
  const contact = r.workshop_phone ? `hubungi bengkel di ${r.workshop_phone} bila ada pertanyaan.` : 'hubungi bengkel melalui halaman pesanan bila ada pertanyaan.';
  const footer = `Email ini dikirim otomatis karena Anda memiliki pesanan di BengkelGo. Mohon tidak membalas email ini; ${contact}`;
  const base: [string, string][] = [
    ['Pesanan', what],
    ...(r.workshop_name ? ([['Bengkel', r.workshop_name]] as [string, string][]) : []),
    ['Nomor pesanan', r.order_number],
  ];

  switch (kind) {
    case 'cancelled_by_workshop': {
      const refunded = r.payment_status === 'REFUNDED' && r.refunded_amount ? r.refunded_amount : null;
      return renderEmail({
        subject: `Pesanan dibatalkan bengkel: ${r.order_number}`,
        tag: 'Pesanan dibatalkan',
        preheader: `${r.workshop_name ?? 'Bengkel'} membatalkan pesanan ${r.order_number}.`,
        name: r.customer_name,
        intro: `Mohon maaf, ${r.workshop_name ?? 'bengkel'} membatalkan pesanan Anda.${refunded ? ' Dana yang sudah Anda bayarkan dikembalikan oleh bengkel.' : ''}`,
        rows: [
          ...base,
          ...(r.cancel_reason ? ([['Alasan', r.cancel_reason]] as [string, string][]) : []),
          ...(refunded ? ([['Dana dikembalikan', rupiah(refunded)]] as [string, string][]) : []),
          ...(refunded && r.refund_note ? ([['Catatan bengkel', r.refund_note]] as [string, string][]) : []),
        ],
        button: { text: 'Cari bengkel lain', url: searchUrl },
        link: { text: 'Lihat pesanan', url: orderUrl },
        tips: [
          ...(refunded ? ['Cek mutasi rekening atau e-wallet Anda. Bila dana belum masuk dalam 1×24 jam, hubungi bengkel.'] : []),
          'Anda bisa langsung memesan di bengkel lain yang masih punya jadwal kosong.',
        ],
        footer,
      });
    }
    case 'cancelled_by_customer':
      return renderEmail({
        subject: `Pembatalan berhasil: ${r.order_number}`,
        tag: 'Pesanan dibatalkan',
        preheader: `Pesanan ${r.order_number} sudah dibatalkan.`,
        name: r.customer_name,
        intro: 'Pesanan Anda sudah dibatalkan sesuai permintaan Anda. Bengkel juga sudah diberi tahu.',
        rows: [...base, ...(r.cancel_reason ? ([['Alasan', r.cancel_reason]] as [string, string][]) : [])],
        button: { text: 'Pesan lagi', url: searchUrl },
        link: { text: 'Lihat pesanan', url: orderUrl },
        tips: ['Bukan Anda yang membatalkan? Segera ganti password akun Anda.'],
        footer,
      });
    case 'payment_verified':
      return renderEmail({
        subject: `Pembayaran lunas: ${r.order_number}`,
        tag: 'Pembayaran lunas',
        preheader: `Pembayaran ${rupiah(r.total_amount)} untuk ${r.order_number} sudah diverifikasi bengkel.`,
        name: r.customer_name,
        intro: 'Pembayaran Anda sudah diperiksa dan diverifikasi oleh bengkel. Simpan email ini sebagai bukti pembayaran.',
        highlight: { label: 'Total dibayar', title: rupiah(r.total_amount), subtitle: r.invoice_number ?? undefined },
        rows: [...base, ...(r.invoice_number ? ([['Nomor invoice', r.invoice_number]] as [string, string][]) : []), ['Status', 'Lunas']],
        button: { text: 'Lihat bukti bayar', url: orderUrl },
        tips: ['Bukti bayar resmi (e-receipt) bisa dicetak atau disimpan sebagai PDF dari halaman pesanan.'],
        footer,
      });
    case 'completed': {
      const paid = r.payment_status === 'VERIFIED';
      return renderEmail({
        subject: `Pesanan selesai: ${r.workshop_name ?? 'BengkelGo'}`,
        tag: 'Pesanan selesai',
        preheader: `Pesanan ${r.order_number} sudah selesai. Bagaimana pengalaman Anda?`,
        name: r.customer_name,
        intro: `Pesanan Anda di ${r.workshop_name ?? 'bengkel'} sudah selesai dikerjakan. Terima kasih sudah memakai BengkelGo!`,
        rows: [
          ...base,
          ...(r.total_amount > 0 ? ([['Total biaya', rupiah(r.total_amount)]] as [string, string][]) : []),
          ['Pembayaran', paid ? 'Lunas' : 'Belum lunas'],
        ],
        button: { text: 'Beri ulasan', url: orderUrl },
        tips: [
          ...(paid ? [] : ['Belum membayar? Bayar lewat QRIS bengkel di halaman pesanan, lalu unggah bukti bayarnya.']),
          'Ulasan Anda membantu pelanggan lain memilih bengkel yang tepat.',
        ],
        footer,
      });
    }
  }
}

/** Queues the email for the order's customer (read inside the transaction, so it matches what commits). */
export async function emailOrderAfterCommit(tx: Queryable, orderId: string, kind: OrderEmailKind) {
  const { rows } = await tx.query<OrderEmailData>(
    `SELECT o.id AS order_id, o.order_number, o.type, o.total_amount, o.cancel_reason,
            u.name AS customer_name, u.email AS customer_email,
            w.name AS workshop_name, w.phone AS workshop_phone,
            to_char(b.booking_date, 'YYYY-MM-DD') AS booking_date, to_char(b.time_slot, 'HH24:MI') AS time_slot, s.name AS service_name,
            t.status AS payment_status, t.invoice_number, CASE WHEN t.status = 'REFUNDED' THEN t.amount END AS refunded_amount, t.refund_note
     FROM orders o
     JOIN users u ON u.id = o.customer_id
     LEFT JOIN workshops w ON w.id = o.workshop_id
     LEFT JOIN booking_details b ON b.order_id = o.id
     LEFT JOIN services s ON s.id = b.service_id
     LEFT JOIN transactions t ON t.order_id = o.id
     WHERE o.id = $1`,
    [orderId],
  );
  const r = rows[0];
  if (!r?.customer_email) return;
  await queueEmailAfterCommit(tx, { to: r.customer_email, ...renderOrderEmail(kind, r) }, { order_id: orderId, kind });
}
