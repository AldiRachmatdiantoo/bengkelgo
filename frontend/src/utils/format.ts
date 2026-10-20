import type { OrderStatus, PaymentStatus, WorkshopStatus } from '@/services/api/types';

export const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

export const distance = (m: number | null | undefined) => (m == null ? '-' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso)) : '-';

export const longDate = (isoDate: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

/** YYYY-MM-DD in Asia/Jakarta, offset by `days`. */
export function jakartaDate(days = 0): string {
  return new Date(Date.now() + 7 * 3600e3 + days * 864e5).toISOString().slice(0, 10);
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu bengkel', tone: 'warning' },
  CONFIRMED: { label: 'Terkonfirmasi', tone: 'success' },
  IN_QUEUE: { label: 'Daftar tunggu', tone: 'warning' },
  ACCEPTED: { label: 'Mekanik dikirim', tone: 'info' },
  IN_PROGRESS: { label: 'Sedang dikerjakan', tone: 'info' },
  COMPLETED: { label: 'Selesai', tone: 'success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'neutral' },
  UNASSIGNED: { label: 'Tidak ada bengkel', tone: 'danger' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  UNPAID: { label: 'Belum bayar', tone: 'neutral' },
  PENDING_VERIFICATION: { label: 'Menunggu verifikasi', tone: 'warning' },
  VERIFIED: { label: 'Lunas', tone: 'success' },
  REJECTED: { label: 'Bukti ditolak', tone: 'danger' },
  REFUNDED: { label: 'Dana dikembalikan', tone: 'info' },
};

export const WORKSHOP_STATUS: Record<WorkshopStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Menunggu verifikasi', tone: 'warning' },
  APPROVED: { label: 'Aktif', tone: 'success' },
  REJECTED: { label: 'Ditolak', tone: 'danger' },
  SUSPENDED: { label: 'Dinonaktifkan', tone: 'danger' },
};

export type { Tone };

/** SOS problem categories (API emergency.problem_category). */
export const PROBLEM_CATEGORY: Record<string, { label: string; icon: string }> = {
  BATTERY: { label: 'Aki', icon: 'battery_alert' },
  TIRE: { label: 'Ban', icon: 'tire_repair' },
  ENGINE: { label: 'Mesin', icon: 'warning' },
  FUEL: { label: 'Bahan bakar', icon: 'local_gas_station' },
  TOWING: { label: 'Perlu derek', icon: 'rv_hookup' },
  LOCKOUT: { label: 'Kunci tertinggal', icon: 'key_off' },
  OTHER: { label: 'Lainnya', icon: 'build' },
};

/** "Honda Vario 125 · 2021 · Hitam" from a saved vehicle. */
export function vehicleName(v: { brand: string; model?: string | null; year?: number | null; color?: string | null }) {
  return [[v.brand, v.model].filter(Boolean).join(' '), v.year, v.color].filter(Boolean).join(' · ');
}
