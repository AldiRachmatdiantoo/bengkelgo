import { useEffect, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderStatus } from '@/services/api/types';
import { emergencyApi, orderApi, ownerApi, paymentApi, reviewApi, workshopApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import { useProtectedImage } from '@/hooks/useProtectedImage';
import { usePreparedImage } from '@/hooks/usePreparedImage';
import { ACCEPT_IMAGES, fileSize } from '@/utils/imageUpload';
import { PointsMap, directionsUrl } from '@/components/map/Maps';
import { BottomBar, ScreenAction } from '@/components/ui/screen';
import { DateStrip, SlotPicker, addMinutes, dotTime, shortDate, vehicleIcon, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { Alert, Badge, Button, Card, Icon, Input, MissingFields, Modal, QrCode, Select, TextArea, cx, toast, SkeletonSlots, SkeletonTimeline } from '@/components/ui';
import { ORDER_STATUS, PAYMENT_STATUS, PROBLEM_CATEGORY, dateTime, distance, longDate, rupiah, vehicleName } from '@/utils/format';
import { NEGOTIABLE, customerRange, emergencyPrice, splitPriceRange } from '@/utils/priceRange';

/** "0812…" -> "62812…" for wa.me links. */
const waNumber = (phone: string) => phone.replace(/\D/g, '').replace(/^0/, '62');
const timeOnly = (iso: string) => new Intl.DateTimeFormat('id-ID', { timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso));

export function OrderStatusBadge({ order }: { order: Pick<Order, 'status'> }) {
  const s = ORDER_STATUS[order.status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function OrderCard({ order, to }: { order: Order; to: string }) {
  const emergency = order.type === 'EMERGENCY';
  return (
    <Link to={to} data-testid="order-card" className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-line-strong">
      <div className="flex items-start gap-3">
        <span className={cx('grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg', emergency ? 'bg-emergency-soft text-emergency-ink' : 'bg-surface-high text-primary')}>
          <Icon name={emergency ? 'e911_emergency' : vehicleIcon(order.vehicle_type)} filled={emergency} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-subtitle font-bold text-ink group-hover:text-primary">{order.workshop?.name ?? 'Mencari bengkel…'}</p>
          <p className="truncate text-xs text-ink-2">
            {emergency ? 'Darurat' : 'Booking'} · {order.order_number}
          </p>
        </div>
        <OrderStatusBadge order={order} />
      </div>
      <p className="line-clamp-2 text-sm text-ink-2">
        {order.booking
          ? `${order.booking.service_name} · ${shortDate(order.booking.booking_date)}, ${dotTime(order.booking.time_slot)} WIB · Antrean #${order.booking.queue_number}`
          : splitPriceRange(order.emergency?.problem_description).text}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-2">
        <span className="min-w-0 truncate">
          {order.customer.name} · {vehicleLabel(order.vehicle_type)}
          {order.vehicle_plate && ` · ${order.vehicle_plate}`} · {dateTime(order.created_at)}
        </span>
        {order.total_amount > 0 ? (
          <span className="shrink-0 text-subtitle font-bold text-primary">{rupiah(order.total_amount)}</span>
        ) : (
          emergency && order.status !== 'CANCELLED' && <span className="shrink-0 font-bold text-ink-2">Harga {NEGOTIABLE.toLowerCase()}</span>
        )}
      </div>
    </Link>
  );
}

// ================================================================ booking: status page (Stitch "Status Booking & E-Receipt")
const BOOKING_HERO: Partial<Record<OrderStatus, { icon: string; title: string; text: string; tone: 'success' | 'warning' | 'info' | 'neutral' }>> = {
  CONFIRMED: { icon: 'check_circle', title: 'Booking dikonfirmasi', text: 'Jadwal servis dan nomor antrean Anda sudah diterima bengkel. Tunjukkan kode QR atau nomor pesanan saat tiba di bengkel.', tone: 'success' },
  IN_QUEUE: { icon: 'hourglass_top', title: 'Anda masuk daftar tunggu', text: 'Jam ini sedang penuh. Booking Anda otomatis terkonfirmasi begitu ada tempat kosong. Halaman ini diperbarui otomatis.', tone: 'warning' },
  IN_PROGRESS: { icon: 'build', title: 'Kendaraan sedang dikerjakan', text: 'Mekanik sedang menangani kendaraan Anda di bengkel.', tone: 'info' },
  COMPLETED: { icon: 'task_alt', title: 'Servis selesai', text: 'Kendaraan sudah selesai diservis. Beri ulasan di bawah supaya pelanggan lain tahu kualitas bengkel ini.', tone: 'success' },
  CANCELLED: { icon: 'cancel', title: 'Booking dibatalkan', text: 'Pesanan ini sudah tidak aktif.', tone: 'neutral' },
};
/** "Dibatalkan oleh bengkel: Mekanik sakit" (API cancelled_by / cancel_reason). */
export function cancellationText(order: Order) {
  const by = order.cancelled_by === 'WORKSHOP' ? 'oleh bengkel' : order.cancelled_by === 'CUSTOMER' ? 'oleh pelanggan' : '';
  return [`Dibatalkan ${by}`.trim(), order.cancel_reason].filter(Boolean).join(': ') + '.';
}


/** iCalendar file for the booking slot (all times in WIB → UTC). */
function icsFor(order: Order) {
  const b = order.booking!;
  const start = new Date(Date.parse(`${b.booking_date}T${b.time_slot}:00+07:00`));
  const end = new Date(start.getTime() + 3600e3);
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BengkelGo//Booking//ID',
    'BEGIN:VEVENT',
    `UID:${order.id}@bengkelgo`,
    `DTSTAMP:${f(new Date())}`,
    `DTSTART:${f(start)}`,
    `DTEND:${f(end)}`,
    `SUMMARY:Servis ${b.service_name} di ${order.workshop?.name ?? 'BengkelGo'}`,
    `DESCRIPTION:No. pesanan ${order.order_number} · Antrean #${b.queue_number}`,
    `LOCATION:${(order.workshop?.address ?? '').replace(/[,;]/g, ' ')}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Jadwal servis 2 jam lagi',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return { text: lines.join('\r\n'), start: f(start), end: f(end) };
}

async function shareOrder(order: Order) {
  const url = window.location.href;
  const title = `${order.order_number} · ${order.workshop?.name ?? 'BengkelGo'}`;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Tautan pesanan disalin');
    }
  } catch {
    // User closed the share sheet.
  }
}

const HERO_NOTE = { success: 'bg-success-soft text-primary', warning: 'border border-warning-line bg-warning-soft text-warning-ink', info: 'bg-sky text-primary', neutral: 'bg-card border border-line text-ink' };

/** Status box (Figma tint boxes) with the payment state and the receipt / calendar / share actions under it. */
export function BookingHero({ order }: { order: Order }) {
  const h = BOOKING_HERO[order.status];
  if (!h) return null;
  const ps = PAYMENT_STATUS[order.payment.status];
  const chip = 'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink transition hover:bg-surface';
  return (
    <section data-print-hide>
      <div className={cx('flex items-start gap-3 rounded-lg px-4 py-3.5', HERO_NOTE[h.tone])}>
        <Icon name={h.icon} filled className="mt-px text-[22px]" />
        <div className="min-w-0 flex-1">
          <p className="text-subtitle font-bold">{h.title}</p>
          <p className="mt-0.5 text-sm text-ink-2" data-testid="booking-hero-text">
            {order.status === 'CANCELLED' ? cancellationText(order) : h.text}
          </p>
          <p className="mt-2 text-xs font-bold">{order.payment.status === 'VERIFIED' ? 'Pembayaran lunas (QRIS)' : `Pembayaran: ${ps.label}`}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" className={chip} onClick={() => window.print()}>
          <Icon name="download" className="text-[18px] text-primary" /> Nota
        </button>
        {order.booking && order.status !== 'CANCELLED' && (
          <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(order).text)}`} download={`${order.order_number}.ics`} className={chip}>
            <Icon name="event" className="text-[18px] text-primary" /> Kalender
          </a>
        )}
        <button type="button" className={chip} onClick={() => void shareOrder(order)}>
          <Icon name="share" className="text-[18px] text-primary" /> Bagikan
        </button>
      </div>
    </section>
  );
}

/** Check-in pass (Figma "Pelunasan via QRIS" card layout): QR of the order number beside the queue and schedule. */
export function BookingPass({ order }: { order: Order }) {
  const b = order.booking!;
  const arrive = addMinutes(b.time_slot, -10);
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-print-hide>
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl bg-[#F7FAF6] p-2.5">
          <QrCode value={order.order_number} size={96} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-subtitle font-bold text-ink">Check-in di bengkel</p>
          <p className="mt-0.5 text-xs break-all text-ink-2">{order.order_number}</p>
          <p className="mt-2 text-xs text-ink-2">Nomor antrean</p>
          <p className="text-[27px] leading-tight font-bold text-primary" data-testid="queue-number">
            #{b.queue_number}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#253627] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-2">Jadwal servis</p>
          <p className="text-lg font-bold text-primary">
            {shortDate(b.booking_date)} · {dotTime(b.time_slot)} WIB
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-2">Datang</p>
          <p className="text-subtitle font-bold text-ink">{dotTime(arrive)} WIB</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-2">Tunjukkan kode QR atau nomor pesanan ke petugas, datang sekitar 10 menit sebelum jadwal.</p>
    </section>
  );
}

/** Workshop card: name, address, a small green map, route and call buttons. */
export function WorkshopContactCard({ order, title = 'Bengkel' }: { order: Order; title?: string }) {
  const w = order.workshop;
  if (!w) return null;
  const btn = 'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink transition hover:bg-surface';
  return (
    <section className="rounded-2xl border border-line bg-card p-4" data-print-hide>
      <p className="text-xs font-bold tracking-[0.04em] text-ink-2 uppercase">{title}</p>
      <h3 className="mt-1 text-lg font-bold text-ink">{w.name}</h3>
      <p className="mt-1 text-sm text-ink-2">{w.address}</p>
      <PointsMap origin={{ lat: w.latitude, lng: w.longitude }} originLabel={w.name} originTone="primary" points={[]} height={140} zoom={15} className="mt-3 overflow-hidden rounded-xl" />
      <div className="mt-3 flex gap-2">
        <a href={directionsUrl({ lat: w.latitude, lng: w.longitude })} target="_blank" rel="noreferrer" className={btn}>
          <Icon name="near_me" className="text-primary" /> Rute
        </a>
        <a href={`tel:${w.phone}`} className={btn}>
          <Icon name="call" className="text-primary" /> Telepon
        </a>
      </div>
    </section>
  );
}

/** Receipt (Figma "Nota akhir"): cost rows and the total box; printable through the "Nota" button. */
export function OrderReceipt({ order }: { order: Order }) {
  const paid = order.payment.status === 'VERIFIED';
  const row = (k: ReactNode, v: ReactNode, strong?: boolean) => (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-sm text-ink-2">{k}</dt>
      <dd className={cx('min-w-0 text-right text-sm break-words text-ink', strong !== false && 'font-bold')}>{v}</dd>
    </div>
  );
  return (
    <section data-print-area>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">Rincian biaya</h2>
        <span className="text-xs text-ink-2">{dateTime(order.created_at)}</span>
      </div>
      <dl className="flex flex-col gap-3.5 rounded-xl border border-line bg-card px-4 py-4">
        {row('No. pesanan', order.order_number)}
        {order.payment.invoice_number && row('No. invoice', <span data-testid="invoice-number">{order.payment.invoice_number}</span>)}
        {row('Pemilik', order.customer.name)}
        {order.customer.phone && row('No. HP', order.customer.phone, false)}
        {order.workshop && row('Bengkel', order.workshop.name)}
        {row('Kendaraan', [vehicleLabel(order.vehicle_type), order.vehicle && vehicleName(order.vehicle), order.vehicle_plate].filter(Boolean).join(' · '))}
        {order.notes && row('Keluhan', <span className="font-normal">“{order.notes}”</span>)}
        <div className="border-t border-line" />
        {row(
          order.booking ? order.booking.service_name : `Bantuan darurat · ${splitPriceRange(order.emergency?.problem_description).text}`,
          order.booking ? rupiah(order.total_amount) : emergencyPrice(order.total_amount),
        )}
      </dl>
      <div className={cx('mt-3 flex items-center justify-between gap-4 rounded-lg px-4 py-4', paid ? 'bg-success-soft' : 'bg-surface')}>
        <div>
          <p className="text-subtitle font-bold text-primary">{paid ? 'Lunas' : 'Total tagihan'}</p>
          <p className="text-xs text-ink-2">
            QRIS · {PAYMENT_STATUS[order.payment.status].label}
            {paid && order.payment.verified_at ? `, ${dateTime(order.payment.verified_at)}` : ''}
          </p>
        </div>
        <p className="text-right text-[27px] leading-tight font-bold text-primary">
          {order.total_amount > 0 ? rupiah(order.total_amount) : order.type === 'EMERGENCY' ? NEGOTIABLE : 'Menunggu harga'}
        </p>
      </div>
    </section>
  );
}

// ================================================================ emergency: live tracking (Stitch "Layanan Darurat SOS 24 Jam")
function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const left = Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
}

/** mm:ss left until the emergency auto-reroutes. */
export function ResponseCountdown({ deadline }: { deadline: string | null }) {
  const left = useCountdown(deadline);
  return left ? <span className="tabular-nums">{left}</span> : null;
}

const EMERGENCY_STATUS: Partial<Record<OrderStatus, { label: string; tone: string }>> = {
  PENDING: { label: 'Menghubungi bengkel', tone: 'bg-warning-soft text-warning-ink' },
  ACCEPTED: { label: 'Mekanik menuju lokasi', tone: 'bg-emergency-soft text-emergency-ink' },
  IN_PROGRESS: { label: 'Ditangani di lokasi', tone: 'bg-sky text-primary' },
  COMPLETED: { label: 'Bantuan selesai', tone: 'bg-success-soft text-success' },
  CANCELLED: { label: 'Dibatalkan', tone: 'bg-surface-low text-ink-2' },
  UNASSIGNED: { label: 'Tidak ada bengkel', tone: 'bg-emergency-soft text-emergency-ink' },
};

/** Compact white status strip (Stitch SOS header). */
export function EmergencyHeader({ order }: { order: Order }) {
  const e = order.emergency!;
  const countdown = useCountdown(order.status === 'PENDING' ? e.response_deadline : null);
  const live = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(order.status);
  const st = EMERGENCY_STATUS[order.status] ?? { label: ORDER_STATUS[order.status].label, tone: 'bg-surface-low text-ink-2' };
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card px-5 py-4 shadow-sm sm:px-6">
      <span className={cx('relative grid h-12 w-12 shrink-0 place-items-center rounded-full', live ? 'animate-beacon bg-emergency text-white' : order.status === 'COMPLETED' ? 'bg-success text-on-primary' : 'bg-navy text-white')}>
        <Icon name={order.status === 'COMPLETED' ? 'task_alt' : 'crisis_alert'} />
        {live && <span className="absolute top-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-success" />}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="flex flex-wrap items-center gap-2 text-headline-sm text-ink">
          Bantuan darurat
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-label text-[11px] font-bold uppercase', st.tone)}>
            {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />} {st.label}
          </span>
        </h1>
        <p className="font-label text-xs text-ink-2">
          ID Laporan: <b className="font-mono text-ink">{order.order_number}</b> • Waktu panggil: {timeOnly(order.created_at)} WIB
          {e.routing_attempts > 1 && <> • Percobaan pengalihan ke-{e.routing_attempts}</>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-low px-4 py-2.5">
        <span className="flex items-center gap-2">
          <Icon name="radar" className="text-primary" />
          <span className="leading-tight">
            <span className="block font-label text-[10px] font-bold text-ink-3 uppercase">Pencarian radius 5 km</span>
            <span className="block text-xs font-bold text-ink">Pengalihan otomatis aktif</span>
          </span>
        </span>
        {countdown && (
          <span className="flex items-center gap-1.5 border-l border-line pl-3 font-label text-xs text-ink-2">
            <Icon name="timer" className="text-warning" /> Batas respons bengkel: <b className="font-mono text-sm text-ink tabular-nums">{countdown}</b>
          </span>
        )}
        {live && <span className="border-l border-line pl-3 font-label text-[11px] text-ink-3">Diperbarui otomatis setiap 5 detik</span>}
      </div>
    </section>
  );
}

/** Big map card with the breakdown point, the assigned workshop and a stats row underneath. */
export function EmergencyMapCard({ order }: { order: Order }) {
  const e = order.emergency!;
  const w = order.workshop;
  const point = { lat: e.latitude, lng: e.longitude };
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
      <div className="relative">
        <PointsMap
          origin={point}
          originLabel="Titik mogok Anda"
          points={w ? [{ id: w.id, lat: w.latitude, lng: w.longitude, label: w.name, highlight: true }] : []}
          radiusMeters={5000}
          zoom={14}
          route
          labels
          height={340}
          className="rounded-none border-0"
        />
        <div className="absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center gap-2 rounded-xl bg-card/90 p-3 shadow-lift backdrop-blur">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky text-primary">
            <Icon name="near_me" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-label text-[10px] font-bold tracking-[0.04em] text-ink-3 uppercase">Lokasi Anda</p>
            <p className="truncate text-sm font-bold text-ink">{e.address_note || 'Titik di peta (buka di Google Maps)'}</p>
          </div>
          <a href={`https://www.google.com/maps?q=${e.latitude},${e.longitude}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-low px-3 font-label text-xs font-bold text-ink hover:bg-surface">
            <Icon name="open_in_new" className="text-[14px]" /> G-Maps
          </a>
        </div>
        <span className="absolute bottom-3 left-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-navy/85 px-3 py-1.5 font-label text-[11px] font-bold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Radius 5 km terkunci
        </span>
      </div>
      <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <MapStat icon="route" label="Jarak bengkel" value={distance(e.distance_meters)} />
        <MapStat icon="storefront" label="Bengkel ditugaskan" value={w?.name ?? 'Mencari…'} />
        <MapStat icon="engineering" label="Mekanik" value={order.mechanic?.name ?? (order.status === 'PENDING' ? 'Menunggu respons' : '-')} />
      </div>
    </section>
  );
}

function MapStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-low text-primary">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="font-label text-[10px] font-bold tracking-[0.04em] text-ink-3 uppercase">{label}</p>
        <p className="truncate font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

const TIMELINE: { key: string; title: string; text: (o: Order) => string; at?: (o: Order) => string | null }[] = [
  { key: 'sent', title: 'Permintaan bantuan terkirim', text: () => 'Lokasi Anda sudah kami terima. Bengkel terdekat sedang dihubungi.', at: (o) => o.created_at },
  {
    key: 'routed',
    title: 'Pencarian bengkel radius 5 KM',
    text: (o) => (o.workshop ? `${o.workshop.name} (${distance(o.emergency?.distance_meters)}) terpilih sebagai prioritas.` : 'Mencari bengkel aktif dalam radius 5 km.'),
    at: (o) => (o.workshop ? o.created_at : null),
  },
  {
    key: 'dispatch',
    title: 'Bengkel menerima & mekanik menuju lokasi',
    text: (o) => (o.status === 'PENDING' ? 'Menunggu bengkel menerima permintaan.' : o.mechanic ? `${o.mechanic.name} menuju lokasi Anda. Harap tetap berada di titik aman.` : 'Mekanik ditugaskan bengkel.'),
  },
  { key: 'progress', title: 'Penanganan & diagnosa di lokasi', text: () => 'Mekanik memeriksa dan memperbaiki kendaraan.' },
  { key: 'done', title: 'Penyelesaian & pembayaran', text: () => 'Bayar via QRIS bengkel, lalu beri ulasan untuk mekanik.', at: (o) => o.completed_at },
];
/** Index of the step currently happening; earlier steps are done. */
const CURRENT_STEP: Partial<Record<OrderStatus, number>> = { PENDING: 2, ACCEPTED: 2, IN_PROGRESS: 3, COMPLETED: TIMELINE.length };

export function EmergencyTimeline({ order }: { order: Order }) {
  const live = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(order.status);
  const activeIdx = CURRENT_STEP[order.status] ?? (order.workshop ? 2 : 1);
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-headline-sm text-ink">Status penanganan darurat</h3>
          <p className="text-sm text-ink-2">Status diperbarui otomatis oleh bengkel yang menangani.</p>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-label text-[11px] font-bold text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Diperbarui otomatis
          </span>
        ) : (
          <OrderStatusBadge order={order} />
        )}
      </div>
      {order.status === 'UNASSIGNED' && (
        <div className="mb-4">
          <Alert tone="danger">Maaf, tidak ada bengkel yang tersedia saat ini. Silakan coba kirim permintaan lagi beberapa saat lagi.</Alert>
        </div>
      )}
      {order.status === 'CANCELLED' && (
        <div className="mb-4">
          <Alert tone="neutral">Panggilan darurat ini telah dibatalkan. {cancellationText(order)}</Alert>
        </div>
      )}
      <ol className="relative">
        {TIMELINE.map((s, i) => {
          const done = i < activeIdx;
          const active = i === activeIdx && live;
          const at = s.at?.(order);
          return (
            <li key={s.key} className="relative flex gap-4 pb-5 last:pb-0">
              {i < TIMELINE.length - 1 && <span className={cx('absolute top-8 left-[13px] h-[calc(100%-28px)] w-0.5', done ? 'bg-success' : 'bg-line')} />}
              <span className={cx('relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full', done ? 'bg-success text-on-primary' : active ? 'bg-primary text-on-primary ring-4 ring-primary-fixed' : 'bg-surface-low text-ink-3')}>
                <Icon name={done ? 'check' : active ? 'more_horiz' : 'radio_button_unchecked'} className="text-[16px]" />
              </span>
              <div className={cx('min-w-0 flex-1', active && '-mt-1 rounded-lg border border-primary/30 bg-sky p-3')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={cx('text-sm font-bold', done || active ? 'text-ink' : 'text-ink-3')}>
                    {s.title}
                    {active && <span className="ml-2 rounded-md bg-primary px-1.5 py-0.5 font-label text-[10px] text-on-primary">Sedang berjalan</span>}
                  </p>
                  {(done || active) && at && <span className="font-mono text-xs text-ink-3">{timeOnly(at)} WIB</span>}
                  {!done && !active && <span className="font-label text-[11px] text-ink-3">Menunggu</span>}
                </div>
                <p className={cx('mt-0.5 text-xs', done || active ? 'text-ink-2' : 'text-ink-3')}>{s.text(order)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Figma mechanic row: initials avatar, "Name · Mekanik", rating; call and WhatsApp when the number is known. */
export function MechanicCard({ order }: { order: Order }) {
  const m = order.mechanic;
  if (!m) return null;
  const initials = m.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <section className="rounded-xl border border-line bg-card px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#3B553C] text-xs font-bold text-ink">{initials}</span>
        <p className="min-w-0 flex-1">
          <span className="block truncate text-subtitle font-bold text-ink">{m.name}</span>
          <span className="block text-xs text-ink-2">Mekanik {order.workshop?.name}</span>
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-subtitle font-bold text-primary">
          <Icon name="star" filled className="text-[16px] text-star" />
          {m.avg_rating > 0 ? m.avg_rating.toFixed(2).replace('.', ',') : 'Baru'}
        </span>
      </div>
      {order.type === 'EMERGENCY' && order.emergency && (
        <p className="mt-2 text-xs text-ink-2">
          {order.workshop?.name} · {distance(order.emergency.distance_meters)} dari Anda
        </p>
      )}
      {m.phone && (
        <div className="mt-3 flex gap-2">
          <a href={`tel:${m.phone}`} className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-on-primary hover:bg-primary-dark">
            <Icon name="call" /> Telepon
          </a>
          <a
            href={`https://wa.me/${waNumber(m.phone)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-surface"
          >
            <Icon name="chat" className="text-primary" /> WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}

export function EmergencyProblemCard({ order }: { order: Order }) {
  const e = order.emergency!;
  const p = splitPriceRange(e.problem_description);
  const category = e.problem_category ? PROBLEM_CATEGORY[e.problem_category] : null;
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-headline-sm text-ink">
          <Icon name={vehicleIcon(order.vehicle_type)} className="text-primary" /> Kendaraan &amp; Kendala
        </h3>
        {order.vehicle_plate && <span className="rounded-md bg-navy px-2 py-0.5 font-mono text-xs font-bold text-white">{order.vehicle_plate}</span>}
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Jenis kendaraan</dt>
          <dd className="text-right font-bold text-ink">{order.vehicle ? `${vehicleLabel(order.vehicle_type)} · ${vehicleName(order.vehicle)}` : vehicleLabel(order.vehicle_type)}</dd>
        </div>
        {category && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Kategori masalah</dt>
            <dd className="inline-flex items-center gap-1 font-semibold text-ink" data-testid="problem-category">
              <Icon name={category.icon} className="text-[16px] text-emergency-ink" /> {category.label}
            </dd>
          </div>
        )}
        {e.address_note && (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-3">Patokan lokasi</dt>
            <dd className="text-right font-semibold text-ink">{e.address_note}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-ink-3">Kisaran biaya pelanggan</dt>
          <dd className="text-right font-semibold text-ink">{customerRange(e) ?? NEGOTIABLE}</dd>
        </div>
      </dl>
      <p className="mt-3 font-label text-xs text-ink-3">Gejala kerusakan terlapor:</p>
      <p className="mt-1 rounded-lg bg-surface-low p-3 text-sm whitespace-pre-line text-ink">“{p.text}”</p>
    </section>
  );
}

/** Cost card (Stitch "Estimasi Biaya Transparan"). */
export function EmergencyCostCard({ order }: { order: Order }) {
  const done = order.status === 'COMPLETED';
  const range = customerRange(order.emergency);
  const priced = order.total_amount > 0;
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-headline-sm text-ink">
          <Icon name="receipt_long" className="text-primary" /> {done ? 'Biaya akhir' : 'Estimasi biaya'}
        </h3>
        <span className="rounded-md bg-success-soft px-1.5 py-0.5 font-label text-[10px] font-bold text-success uppercase">Tanpa biaya platform</span>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Penanganan darurat ({vehicleLabel(order.vehicle_type)})</dt>
          <dd className="text-right font-semibold text-ink">{emergencyPrice(order.total_amount)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Kisaran yang Anda siapkan</dt>
          <dd className="text-right font-semibold text-ink">{range ?? NEGOTIABLE}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">Biaya platform</dt>
          <dd className="font-semibold text-ink-2">Rp0</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="font-bold text-ink">{done ? 'Total biaya' : 'Total estimasi'}</p>
          <p className="font-label text-[11px] text-ink-3">{done ? 'Ditetapkan bengkel saat selesai' : priced ? 'Dapat berubah setelah diagnosa di lokasi' : 'Disepakati dengan mekanik setelah diagnosa'}</p>
        </div>
        <p className={cx('text-right', priced ? 'text-headline-md text-primary' : 'text-headline-sm text-ink')}>{emergencyPrice(order.total_amount)}</p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 font-label text-xs text-ink-3">
        <span>Metode bayar:</span>
        <span className="rounded-md bg-surface-low px-2 py-0.5 font-bold text-ink">QRIS bengkel</span>
      </div>
    </section>
  );
}

/** Navy safety banner with the cancel action (Stitch "Prosedur Keselamatan…"). */
export function SafetyBanner({ onCancel, cancelling }: { onCancel?: () => void; cancelling?: boolean }) {
  const tips = [
    ['Nyalakan segera', 'lampu hazard', 'agar terlihat pengemudi lain dari kejauhan.'],
    ['Pasang', 'segitiga pengaman ±30 meter', 'di belakang kendaraan bila bahu jalan memungkinkan.'],
    ['Tetap tunggu di', 'tempat aman', 'menjauh dari jalur lalu lintas aktif.'],
  ];
  return (
    <section className="rounded-xl bg-navy p-6 text-white shadow-lift sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-label text-xs font-bold tracking-[0.06em] text-warning uppercase">
            <Icon name="warning" /> Prosedur keselamatan menunggu di jalan raya
          </p>
          <h3 className="mt-2 text-headline-sm sm:text-headline-md">Selama menunggu mekanik, utamakan keselamatan Anda dan penumpang</h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {tips.map(([a, b, c], i) => (
              <li key={b} className="flex gap-3 text-sm text-white/85">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary font-label text-xs font-bold text-on-primary">{i + 1}</span>
                <span>
                  {a} <b className="text-white">{b}</b> {c}
                </span>
              </li>
            ))}
          </ol>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelling}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/40 px-5 font-label text-xs font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Batalkan Permintaan Bantuan
          </button>
        )}
      </div>
    </section>
  );
}

/** Confirmation dialog replacing window.confirm (Stitch "Batalkan Panggilan Darurat?"). */
export function CancelOrderModal({
  open,
  onClose,
  onConfirm,
  loading,
  emergency,
  mechanicName,
  reasonLabel = 'Alasan pembatalan (opsional)',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
  emergency: boolean;
  mechanicName?: string;
  reasonLabel?: string;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) setReason('');
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="cancel"
      tone="danger"
      title={emergency ? 'Batalkan Panggilan Darurat?' : 'Batalkan Booking?'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} className="bg-surface-low">
            {emergency ? 'Kembali ke peta' : 'Kembali'}
          </Button>
          <Button variant="danger" loading={loading} onClick={() => onConfirm(reason.trim())} data-testid="cancel-confirm">
            {emergency ? 'Ya, Batalkan SOS' : 'Ya, Batalkan Booking'}
          </Button>
        </>
      }
    >
      <div className="mt-2 flex flex-col gap-3">
        <p>
          {emergency
            ? mechanicName
              ? `${mechanicName} mungkin sudah dalam perjalanan ke lokasi Anda. Batalkan hanya jika bantuan sudah tidak diperlukan.`
              : 'Permintaan bantuan akan dihentikan dan bengkel tidak akan dihubungi lagi.'
            : 'Jadwal dan nomor antrean Anda akan diberikan ke pelanggan lain.'}
        </p>
        <TextArea label={reasonLabel} maxLength={300} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cancel-reason" />
      </div>
    </Modal>
  );
}

// ================================================================ customer: QRIS payment (Stitch "Konfirmasi & Pembayaran QRIS")
export const isPayable = (order: Order) => ['CONFIRMED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(order.status) && order.total_amount > 0;
export const canUploadProof = (order: Order) => isPayable(order) && (order.payment.status === 'UNPAID' || order.payment.status === 'REJECTED');

/** QRIS card (Figma "Pembayaran"): the workshop's own QR on a light tile, the amount, then save / copy buttons. */
export function QrisPayCard({ order }: { order: Order }) {
  const qris = useProtectedImage(canUploadProof(order) ? paymentApi.qrisPath(order.id) : null);
  const amount = order.payment.amount || order.total_amount;
  const [copied, setCopied] = useState(false);
  const half = 'inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink transition hover:bg-surface';
  return (
    <div>
      <section className="rounded-2xl border border-line bg-card px-4 pt-4 pb-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-subtitle font-bold text-primary">QRIS</span>
          <span className="text-xs font-bold tracking-[0.04em] text-ink-2 uppercase">Bayar servis</span>
        </div>
        <p className="mt-2 text-center text-lg font-bold break-words text-ink">{order.workshop?.name}</p>
        <div className="mx-auto mt-3 w-fit rounded-xl bg-[#F7FAF6] p-3">
          {qris.url ? (
            <img src={qris.url} alt={`QRIS ${order.workshop?.name ?? 'bengkel'}`} className="aspect-square w-44 object-contain sm:w-52" />
          ) : (
            <div className="grid aspect-square w-44 place-items-center px-3 text-center text-sm text-[#102019] sm:w-52">{qris.error ?? 'Memuat QRIS…'}</div>
          )}
        </div>
        <p className="mt-3 text-center text-[27px] leading-tight font-bold text-ink">{rupiah(amount)}</p>
        <p className="mt-1 text-center text-xs text-ink-2">Scan dengan m-banking atau e-wallet yang mendukung QRIS.</p>
      </section>
      <div className="mt-3 flex gap-2.5">
        {qris.url ? (
          <a href={qris.url} download={`qris-${order.order_number}.png`} className={half}>
            Simpan QR
          </a>
        ) : (
          <span className={cx(half, 'pointer-events-none opacity-45')} aria-disabled>
            Simpan QR
          </span>
        )}
        <button
          type="button"
          className={half}
          onClick={() => {
            void navigator.clipboard?.writeText(String(amount)).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          aria-label={`Salin nominal ${amount}`}
        >
          {copied ? 'Tersalin' : 'Salin nominal'}
        </button>
      </div>
    </div>
  );
}

/** Proof upload; its send button sits in the screen's bottom bar next to the amount. */
export function ProofUploadCard({ order, onUploaded }: { order: Order; onUploaded?: () => void }) {
  const qc = useQueryClient();
  const photo = usePreparedImage();
  const { file } = photo;
  const [drag, setDrag] = useState(false);
  const [payer, setPayer] = useState({ payer_reference: '', payer_name: '' });
  const upload = useMutation({
    mutationFn: () =>
      paymentApi.upload(order.id, file!, { payer_reference: payer.payer_reference.trim() || undefined, payer_name: payer.payer_name.trim() || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['order', order.id] });
      toast('Bukti pembayaran terkirim', { text: 'Bengkel akan memverifikasi pembayaran Anda.' });
      onUploaded?.();
    },
  });
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      upload.reset();
      void photo.choose(f);
    }
  };
  const refBad = !!payer.payer_reference.trim() && payer.payer_reference.trim().length < 3;
  const nameBad = !!payer.payer_name.trim() && payer.payer_name.trim().length < 2;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (file) upload.mutate();
      }}
    >
      {order.payment.status === 'REJECTED' && <Alert tone="danger">Bukti sebelumnya ditolak: {order.payment.rejection_reason}. Silakan unggah ulang.</Alert>}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        id="proof-drop"
        className={cx(
          'flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition',
          drag ? 'border-primary bg-surface' : 'border-line-strong bg-card hover:border-primary',
        )}
      >
        {photo.preview ? (
          <img src={photo.preview} alt="Pratinjau bukti pembayaran" className="max-h-48 rounded-lg border border-line object-contain" data-testid="proof-preview" />
        ) : (
          <span className="grid h-[46px] w-[46px] place-items-center rounded-lg bg-surface-high text-primary">
            <Icon name={photo.busy ? 'hourglass_top' : 'add_photo_alternate'} />
          </span>
        )}
        {photo.busy ? (
          <span className="text-sm text-ink">Menyiapkan foto…</span>
        ) : file ? (
          <span className="text-sm font-bold break-all text-ink">
            {file.name} <span className="font-normal text-ink-2">({fileSize(file.size)})</span>
            <span className="block text-xs font-bold text-primary">Ketuk untuk mengganti foto</span>
          </span>
        ) : (
          <span className="text-subtitle font-bold text-ink">
            Unggah foto bukti bayar <span className="text-emergency-ink">*</span>
          </span>
        )}
        <span className="text-xs text-ink-2">Screenshot atau foto struk. JPG, PNG, atau WEBP; di atas 2 MB diperkecil otomatis.</span>
        <input
          type="file"
          accept={ACCEPT_IMAGES}
          className="sr-only"
          data-testid="proof-input"
          onChange={(e) => {
            upload.reset();
            void photo.choose(e.target.files?.[0]);
            e.target.value = ''; // allow picking the same file again after an error
          }}
        />
      </label>
      {photo.image?.changed && (
        <p className="-mt-2 text-xs text-ink-2" data-testid="proof-compressed">
          Foto diperkecil dari {fileSize(photo.image.originalSize)} menjadi {fileSize(photo.image.file.size)} agar bisa diunggah.
        </p>
      )}
      {photo.error && (
        <Alert tone="danger">
          <span data-testid="proof-error">{photo.error}</span>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id="proof-ref"
          label="No. referensi transfer (opsional)"
          hint="Tertera di struk atau riwayat transfer"
          maxLength={64}
          value={payer.payer_reference}
          onChange={(e) => setPayer({ ...payer, payer_reference: e.target.value })}
          data-testid="payer-reference"
        />
        <Input
          id="proof-name"
          label="Nama pengirim (opsional)"
          hint="Nama di aplikasi bank atau e-wallet"
          maxLength={100}
          value={payer.payer_name}
          onChange={(e) => setPayer({ ...payer, payer_name: e.target.value })}
          data-testid="payer-name"
        />
      </div>
      <p className="text-xs text-ink-2">Bengkel mencocokkan bukti dengan mutasi QRIS mereka. Status pembayaran berubah otomatis setelah diverifikasi.</p>
      <MissingFields
        items={[
          !file && !photo.busy && { label: 'Foto bukti pembayaran', target: 'proof-drop' },
          refBad && { label: 'No. referensi min. 3 karakter', target: 'proof-ref' },
          nameBad && { label: 'Nama pengirim min. 2 huruf', target: 'proof-name' },
        ]}
      />
      {upload.error && <Alert tone="danger">{errorMessage(upload.error)}</Alert>}
      <BottomBar caption="Total bayar" amount={rupiah(order.payment.amount || order.total_amount)}>
        <ScreenAction type="submit" disabled={!file || photo.busy || refBad || nameBad} loading={upload.isPending} data-testid="proof-submit">
          Kirim bukti →
        </ScreenAction>
      </BottomBar>
    </form>
  );
}

/** Payment status card on the order page (the full flow lives on /orders/:id/pay). */
export function CustomerPaymentPanel({ order }: { order: Order }) {
  const ps = PAYMENT_STATUS[order.payment.status];
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-subtitle font-bold text-primary">QRIS</p>
        <Badge tone={ps.tone}>{ps.label}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-2">Total pembayaran</p>
          <p className="text-3xl font-bold text-ink">{order.payment.amount > 0 ? rupiah(order.payment.amount) : '-'}</p>
        </div>
        {canUploadProof(order) && (
          <Link to={`/orders/${order.id}/pay`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-on-primary hover:bg-primary-dark" data-testid="pay-now">
            Bayar sekarang →
          </Link>
        )}
      </div>
      <div className="mt-3 empty:hidden">
        {!isPayable(order) && order.payment.status === 'UNPAID' && <Alert tone="neutral">Pembayaran tersedia setelah pesanan dikonfirmasi dan harga ditetapkan bengkel.</Alert>}
        {order.payment.status === 'REJECTED' && <Alert tone="danger">Bukti ditolak: {order.payment.rejection_reason}. Silakan unggah ulang.</Alert>}
        {order.payment.status === 'PENDING_VERIFICATION' && (
          <Alert tone="info" icon="hourglass_top">
            Bukti bayar terkirim {order.payment.uploaded_at && dateTime(order.payment.uploaded_at)}. Menunggu verifikasi bengkel. Selama bukti diperiksa, pembatalan hanya bisa dilakukan bengkel.
          </Alert>
        )}
        {order.payment.status === 'REFUNDED' && (
          <Alert tone="info" icon="currency_exchange">
            <span data-testid="refund-info">
              Pesanan dibatalkan bengkel dan dana {rupiah(order.payment.amount)} sudah dikembalikan
              {order.payment.refunded_at && ` (dikonfirmasi ${dateTime(order.payment.refunded_at)})`}.
              {order.payment.refund_note && <span className="mt-1 block">Catatan bengkel: {order.payment.refund_note}</span>}
              <span className="mt-1 block">Belum menerima dana? Hubungi bengkel.</span>
            </span>
          </Alert>
        )}
        {order.payment.status === 'VERIFIED' && <Alert tone="success">Pembayaran lunas, diverifikasi {dateTime(order.payment.verified_at)}.</Alert>}
      </div>
    </section>
  );
}

export function ReviewForm({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const create = useMutation({
    mutationFn: () => reviewApi.create({ order_id: order.id, rating, comment: comment || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      toast('Terima kasih atas ulasan Anda');
    },
  });
  if (order.status !== 'COMPLETED') return null;
  if (order.reviewed) return <Alert tone="success">Terima kasih, ulasan Anda sudah tersimpan.</Alert>;
  return (
    <Card title="Bagaimana layanannya?" icon="reviews" subtitle={order.mechanic ? `Ulasan Anda juga menentukan rating mekanik ${order.mechanic.name}.` : undefined}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} bintang`} onClick={() => setRating(n)} className="rounded-full p-1 transition hover:scale-110">
              <Icon name="star" filled={n <= rating} className={cx('text-[36px]', n <= rating ? 'text-warning' : 'text-line-strong')} />
            </button>
          ))}
        </div>
        <TextArea label="Komentar (opsional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Ceritakan pengalaman servis Anda" />
        {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
        <Button type="submit" loading={create.isPending} className="self-start" icon="send">
          Kirim ulasan
        </Button>
      </form>
    </Card>
  );
}

// ================================================================ owner: respond, progress, verify
/** Payment proof + verify/reject controls (order page, payments tab, dashboard). */
export function ProofVerifyPanel({ order, compact }: { order: Order; compact?: boolean }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const proof = useProtectedImage(order.payment.status !== 'UNPAID' && order.payment.uploaded_at ? paymentApi.proofPath(order.id) : null);
  const verify = useMutation({
    mutationFn: (b: { approve: boolean; reason?: string }) => paymentApi.verify(order.id, b),
    onSuccess: (_d, b) => {
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      void qc.invalidateQueries({ queryKey: ['owner-orders'] });
      toast(b.approve ? 'Pembayaran diverifikasi lunas' : 'Bukti ditolak', { tone: b.approve ? 'success' : 'warning', text: order.order_number });
    },
    onError: (e) => toast('Gagal memproses pembayaran', { tone: 'danger', text: errorMessage(e) }),
  });
  return (
    <div className="flex flex-col gap-3">
      <div className={cx('flex gap-4', compact ? 'flex-row' : 'flex-col sm:flex-row')}>
        {proof.url ? (
          <a href={proof.url} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={proof.url} alt="Bukti pembayaran" className={cx('rounded-lg border border-line object-cover', compact ? 'h-24 w-20' : 'max-h-72 w-full sm:w-56')} />
          </a>
        ) : (
          <div className={cx('grid shrink-0 place-items-center rounded-lg bg-surface-low text-center text-xs text-ink-3', compact ? 'h-24 w-20' : 'h-40 w-full sm:w-56')}>
            {order.payment.status === 'UNPAID' ? 'Belum ada bukti' : (proof.error ?? 'Memuat…')}
          </div>
        )}
        <dl className="min-w-0 flex-1 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">{order.payment.invoice_number ? 'Invoice' : 'Pesanan'}</dt>
            <dd className="font-mono text-xs font-bold text-ink">{order.payment.invoice_number ?? order.order_number}</dd>
          </div>
          {order.payment.payer_reference && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">No. referensi</dt>
              <dd className="font-mono text-xs font-bold text-ink" data-testid="proof-payer-reference">{order.payment.payer_reference}</dd>
            </div>
          )}
          {order.payment.payer_name && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">Nama pengirim</dt>
              <dd className="truncate font-semibold text-ink">{order.payment.payer_name}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">Nominal</dt>
            <dd className="font-bold text-ink">{order.type === 'EMERGENCY' ? emergencyPrice(order.payment.amount) : rupiah(order.payment.amount)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-3">Pelanggan</dt>
            <dd className="truncate font-semibold text-ink">{order.customer.name}</dd>
          </div>
          {order.payment.uploaded_at && (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-3">Diunggah</dt>
              <dd className="text-ink">{dateTime(order.payment.uploaded_at)}</dd>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <dt className="text-ink-3">Status</dt>
            <dd>
              <Badge tone={PAYMENT_STATUS[order.payment.status].tone}>{PAYMENT_STATUS[order.payment.status].label}</Badge>
            </dd>
          </div>
        </dl>
      </div>
      {order.payment.status === 'PENDING_VERIFICATION' && (
        <>
          {rejecting ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <Input label="Alasan penolakan" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Nominal tidak sesuai" />
              </div>
              <Button variant="ghost" className="bg-surface-low" onClick={() => setRejecting(false)}>
                Batal
              </Button>
              <Button variant="danger" disabled={!reason} loading={verify.isPending} onClick={() => verify.mutate({ approve: false, reason })}>
                Tolak bukti
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr]">
              <Button variant="success" icon="verified_user" data-testid="payment-verify" loading={verify.isPending} onClick={() => verify.mutate({ approve: true })}>
                Verifikasi Lunas
              </Button>
              <Button variant="ghost" icon="replay" className="bg-surface-low" onClick={() => setRejecting(true)}>
                Minta Unggah Ulang
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function OwnerOrderActions({ order }: { order: Order }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [mechanicId, setMechanicId] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['order', order.id] });
    void qc.invalidateQueries({ queryKey: ['owner-orders'] });
  };
  const run = useMutation({
    mutationFn: (p: { fn: () => Promise<unknown>; done: string }) => p.fn(),
    onSuccess: (_d, p) => {
      refresh();
      setConfirmCancel(false);
      toast(p.done, { text: order.order_number });
    },
  });

  const isEmergencyPending = order.type === 'EMERGENCY' && order.status === 'PENDING';
  const canStart = order.status === 'CONFIRMED' || order.status === 'ACCEPTED';
  const canCancel = ['CONFIRMED', 'IN_QUEUE', 'ACCEPTED'].includes(order.status);
  // The price of an accepted SOS can change until the customer pays (API: PRICE_LOCKED afterwards).
  const canReprice = order.type === 'EMERGENCY' && ['ACCEPTED', 'IN_PROGRESS'].includes(order.status) && ['UNPAID', 'REJECTED'].includes(order.payment.status);
  const mechanics = useQuery({ queryKey: ['owner-mechanics'], queryFn: ownerApi.mechanics, enabled: isEmergencyPending });
  const activeMechanics = (mechanics.data ?? []).filter((m) => m.is_active);

  return (
    <Card title="Tindakan bengkel" icon="handyman" accent={isEmergencyPending ? 'emergency' : undefined}>
      {run.error && (
        <div className="mb-4">
          <Alert tone="danger">{errorMessage(run.error)}</Alert>
        </div>
      )}
      <div className="flex flex-col gap-5">
        {isEmergencyPending && (
          <div className="rounded-xl bg-emergency-soft p-4">
            <p className="mb-3 flex items-center gap-2 font-semibold text-emergency-ink">
              <Icon name="e911_emergency" filled /> Panggilan darurat menunggu respons Anda
              {order.emergency?.response_deadline && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 font-mono text-sm text-emergency-ink">
                  <Icon name="timer" className="text-[16px]" /> <ResponseCountdown deadline={order.emergency.response_deadline} />
                </span>
              )}
            </p>
            <p className="mb-3 font-label text-xs text-ink-2">
              Kisaran biaya pelanggan: <b className="text-ink">{customerRange(order.emergency) ?? NEGOTIABLE}</b>
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Input label="Estimasi biaya (Rp, opsional)" hint="Kosongkan jika harga bisa dibicarakan" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-48 bg-card" />
              {activeMechanics.length > 1 && (
                <Select label="Mekanik yang dikirim" value={mechanicId} onChange={(e) => setMechanicId(e.target.value)} className="w-56 bg-card" data-testid="emergency-mechanic">
                  <option value="">Otomatis (rating tertinggi yang bebas)</option>
                  {activeMechanics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              )}
              <Button
                variant="success"
                icon="near_me"
                data-testid="emergency-accept"
                loading={run.isPending}
                onClick={() =>
                  run.mutate({
                    fn: () => emergencyApi.respond(order.id, { action: 'ACCEPT', estimated_price: price ? Number(price) : undefined, mechanic_id: mechanicId || undefined }),
                    done: 'Panggilan diterima, mekanik ditugaskan',
                  })
                }
              >
                Terima &amp; Tugaskan Mekanik
              </Button>
              <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate({ fn: () => emergencyApi.respond(order.id, { action: 'DECLINE' }), done: 'Panggilan dialihkan ke bengkel lain' })}>
                Tolak / Alihkan
              </Button>
            </div>
          </div>
        )}
        {canStart && (
          <Button className="self-start" icon="play_arrow" loading={run.isPending} onClick={() => run.mutate({ fn: () => orderApi.updateStatus(order.id, { status: 'IN_PROGRESS' }), done: 'Pesanan mulai dikerjakan' })}>
            Mulai Kerjakan
          </Button>
        )}
        {order.status === 'IN_PROGRESS' && (
          <div className="flex flex-wrap items-end gap-3">
            <Input label="Total akhir (Rp)" type="number" min={0} placeholder={String(order.total_amount || '')} value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} className="w-48" />
            <Button
              variant="success"
              icon="task_alt"
              loading={run.isPending}
              onClick={() => run.mutate({ fn: () => orderApi.updateStatus(order.id, { status: 'COMPLETED', final_amount: finalAmount ? Number(finalAmount) : undefined }), done: 'Pesanan ditandai selesai' })}
            >
              Tandai Selesai
            </Button>
          </div>
        )}
        {canReprice && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line p-4">
            <Input
              label="Ubah estimasi biaya (Rp)"
              hint={`Sekarang: ${emergencyPrice(order.total_amount)}. Terkunci setelah pelanggan mengirim bukti bayar.`}
              type="number"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              className="w-56"
              data-testid="price-input"
            />
            <Button
              variant="secondary"
              icon="edit"
              disabled={newPrice === '' || Number(newPrice) < 0}
              loading={run.isPending}
              data-testid="price-save"
              onClick={() =>
                run.mutate({
                  fn: async () => {
                    await emergencyApi.setPrice(order.id, Number(newPrice));
                    setNewPrice('');
                  },
                  done: 'Estimasi biaya diperbarui',
                })
              }
            >
              Simpan estimasi
            </Button>
          </div>
        )}
        {!isEmergencyPending && !canStart && order.status !== 'IN_PROGRESS' && <p className="text-sm text-ink-3">Tidak ada tindakan untuk status ini.</p>}

        <div className="rounded-xl border border-line p-4">
          <p className="mb-3 flex items-center gap-2 font-bold text-ink">
            <Icon name="qr_code_scanner" className="text-primary" /> Verifikasi pembayaran QRIS
          </p>
          <ProofVerifyPanel order={order} />
        </div>

        {canCancel &&
          (order.payment.status === 'PENDING_VERIFICATION' ? (
            <p className="flex items-start gap-2 text-xs text-ink-2" data-testid="cancel-blocked">
              <Icon name="info" className="text-[16px] text-warning" />
              Untuk membatalkan, verifikasi atau tolak bukti bayar di atas dulu, agar tidak ada transfer yang terlewat.
            </p>
          ) : (
            <Button variant="ghost" icon="cancel" className="self-start text-emergency-ink hover:bg-emergency-soft" onClick={() => setConfirmCancel(true)} data-testid="owner-cancel">
              Batalkan pesanan
            </Button>
          ))}
      </div>
      {order.payment.status === 'VERIFIED' ? (
        <RefundCancelModal
          open={confirmCancel}
          order={order}
          onClose={() => {
            setConfirmCancel(false);
            run.reset();
          }}
          loading={run.isPending}
          error={run.error ? errorMessage(run.error) : null}
          onConfirm={(note, reason) =>
            run.mutate({
              fn: () => orderApi.updateStatus(order.id, { status: 'CANCELLED', refund_confirmed: true, refund_note: note || undefined, cancel_reason: reason || undefined }),
              done: 'Pesanan dibatalkan, dana tercatat dikembalikan',
            })
          }
        />
      ) : (
        <CancelOrderModal
          open={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          loading={run.isPending}
          emergency={order.type === 'EMERGENCY'}
          reasonLabel="Alasan untuk pelanggan (opsional)"
          onConfirm={(reason) => run.mutate({ fn: () => orderApi.updateStatus(order.id, { status: 'CANCELLED', cancel_reason: reason || undefined }), done: 'Pesanan dibatalkan' })}
        />
      )}
    </Card>
  );
}

/**
 * Cancelling an order the customer already paid. The money went straight to the workshop's QRIS, so the
 * workshop returns it itself; the API only cancels once the owner confirms that (payment -> "Dana dikembalikan").
 */
function RefundCancelModal({
  open,
  order,
  onClose,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  order: Order;
  onClose: () => void;
  onConfirm: (note: string, reason: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [refunded, setRefunded] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) {
      setRefunded(false);
      setNote('');
      setReason('');
    }
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="currency_exchange"
      tone="danger"
      title="Batalkan pesanan yang sudah lunas?"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} className="bg-surface-low">
            Kembali
          </Button>
          <Button variant="danger" loading={loading} disabled={!refunded} onClick={() => onConfirm(note.trim(), reason.trim())} data-testid="refund-cancel-confirm">
            Batalkan &amp; Catat Pengembalian
          </Button>
        </>
      }
    >
      <div className="mt-2 flex flex-col gap-3">
        <p>
          Pelanggan sudah membayar <b className="text-ink">{rupiah(order.payment.amount)}</b> ke QRIS bengkel Anda. Kembalikan dana itu ke pelanggan (
          {order.customer.name}
          {order.customer.phone ? `, ${order.customer.phone}` : ''}) sebelum membatalkan.
        </p>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line bg-surface-low p-3 text-sm text-ink">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-emergency)]" checked={refunded} onChange={(e) => setRefunded(e.target.checked)} data-testid="refund-confirm" />
          <span>
            Saya sudah mengembalikan <b>{rupiah(order.payment.amount)}</b> ke pelanggan.
          </span>
        </label>
        <TextArea label="Alasan untuk pelanggan (opsional)" maxLength={300} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <TextArea label="Catatan pengembalian (opsional)" maxLength={300} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. transfer balik ke e-wallet pelanggan, 20 Okt 10.15" data-testid="refund-note" />
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/** Small helper so pages can show a heading row without repeating markup. */
export function PageBackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 self-start font-label text-sm font-semibold text-primary hover:underline" data-print-hide>
      <Icon name="arrow_back" /> {children}
    </Link>
  );
}


// ================================================================ status timeline (server history)
const HISTORY_LABEL: Record<string, string> = {
  PENDING: 'SOS dikirim, menunggu bengkel',
  CONFIRMED: 'Booking terkonfirmasi',
  IN_QUEUE: 'Masuk daftar tunggu',
  ACCEPTED: 'Bengkel menerima, mekanik dikirim',
  IN_PROGRESS: 'Mulai dikerjakan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  UNASSIGNED: 'Tidak ada bengkel tersedia',
};
const PAYMENT_HISTORY_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: 'Bukti bayar dikirim',
  VERIFIED: 'Pembayaran diverifikasi lunas',
  REJECTED: 'Bukti bayar ditolak',
  REFUNDED: 'Dana dikembalikan',
  UNPAID: 'Menunggu pembayaran',
};
const ACTOR_LABEL: Record<string, string> = { CUSTOMER: 'Pelanggan', GUEST: 'Tamu', WORKSHOP_OWNER: 'Bengkel', ADMIN: 'Admin', SYSTEM: 'Otomatis' };

/** Every status change of the order and its payment (recorded by the database), as the Figma timeline. */
export function StatusHistoryCard({ order }: { order: Order }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['order-history', order.id, order.status, order.payment.status],
    queryFn: () => orderApi.history(order.id),
  });
  const items = data ?? [];
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-ink">Status pengerjaan</h2>
      {isLoading ? (
        <SkeletonTimeline />
      ) : error ? (
        <Alert tone="danger">{errorMessage(error)}</Alert>
      ) : (
        <ol className="flex flex-col" data-testid="status-history">
          {items.map((h, i) => {
            const last = i === items.length - 1;
            const bad = h.to_status === 'CANCELLED' || h.to_status === 'REJECTED' || h.to_status === 'UNASSIGNED';
            return (
              <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                {!last && <span aria-hidden className="absolute top-4 bottom-0 left-[6.5px] w-[3px] bg-line" />}
                <span aria-hidden className={cx('relative mt-0.5 h-4 w-4 shrink-0 rounded-full', bad ? 'bg-emergency-ink' : 'bg-primary')} />
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="text-subtitle font-bold text-ink">{(h.kind === 'PAYMENT' ? PAYMENT_HISTORY_LABEL : HISTORY_LABEL)[h.to_status] ?? h.to_status}</p>
                  <p className="text-xs text-ink-2">{dateTime(h.created_at)}</p>
                  {h.actor_role && (
                    <p className="w-full text-xs text-ink-2">
                      {ACTOR_LABEL[h.actor_role] ?? h.actor_role}
                      {h.actor_name ? ` (${h.actor_name})` : ''}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ================================================================ reschedule (customer)
export const canReschedule = (order: Order) => order.type === 'BOOKING' && ['CONFIRMED', 'IN_QUEUE'].includes(order.status) && !!order.workshop && !!order.booking;

/** Move a booking to another slot of the same workshop. The old slot is released for the waitlist. */
export function RescheduleModal({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(order.booking?.booking_date ?? '');
  const [slot, setSlot] = useState('');
  useEffect(() => {
    if (open) {
      setDate(order.booking?.booking_date ?? '');
      setSlot('');
    }
  }, [open, order.booking?.booking_date]);
  const slots = useQuery({
    queryKey: ['availability', order.workshop?.id, date],
    queryFn: () => workshopApi.availability(order.workshop!.id, date),
    enabled: open && !!order.workshop && !!date,
  });
  const move = useMutation({
    mutationFn: () => orderApi.reschedule(order.id, { booking_date: date, time_slot: slot }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['order', order.id] });
      void qc.invalidateQueries({ queryKey: ['my-orders'] });
      onClose();
      toast(r.status === 'IN_QUEUE' ? 'Jadwal diganti, Anda masuk daftar tunggu' : 'Jadwal booking diganti', { text: `${longDate(r.booking.booking_date)} pukul ${r.booking.time_slot}` });
    },
  });
  const same = date === order.booking?.booking_date && slot === order.booking?.time_slot;
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="event_repeat"
      title="Ganti jadwal booking"
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button icon="event_repeat" disabled={!slot || same} loading={move.isPending} onClick={() => move.mutate()} data-testid="reschedule-confirm">
            Pindahkan ke {slot || 'jam baru'}
          </Button>
        </>
      }
    >
      <div className="mt-3 flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Jadwal sekarang: <b className="text-ink">{order.booking && `${longDate(order.booking.booking_date)}, ${order.booking.time_slot}`}</b>. Slot lama dilepas untuk pelanggan lain. Jika jam baru penuh, Anda masuk daftar tunggu.
        </p>
        <DateStrip value={date} onChange={(d) => { setDate(d); setSlot(''); }} days={14} />
        {slots.isLoading ? <SkeletonSlots /> : <SlotPicker slots={slots.data ?? []} value={slot} onChange={setSlot} />}
        {move.error && <Alert tone="danger">{errorMessage(move.error)}</Alert>}
      </div>
    </Modal>
  );
}
