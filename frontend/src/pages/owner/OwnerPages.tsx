import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiAsset, emergencyApi, ownerApi, orderApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Mechanic, Order, OrderStatus, OrderType, OwnWorkshop, Review, Service, SlotAvailability, VehicleType } from '@/services/api/types';
import { MapPicker, type LatLng } from '@/components/map/Maps';
import { OrderCard, OrderStatusBadge, ProofVerifyPanel, ResponseCountdown } from '@/components/orders/OrderComponents';
import { DateStrip, StarRow, friendlyDay, slotRange, vehicleIcon, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { Alert, Badge, Button, Card, EmptyState, Icon, Input, Loading, Modal, PageHeader, ProgressBar, Segmented, Select, StatCard, Stars, Table, Td, TextArea, cx, toast } from '@/components/ui';
import { ORDER_STATUS, WORKSHOP_STATUS, dateTime, distance, jakartaDate, longDate, rupiah } from '@/utils/format';
import { NEGOTIABLE, customerRange, splitPriceRange } from '@/utils/priceRange';
import { ACCEPT_IMAGES, ImageCheckError, fileSize, prepareImage } from '@/utils/imageUpload';
import { usePreparedImage } from '@/hooks/usePreparedImage';

function useMyWorkshop() {
  return useQuery({ queryKey: ['my-workshop'], queryFn: ownerApi.me });
}
/** Recent orders of this workshop (shared key with the portal header). */
function useRecentOrders() {
  return useQuery({ queryKey: ['owner-orders', 'recent'], queryFn: () => orderApi.workshop({ limit: 100 }), refetchInterval: 30_000 });
}
function usePendingEmergencies() {
  // Incoming SOS calls must be answered within 2 minutes -> poll frequently.
  return useQuery({ queryKey: ['owner-orders', 'pending-emergency'], queryFn: () => orderApi.workshop({ type: 'EMERGENCY', status: 'PENDING' }), refetchInterval: 5000 });
}

const jakartaHour = () => new Date(Date.now() + 7 * 3600e3).getUTCHours();
const isToday = (iso: string | null) => !!iso && new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(0, 10) === jakartaDate(0);
/** Mechanic -> the active order they are on (booking in progress or emergency accepted). */
function activeTasks(orders: Order[]) {
  const m = new Map<string, Order>();
  for (const o of orders) if (o.mechanic && ['ACCEPTED', 'IN_PROGRESS'].includes(o.status)) m.set(o.mechanic.id, o);
  return m;
}

function StatusNotice({ w }: { w: OwnWorkshop }) {
  if (w.status === 'APPROVED') return null;
  const s = WORKSHOP_STATUS[w.status];
  return (
    <Alert tone={s.tone}>
      Status bengkel: <b>{s.label}</b>. {w.status === 'PENDING' ? 'Bengkel belum tampil ke pelanggan sampai diverifikasi admin.' : w.status_reason}
    </Alert>
  );
}

// ================================================================ dashboard (Stitch "Dashboard Operasional & Kuota")
export function OwnerDashboardPage() {
  const ws = useMyWorkshop();
  const today = jakartaDate(0);
  const approved = ws.data?.status === 'APPROVED';
  const emergencies = usePendingEmergencies();
  const recent = useRecentOrders();
  const bookings = useQuery({ queryKey: ['owner-orders', 'bookings', today], queryFn: () => orderApi.workshop({ type: 'BOOKING', date: today, limit: 100 }) });
  const sosToday = useQuery({ queryKey: ['owner-orders', 'sos', today], queryFn: () => orderApi.workshop({ type: 'EMERGENCY', date: today, limit: 100 }) });
  const quotas = useQuery({ queryKey: ['owner-quotas', today], queryFn: () => ownerApi.quotas(today), enabled: approved });
  const mechanics = useQuery({ queryKey: ['owner-mechanics'], queryFn: ownerApi.mechanics });

  if (ws.isLoading) return <Loading />;
  if (ws.error || !ws.data) return <Alert tone="danger">{errorMessage(ws.error)}</Alert>;
  const w = ws.data;

  const recentOrders = recent.data ?? [];
  const toVerify = recentOrders.filter((o) => o.payment.status === 'PENDING_VERIFICATION');
  const paidToday = recentOrders.filter((o) => o.payment.status === 'VERIFIED' && isToday(o.payment.verified_at));
  const revenueToday = paidToday.reduce((s, o) => s + o.payment.amount, 0);
  const sos = sosToday.data ?? [];
  const sosDone = sos.filter((o) => o.status === 'COMPLETED').length;
  const sosActive = sos.filter((o) => ['ACCEPTED', 'IN_PROGRESS'].includes(o.status));
  const cap = (quotas.data ?? []).reduce((a, s) => ({ booked: a.booked + s.current_booked, max: a.max + s.max_slot_per_hour }), { booked: 0, max: 0 });
  const util = cap.max ? Math.round((cap.booked / cap.max) * 100) : 0;
  const mech = mechanics.data ?? [];
  const activeMech = mech.filter((m) => m.is_active).length;
  const tasks = activeTasks(recentOrders);

  return (
    <div className="flex flex-col gap-6">
      <StatusNotice w={w} />
      {!w.has_qris && (
        <Alert tone="warning" icon="qr_code_2">
          QRIS belum diunggah, jadi pelanggan belum bisa membayar.{' '}
          <Link to="/owner/profile" className="font-semibold underline">
            Unggah QRIS
          </Link>
        </Alert>
      )}

      {emergencies.data && emergencies.data.length > 0 && (
        <div className="flex flex-col gap-4">
          {emergencies.data.map((o) => (
            <IncomingEmergency key={o.id} order={o} />
          ))}
        </div>
      )}

      <OwnerTodayStrip />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Panggilan SOS hari ini"
          icon="sos"
          tone="danger"
          value={sos.length}
          aside={
            <span className="inline-flex items-center gap-1 text-success">
              <Icon name="check_circle" className="text-[14px]" /> {sosDone} selesai
            </span>
          }
          hint={sosActive.length ? `${sosActive.length} sedang ditangani ${sosActive[0].mechanic?.name ?? ''}` : 'Tidak ada yang sedang ditangani'}
          progress={sos.length ? (sosDone / sos.length) * 100 : 0}
        />
        <StatCard
          label="Utilisasi kuota slot"
          icon="precision_manufacturing"
          tone={util >= 90 ? 'warning' : 'info'}
          value={`${util}%`}
          aside={approved ? `${cap.booked}/${cap.max} slot` : undefined}
          hint={!approved ? 'Aktif setelah diverifikasi admin' : cap.max ? `Sisa ${cap.max - cap.booked} slot bebas hari ini` : 'Tidak ada slot tersisa hari ini'}
          progress={util}
        />
        <StatCard
          label="Mekanik siaga & lapangan"
          icon="group"
          tone="success"
          value={`${activeMech}/${mech.length}`}
          aside={mech.length ? `${Math.round((activeMech / mech.length) * 100)}% aktif` : undefined}
          hint={`${tasks.size} sedang bertugas • ${Math.max(0, activeMech - tasks.size)} tersedia`}
          progress={mech.length ? (activeMech / mech.length) * 100 : 0}
        />
        <StatCard
          label="Pembayaran lunas hari ini"
          icon="account_balance_wallet"
          tone="info"
          value={rupiah(revenueToday)}
          hint={`${paidToday.length} transaksi QRIS terverifikasi`}
          progress={paidToday.length ? 100 : 0}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-headline-sm text-navy">
                  <Icon name="alt_route" className="text-primary" /> Manajemen Kuota Slot &amp; Antrean
                </h2>
                <p className="text-sm text-ink-2">Kapasitas per jam dikunci di database (anti-overbooking). Tambah kapasitas untuk menaikkan daftar tunggu.</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-low px-3 py-2 font-label text-xs font-bold text-navy">
                <Icon name="calendar_today" className="text-[16px] text-primary" /> Hari ini: {longDate(today)}
              </span>
            </div>
            {!approved ? (
              <EmptyState icon="pending_actions">Kuota slot aktif setelah bengkel diverifikasi admin.</EmptyState>
            ) : quotas.isLoading ? (
              <Loading />
            ) : (
              <SlotBoard date={today} slots={quotas.data ?? []} bookings={bookings.data ?? []} highlightHour={jakartaHour()} />
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <span className="flex flex-wrap gap-4 font-label text-xs text-ink-2">
                <Legend className="bg-primary" label="Sedang dikerjakan" />
                <Legend className="bg-warning" label="Daftar tunggu / menunggu bayar" />
                <Legend className="bg-success" label="Terkonfirmasi / selesai" />
              </span>
              <Link to="/owner/quotas" className="font-label text-sm font-bold text-primary hover:underline">
                Kalender &amp; kuota lengkap →
              </Link>
            </div>
          </section>

          {approved && quotas.data && quotas.data.length > 0 && <ThroughputChart slots={quotas.data} />}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-headline-sm text-navy">
                <Icon name="qr_code_scanner" className="text-primary" /> Verifikasi Pembayaran QRIS
              </h3>
              {toVerify.length > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-label text-[11px] font-bold text-warning-ink">{toVerify.length} menunggu validasi</span>}
            </div>
            {toVerify.length ? (
              <div className="rounded-lg bg-surface-low p-3">
                <p className="mb-2 text-sm font-bold text-navy">
                  {toVerify[0].booking ? `Booking: ${toVerify[0].booking.service_name}` : 'Panggilan darurat'}
                  {toVerify[0].vehicle_plate && <span className="ml-1 font-normal text-ink-2">({toVerify[0].vehicle_plate})</span>}
                </p>
                <ProofVerifyPanel order={toVerify[0]} compact />
              </div>
            ) : (
              <p className="text-sm text-ink-3">Tidak ada bukti bayar yang menunggu.</p>
            )}
            <div className="mt-3 flex items-center justify-between font-label text-xs text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Icon name="history" className="text-[16px]" /> {paidToday.length} struk terverifikasi hari ini
              </span>
              <Link to="/owner/payments" className="font-bold text-primary hover:underline">
                Buka semua →
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-headline-sm text-navy">
                  <Icon name="engineering" className="text-primary" /> Tim Mekanik &amp; Penugasan
                </h3>
                <p className="text-xs text-ink-2">Status penugasan dari pesanan yang sedang berjalan.</p>
              </div>
              <Link to="/owner/mechanics" className="grid h-9 w-9 place-items-center rounded-lg bg-sky text-primary hover:bg-primary-fixed/60" aria-label="Kelola mekanik">
                <Icon name="person_add" />
              </Link>
            </div>
            <TeamList mechanics={mech} tasks={tasks} />
            <p className="mt-3 border-t border-line pt-3 font-label text-xs text-ink-3">Total {activeMech} mekanik terdaftar aktif</p>
          </section>

          <section className="flex items-center gap-3 rounded-xl border border-line bg-card p-5 shadow-sm">
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-lg', w.accepts_emergency ? 'bg-sky text-primary' : 'bg-surface-low text-ink-3')}>
              <Icon name="satellite_alt" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">Radar SOS (5 KM)</p>
              <p className="text-xs text-ink-2">{w.accepts_emergency ? 'Menerima panggilan darurat otomatis dari radius 5 km.' : 'Nonaktif. Aktifkan lewat tombol status di header.'}</p>
            </div>
            <span className={cx('inline-flex items-center gap-1.5 font-label text-xs font-bold', w.accepts_emergency ? 'text-success' : 'text-ink-3')}>
              <span className={cx('h-2 w-2 rounded-full', w.accepts_emergency ? 'bg-success' : 'bg-ink-3')} /> {w.accepts_emergency ? 'Aktif' : 'Mati'}
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx('h-2.5 w-2.5 rounded-full', className)} /> {label}
    </span>
  );
}

const CHIP_TONE: Partial<Record<OrderStatus, string>> = {
  IN_PROGRESS: 'border-primary bg-sky',
  CONFIRMED: 'border-success/40 bg-success-soft/60',
  COMPLETED: 'border-line bg-surface-low opacity-70',
  IN_QUEUE: 'border-warning/40 bg-warning-soft/60',
};

/** Per-hour rows: capacity, the bookings in that slot, and +/- capacity (Stitch "Manajemen Kuota Slot & Jalur Pit", without pits). */
function SlotBoard({ date, slots, bookings, highlightHour }: { date: string; slots: SlotAvailability[]; bookings: Order[]; highlightHour?: number }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (b: { time_slot: string; max: number }) => ownerApi.setSlotCapacity({ date, time_slot: b.time_slot, max_slot_per_hour: b.max }),
    onSuccess: (r, b) => {
      void qc.invalidateQueries({ queryKey: ['owner-quotas', date] });
      void qc.invalidateQueries({ queryKey: ['owner-orders'] });
      toast(`Kapasitas ${b.time_slot} menjadi ${b.max}`, { text: r.promoted_from_queue > 0 ? `${r.promoted_from_queue} booking dari daftar tunggu dikonfirmasi.` : undefined });
    },
    onError: (e) => toast('Gagal mengubah kapasitas', { tone: 'danger', text: errorMessage(e) }),
  });
  if (slots.length === 0) return <EmptyState icon="event_busy">Tidak ada slot pada tanggal ini.</EmptyState>;
  return (
    <div className="flex flex-col gap-2">
      {slots.map((s) => {
        const inSlot = bookings.filter((o) => o.booking?.time_slot === s.time_slot && o.status !== 'CANCELLED').sort((a, b) => (a.booking?.queue_number ?? 0) - (b.booking?.queue_number ?? 0));
        const now = highlightHour === Number(s.time_slot.slice(0, 2));
        const pct = s.max_slot_per_hour ? (s.current_booked / s.max_slot_per_hour) * 100 : 100;
        return (
          <div key={s.time_slot} className={cx('grid gap-3 rounded-lg border p-3 sm:grid-cols-[150px_1fr_auto] sm:items-center', now ? 'border-primary/40 bg-sky/50' : 'border-line bg-white')}>
            <div>
              <p className="flex items-center gap-2 font-mono text-sm font-bold text-navy">
                {slotRange(s.time_slot)}
                {now && <span className="rounded-md bg-primary px-1.5 py-0.5 font-label text-[10px] text-white">KINI</span>}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar value={pct} tone={s.remaining === 0 ? 'warning' : 'info'} label={`Kuota terisi jam ${s.time_slot}`} />
                </div>
                <span className="font-label text-[11px] font-bold text-ink-2">
                  {s.current_booked}/{s.max_slot_per_hour}
                </span>
              </div>
              {s.waitlisted > 0 && <p className="mt-1 font-label text-[11px] font-bold text-warning-ink">{s.waitlisted} di daftar tunggu</p>}
            </div>
            <div className="no-scrollbar flex min-w-0 gap-2 overflow-x-auto">
              {inSlot.length ? (
                inSlot.map((o) => (
                  <Link
                    key={o.id}
                    to={`/orders/${o.id}`}
                    className={cx('min-w-44 shrink-0 rounded-lg border px-3 py-2 transition hover:shadow-sm', CHIP_TONE[o.status] ?? 'border-line bg-white')}
                  >
                    <p className="flex items-center justify-between gap-2 font-label text-[10px] font-bold text-ink-2 uppercase">
                      <span>Antrean #{o.booking?.queue_number}</span>
                      <span>{o.payment.status === 'PENDING_VERIFICATION' ? 'Tunggu verifikasi' : ORDER_STATUS[o.status].label}</span>
                    </p>
                    <p className="truncate text-sm font-bold text-navy">
                      {o.customer.name}
                      {o.vehicle_plate && <span className="font-normal text-ink-2"> ({o.vehicle_plate})</span>}
                    </p>
                    <p className="truncate font-label text-[11px] text-ink-2">{o.booking?.service_name}</p>
                  </Link>
                ))
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 font-label text-xs text-ink-3">
                  <Icon name="add_circle" className="text-[16px] text-success" /> Tersedia {s.remaining} slot
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 sm:justify-end">
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-2 hover:bg-surface-low disabled:opacity-30"
                disabled={save.isPending || s.max_slot_per_hour <= s.current_booked}
                onClick={() => save.mutate({ time_slot: s.time_slot, max: s.max_slot_per_hour - 1 })}
                aria-label={`Kurangi kapasitas ${s.time_slot}`}
              >
                <Icon name="remove" className="text-[18px]" />
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-sky px-3 font-label text-xs font-bold text-primary hover:bg-primary-fixed/60 disabled:opacity-40"
                disabled={save.isPending || s.max_slot_per_hour >= 100}
                onClick={() => save.mutate({ time_slot: s.time_slot, max: s.max_slot_per_hour + 1 })}
                aria-label={`Tambah kapasitas ${s.time_slot}`}
              >
                <Icon name="add" className="text-[16px]" /> Slot
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Bars = booked share of capacity per hour (Stitch "Throughput Unit Masuk & Utilisasi Per Jam"). */
function ThroughputChart({ slots }: { slots: SlotAvailability[] }) {
  const hour = jakartaHour();
  const peak = [...slots].sort((a, b) => b.current_booked - a.current_booked)[0];
  return (
    <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-headline-sm text-navy">Utilisasi Kuota Per Jam</h3>
          <p className="text-sm text-ink-2">Booking terisi dibanding kapasitas di setiap jam operasional hari ini.</p>
        </div>
        {peak && peak.current_booked > 0 && (
          <span className="rounded-md bg-surface-low px-2 py-1 font-mono text-xs font-bold text-navy">Puncak: {slotRange(peak.time_slot)}</span>
        )}
      </div>
      <div className="flex h-44 items-end gap-2">
        {slots.map((s) => {
          const pct = s.max_slot_per_hour ? (s.current_booked / s.max_slot_per_hour) * 100 : 0;
          const now = Number(s.time_slot.slice(0, 2)) === hour;
          return (
            <div key={s.time_slot} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${s.time_slot}: ${s.current_booked}/${s.max_slot_per_hour}`}>
              <span className="font-label text-[10px] font-bold text-ink-3">{s.current_booked}</span>
              <span className="relative w-full overflow-hidden rounded-t-md bg-surface-low" style={{ height: '75%' }}>
                <span className={cx('absolute inset-x-0 bottom-0 rounded-t-md', now ? 'bg-primary' : 'bg-primary/45')} style={{ height: `${Math.max(pct, 3)}%` }} />
              </span>
              <span className={cx('font-mono text-[10px]', now ? 'font-bold text-primary' : 'text-ink-3')}>
                {s.time_slot}
                {now && ' (Kini)'}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamList({ mechanics, tasks }: { mechanics: Mechanic[]; tasks: Map<string, Order> }) {
  if (mechanics.length === 0) return <EmptyState icon="engineering">Belum ada mekanik.</EmptyState>;
  return (
    <ul className="flex flex-col gap-2">
      {mechanics.map((m) => {
        const task = tasks.get(m.id);
        return (
          <li key={m.id} className={cx('flex items-center gap-3 rounded-lg p-2.5', task?.type === 'EMERGENCY' ? 'bg-emergency-soft' : 'bg-surface-low', !m.is_active && 'opacity-50')}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-navy">
                <span className="truncate">{m.name}</span>
                {m.specializations[0] && <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-label text-[10px] font-semibold text-ink-2">{m.specializations[0]}</span>}
              </p>
              <p className={cx('truncate font-label text-xs', task?.type === 'EMERGENCY' ? 'font-semibold text-emergency-ink' : 'text-ink-2')}>
                {!m.is_active ? 'Nonaktif' : task ? (task.type === 'EMERGENCY' ? `Menuju SOS: ${splitPriceRange(task.emergency?.problem_description).text}` : `Tugas: ${task.booking?.service_name} (${task.customer.name})`) : 'Siap menerima tugas'}
              </p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-0.5 font-label text-xs font-bold text-navy">
                <Icon name="star" filled className="text-[14px] text-warning" /> {m.avg_rating > 0 ? m.avg_rating.toFixed(2) : 'Baru'}
              </p>
              <p className={cx('font-label text-[11px] font-bold', task ? 'text-primary' : m.is_active ? 'text-success' : 'text-ink-3')}>{task ? 'Bertugas' : m.is_active ? 'Tersedia' : '-'}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function IncomingEmergency({ order }: { order: Order }) {
  const qc = useQueryClient();
  const respond = useMutation({
    mutationFn: (action: 'ACCEPT' | 'DECLINE') => emergencyApi.respond(order.id, { action }),
    onSuccess: (_d, action) => {
      void qc.invalidateQueries({ queryKey: ['owner-orders'] });
      toast(action === 'ACCEPT' ? 'Panggilan diterima, mekanik ditugaskan' : 'Panggilan dialihkan ke bengkel lain', { text: order.order_number });
    },
  });
  const e = order.emergency;
  const p = splitPriceRange(e?.problem_description);
  return (
    <section className="relative overflow-hidden rounded-xl border border-emergency/30 bg-emergency-soft p-5 shadow-lift" data-testid="incoming-emergency">
      <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
        <span className="grid h-14 w-14 animate-beacon place-items-center rounded-full bg-emergency text-white">
          <Icon name="e911_emergency" filled className="text-[24px]" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emergency-ink px-2 py-0.5 font-label text-[11px] font-bold text-white uppercase">Emergency SOS · {distance(e?.distance_meters)}</span>
            <span className="font-mono text-xs text-ink-2">#{order.order_number}</span>
          </p>
          <p className="mt-1 inline-flex rounded-md bg-white px-2 py-0.5 font-label text-xs font-semibold text-emergency-ink">{p.text}</p>
          <p className="mt-1 ml-2 inline-flex rounded-md bg-white px-2 py-0.5 font-label text-xs font-semibold text-navy">Kisaran biaya: {customerRange(e) ?? NEGOTIABLE}</p>
          <h3 className="mt-1 text-headline-sm text-navy">
            {order.customer.name}
            <span className="ml-2 font-label text-sm font-normal text-ink-2">
              • {vehicleLabel(order.vehicle_type)}
              {order.vehicle_plate && ` (${order.vehicle_plate})`}
            </span>
          </h3>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-label text-xs text-ink-2">
            {e?.address_note && (
              <span className="inline-flex items-center gap-1">
                <Icon name="pin_drop" className="text-[16px] text-emergency" /> {e.address_note}
              </span>
            )}
            {order.customer.phone && (
              <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-1 font-semibold text-primary">
                <Icon name="call" className="text-[16px]" /> {order.customer.phone}
              </a>
            )}
          </p>
          {respond.error && (
            <div className="mt-3">
              <Alert tone="danger">{errorMessage(respond.error)}</Alert>
            </div>
          )}
        </div>
        {e?.response_deadline && (
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-3 shadow-sm">
            <Icon name="timer" className="text-emergency" />
            <div>
              <p className="font-mono text-xl font-bold text-emergency-ink">
                <ResponseCountdown deadline={e.response_deadline} />
              </p>
              <p className="font-label text-[10px] text-ink-3">Auto-fallback aktif</p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 lg:flex-col">
          <Button icon="near_me" loading={respond.isPending} onClick={() => respond.mutate('ACCEPT')} data-testid="dashboard-emergency-accept">
            Terima &amp; Tugaskan Mekanik
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 bg-white" loading={respond.isPending} onClick={() => respond.mutate('DECLINE')}>
              Tolak / Alihkan
            </Button>
            <Link to={`/orders/${order.id}`} className="grid h-12 w-12 place-items-center rounded-lg bg-white text-navy shadow-sm hover:bg-sky" aria-label="Detail & estimasi biaya">
              <Icon name="open_in_new" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================================================================ emergency calls tab
export function OwnerEmergencyPage() {
  const pending = usePendingEmergencies();
  const all = useQuery({ queryKey: ['owner-orders', 'emergency-all'], queryFn: () => orderApi.workshop({ type: 'EMERGENCY', limit: 100 }), refetchInterval: 15_000 });
  const active = (all.data ?? []).filter((o) => ['ACCEPTED', 'IN_PROGRESS'].includes(o.status));
  const history = (all.data ?? []).filter((o) => !['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(o.status));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Radar SOS 5 KM" title="Panggilan Darurat" subtitle="Panggilan baru harus direspons dalam 2 menit; jika tidak, sistem mengalihkan ke bengkel lain. Halaman ini memeriksa otomatis setiap 5 detik." />
      {pending.data && pending.data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pending.data.map((o) => (
            <IncomingEmergency key={o.id} order={o} />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-5 py-4 text-sm text-ink-2 shadow-sm">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
          </span>
          Tidak ada panggilan darurat baru. Radar aktif memeriksa setiap 5 detik.
        </div>
      )}
      <Card title="Sedang ditangani" icon="two_wheeler" actions={<Badge tone="info">{active.length}</Badge>}>
        {active.length ? (
          <div className="grid gap-3">
            {active.map((o) => (
              <OrderCard key={o.id} order={o} to={`/orders/${o.id}`} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-3">Tidak ada mekanik yang sedang menangani panggilan darurat.</p>
        )}
      </Card>
      <Card title="Riwayat panggilan" icon="history">
        {all.isLoading ? (
          <Loading />
        ) : history.length ? (
          <div className="grid gap-3">
            {history.map((o) => (
              <OrderCard key={o.id} order={o} to={`/orders/${o.id}`} />
            ))}
          </div>
        ) : (
          <EmptyState icon="inbox">Belum ada riwayat panggilan darurat.</EmptyState>
        )}
      </Card>
    </div>
  );
}

// ================================================================ payment verification tab
export function OwnerPaymentsPage() {
  const recent = useRecentOrders();
  const [tab, setTab] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const map = { PENDING: 'PENDING_VERIFICATION', VERIFIED: 'VERIFIED', REJECTED: 'REJECTED' } as const;
  const list = (recent.data ?? []).filter((o) => o.payment.status === map[tab]);
  const count = (k: keyof typeof map) => (recent.data ?? []).filter((o) => o.payment.status === map[k]).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Pembayaran" title="Verifikasi Pembayaran QRIS" subtitle="Cocokkan bukti transfer pelanggan dengan mutasi QRIS bengkel Anda, lalu verifikasi atau minta unggah ulang." />
      <Segmented
        label="Status pembayaran"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'PENDING', label: `Menunggu (${count('PENDING')})`, icon: 'hourglass_top' },
          { value: 'VERIFIED', label: `Lunas (${count('VERIFIED')})`, icon: 'verified' },
          { value: 'REJECTED', label: `Ditolak (${count('REJECTED')})`, icon: 'block' },
        ]}
      />
      {recent.isLoading ? (
        <Loading />
      ) : list.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((o) => (
            <section key={o.id} className="rounded-xl border border-line bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <Link to={`/orders/${o.id}`} className="font-bold text-navy hover:text-primary">
                  {o.booking ? o.booking.service_name : 'Panggilan darurat'}
                </Link>
                <OrderStatusBadge order={o} />
              </div>
              <ProofVerifyPanel order={o} />
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="task_alt">{tab === 'PENDING' ? 'Tidak ada bukti bayar yang menunggu verifikasi.' : 'Belum ada transaksi pada status ini.'}</EmptyState>
      )}
    </div>
  );
}

// ================================================================ orders list
export function OwnerOrdersPage() {
  const [type, setType] = useState<OrderType | ''>('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [date, setDate] = useState('');
  const q = { type: type || undefined, status: status || undefined, date: date || undefined, limit: 100 };
  const { data, isLoading, error } = useQuery({ queryKey: ['owner-orders', q], queryFn: () => orderApi.workshop(q) });
  // Cancelled orders stay out of the list unless the "Dibatalkan" status (riwayat) is picked.
  const shown = status === 'CANCELLED' ? (data ?? []) : (data ?? []).filter((o) => o.status !== 'CANCELLED');
  const hidden = (data?.length ?? 0) - shown.length;

  return (
    <>
      <PageHeader eyebrow="Operasional" title="Semua Pesanan" subtitle="Booking terjadwal dan panggilan darurat ke bengkel Anda." />
      <div className="mb-5 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <span className="font-label text-xs font-semibold">Tipe</span>
          <Segmented
            label="Tipe pesanan"
            value={type}
            onChange={setType}
            options={[
              { value: '', label: 'Semua' },
              { value: 'BOOKING', label: 'Booking', icon: 'event_available' },
              { value: 'EMERGENCY', label: 'Darurat', icon: 'e911_emergency' },
            ]}
          />
        </div>
        <div className="w-52">
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Semua status (tanpa dibatalkan)</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
          <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {(type || status || date) && (
          <Button
            variant="ghost"
            icon="filter_alt_off"
            onClick={() => {
              setType('');
              setStatus('');
              setDate('');
            }}
          >
            Reset
          </Button>
        )}
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger">{errorMessage(error)}</Alert>
      ) : shown.length ? (
        <div className="grid gap-3">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} to={`/orders/${o.id}`} />
          ))}
        </div>
      ) : (
        <EmptyState icon="inbox">Tidak ada pesanan.</EmptyState>
      )}
      {hidden > 0 && (
        <button type="button" onClick={() => setStatus('CANCELLED')} className="mt-4 inline-flex items-center gap-1.5 font-label text-sm font-semibold text-primary hover:underline">
          <Icon name="history" /> Lihat riwayat dibatalkan ({hidden})
        </button>
      )}
    </>
  );
}

// ================================================================ services (embedded in settings)
export function OwnerServicesPage({ embedded }: { embedded?: boolean } = {}) {
  const qc = useQueryClient();
  const ws = useMyWorkshop();
  const list = useQuery({ queryKey: ['owner-services'], queryFn: ownerApi.services });
  const [f, setF] = useState({ name: '', description: '', price: '', duration_minutes: '60', vehicle_type: 'MOTOR' as VehicleType });
  const refresh = () => qc.invalidateQueries({ queryKey: ['owner-services'] });
  const create = useMutation({
    mutationFn: () =>
      ownerApi.createService({ name: f.name, description: f.description || undefined, price: Number(f.price), duration_minutes: Number(f.duration_minutes), vehicle_type: f.vehicle_type }),
    onSuccess: () => {
      setF({ ...f, name: '', description: '', price: '' });
      void refresh();
      toast('Layanan ditambahkan');
    },
  });
  const [editing, setEditing] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const remove = useMutation({
    mutationFn: (s: Service) => ownerApi.deleteService(s.id),
    onSuccess: (_d, s) => {
      setDeleting(null);
      void refresh();
      toast('Layanan dihapus', { text: `${s.name} tidak lagi tampil dan tidak bisa dibooking.` });
    },
  });
  const toggle = useMutation({
    mutationFn: (s: Service) => ownerApi.updateService(s, { is_active: !s.is_active }),
    onSuccess: (_d, s) => {
      void refresh();
      toast(s.is_active ? 'Layanan dinonaktifkan' : 'Layanan diaktifkan', { text: s.name });
    },
    onError: (e) => toast('Gagal mengubah status layanan', { tone: 'danger', text: errorMessage(e) }),
  });

  return (
    <>
      {!embedded && <PageHeader eyebrow="Katalog" title="Layanan servis" subtitle="Layanan aktif tampil di halaman booking pelanggan." />}
      <Card title="Tambah layanan" icon="add_circle" className="mb-6">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Input label="Nama layanan" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mis. Ganti oli + filter" />
          </div>
          <Input label="Harga (Rp)" type="number" min={0} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <Input label="Durasi (menit)" type="number" min={5} value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Deskripsi (opsional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </div>
          <Select label="Kendaraan" value={f.vehicle_type} onChange={(e) => setF({ ...f, vehicle_type: e.target.value as VehicleType })}>
            {(ws.data?.vehicle_types ?? ['MOTOR', 'MOBIL']).map((v) => (
              <option key={v} value={v}>
                {vehicleLabel(v)}
              </option>
            ))}
          </Select>
          <Button type="submit" icon="add" loading={create.isPending}>
            Tambah layanan
          </Button>
        </form>
        {create.error && (
          <div className="mt-4">
            <Alert tone="danger">{errorMessage(create.error)}</Alert>
          </div>
        )}
      </Card>
      {list.isLoading ? (
        <Loading />
      ) : list.data?.length ? (
        <Table head={['Layanan', 'Kendaraan', 'Harga', 'Durasi', 'Status', '']}>
          {list.data.map((s) => (
            <tr key={s.id} className={cx(!s.is_active && 'opacity-60')}>
              <Td>
                <p className="font-semibold">{s.name}</p>
                {s.description && <p className="text-xs text-ink-3">{s.description}</p>}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1 text-ink-2">
                  <Icon name={vehicleIcon(s.vehicle_type)} className="text-[18px]" /> {vehicleLabel(s.vehicle_type)}
                </span>
              </Td>
              <Td className="font-semibold">{rupiah(s.price)}</Td>
              <Td>{s.duration_minutes} mnt</Td>
              <Td>{s.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(s)} data-testid="service-edit">
                    Ubah
                  </Button>
                  <Button size="sm" variant={s.is_active ? 'ghost' : 'secondary'} loading={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
                    {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  <Button size="sm" variant="ghost" icon="delete" className="text-emergency-ink hover:bg-emergency-soft" onClick={() => setDeleting(s)} data-testid="service-delete" aria-label={`Hapus ${s.name}`}>
                    Hapus
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState icon="build">Belum ada layanan. Tambahkan layanan pertama di atas.</EmptyState>
      )}
      {editing && <EditServiceModal s={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      <Modal
        open={!!deleting}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        icon="delete"
        tone="danger"
        title={`Hapus ${deleting?.name ?? 'layanan'}?`}
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={() => setDeleting(null)}>
              Batal
            </Button>
            <Button variant="danger" icon="delete" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting)} data-testid="service-delete-confirm">
              Hapus layanan
            </Button>
          </>
        }
      >
        <p className="mt-2">Layanan hilang dari daftar dan tidak bisa dibooking lagi. Booking lama yang memakai layanan ini tetap tersimpan. Untuk menyembunyikan sementara, pakai Nonaktifkan.</p>
        {remove.error && (
          <div className="mt-3">
            <Alert tone="danger">{errorMessage(remove.error)}</Alert>
          </div>
        )}
      </Modal>
    </>
  );
}

function EditServiceModal({ s, onClose, onSaved }: { s: Service; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: s.name, description: s.description ?? '', price: String(s.price), duration_minutes: String(s.duration_minutes) });
  const price = Number(f.price);
  const duration = Number(f.duration_minutes);
  const invalid =
    f.name.trim().length < 2 || f.price === '' || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 5 || duration > 1440;
  const save = useMutation({
    // The API cannot clear a saved description, so an empty field keeps the old one.
    mutationFn: () =>
      ownerApi.updateService(s, { name: f.name.trim(), description: f.description.trim() || undefined, price, duration_minutes: duration }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast('Layanan diperbarui', { text: f.name.trim() });
    },
  });
  const submit = () => {
    if (!invalid) save.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      icon="edit"
      title="Ubah layanan"
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button icon="save" loading={save.isPending} disabled={invalid} onClick={submit} data-testid="service-save">
            Simpan
          </Button>
        </>
      }
    >
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label="Nama layanan" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input
          label="Deskripsi"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          hint={s.description ? 'Kosongkan untuk tetap memakai deskripsi lama' : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Harga (Rp)" type="number" min={0} required value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} data-testid="service-price" />
          <Input
            label="Durasi (menit)"
            type="number"
            min={5}
            max={1440}
            required
            value={f.duration_minutes}
            onChange={(e) => setF({ ...f, duration_minutes: e.target.value })}
            error={f.duration_minutes !== '' && (duration < 5 || duration > 1440) ? '5–1440 menit' : undefined}
          />
        </div>
        <p className="text-xs text-ink-3">Jenis kendaraan ({vehicleLabel(s.vehicle_type)}) tetap, agar pesanan lama tidak berubah. Untuk jenis kendaraan lain, buat layanan baru.</p>
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <button type="submit" className="sr-only">
          Simpan
        </button>
      </form>
    </Modal>
  );
}

// ================================================================ mechanics tab (Stitch "Kelola Mekanik")
export function OwnerMechanicsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['owner-mechanics'], queryFn: ownerApi.mechanics });
  const recent = useRecentOrders();
  const [f, setF] = useState({ name: '', phone: '', specializations: '' });
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [removing, setRemoving] = useState<Mechanic | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['owner-mechanics'] });
  const create = useMutation({
    mutationFn: () =>
      ownerApi.createMechanic({
        name: f.name.trim(),
        phone: f.phone.trim() || undefined,
        specializations: tagsOf(f.specializations),
      }),
    onSuccess: () => {
      setF({ name: '', phone: '', specializations: '' });
      void refresh();
      toast('Teknisi ditambahkan');
    },
  });
  // DELETE on the API is a soft delete (history & ratings are kept), so a removed technician can be restored.
  const remove = useMutation({
    mutationFn: (m: Mechanic) => ownerApi.deactivateMechanic(m.id),
    onSuccess: (_d, m) => {
      setRemoving(null);
      void refresh();
      toast('Teknisi dihapus dari tim aktif', { text: `${m.name} dipindah ke arsip dan tidak lagi menerima tugas.` });
    },
    onError: (e) => toast('Gagal menghapus teknisi', { tone: 'danger', text: errorMessage(e) }),
  });
  const restore = useMutation({
    mutationFn: (m: Mechanic) => ownerApi.updateMechanic(m, { is_active: true }),
    onSuccess: (_d, m) => {
      void refresh();
      toast('Teknisi diaktifkan kembali', { text: m.name });
    },
    onError: (e) => toast('Gagal mengaktifkan teknisi', { tone: 'danger', text: errorMessage(e) }),
  });
  const tasks = activeTasks(recent.data ?? []);
  const all = list.data ?? [];
  const active = all.filter((m) => m.is_active);
  const archived = all.filter((m) => !m.is_active);

  return (
    <>
      <PageHeader
        eyebrow="Tim & penugasan"
        title="Kelola Teknisi / Mekanik"
        subtitle="Tambah, ubah, dan hapus teknisi bengkel. Teknisi aktif otomatis ditugaskan ke booking dan panggilan darurat; rating ikut menentukan prioritas SOS."
        actions={list.data && <Badge tone="success">{active.length} aktif</Badge>}
      />
      <Card title="Tambah teknisi" icon="person_add" className="mb-6">
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input label="Nama" icon="person" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="mechanic-name" />
          <Input label="WhatsApp (opsional)" icon="call" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
          <Input label="Keahlian (pisahkan dengan koma)" value={f.specializations} onChange={(e) => setF({ ...f, specializations: e.target.value })} placeholder="matic, injeksi" />
          <Button type="submit" icon="add" loading={create.isPending} data-testid="mechanic-create">
            Tambah
          </Button>
        </form>
        {create.error && (
          <div className="mt-4">
            <Alert tone="danger">{errorMessage(create.error)}</Alert>
          </div>
        )}
      </Card>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : active.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((m) => (
            <MechanicTile key={m.id} m={m} task={tasks.get(m.id)}>
              <MechanicPhotoButton m={m} />
              <Button size="sm" variant="ghost" icon="edit" className="bg-surface-low" onClick={() => setEditing(m)} data-testid="mechanic-edit">
                Ubah
              </Button>
              <Button size="sm" variant="ghost" icon="delete" className="text-emergency-ink hover:bg-emergency-soft" onClick={() => setRemoving(m)} data-testid="mechanic-delete">
                Hapus
              </Button>
            </MechanicTile>
          ))}
        </div>
      ) : (
        <EmptyState icon="engineering">{archived.length ? 'Tidak ada teknisi aktif. Pulihkan dari arsip atau tambahkan teknisi baru.' : 'Belum ada teknisi. Tambahkan teknisi pertama di atas.'}</EmptyState>
      )}

      {archived.length > 0 && (
        <section className="mt-8">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="inline-flex items-center gap-1.5 font-label text-sm font-semibold text-primary hover:underline" aria-expanded={showArchived}>
            <Icon name={showArchived ? 'expand_less' : 'history'} /> {showArchived ? 'Sembunyikan' : 'Lihat'} arsip teknisi ({archived.length})
          </button>
          {showArchived && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {archived.map((m) => (
                <MechanicTile key={m.id} m={m}>
                  <Button size="sm" variant="secondary" icon="restore" loading={restore.isPending && restore.variables?.id === m.id} onClick={() => restore.mutate(m)}>
                    Pulihkan
                  </Button>
                </MechanicTile>
              ))}
            </div>
          )}
        </section>
      )}

      {editing && <EditMechanicModal m={editing} onClose={() => setEditing(null)} onSaved={() => void refresh()} />}
      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        icon="delete"
        tone="danger"
        title={`Hapus ${removing?.name ?? 'teknisi'}?`}
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={() => setRemoving(null)}>
              Batal
            </Button>
            <Button variant="danger" icon="delete" loading={remove.isPending} onClick={() => removing && remove.mutate(removing)} data-testid="mechanic-delete-confirm">
              Ya, hapus
            </Button>
          </>
        }
      >
        Teknisi tidak lagi menerima tugas booking maupun SOS. Riwayat pesanan dan rating tetap tersimpan, dan teknisi bisa dipulihkan dari arsip.
      </Modal>
    </>
  );
}

const tagsOf = (s: string) => [...new Set(s.split(',').map((t) => t.trim()).filter(Boolean))];

function MechanicTile({ m, task, children }: { m: Mechanic; task?: Order; children: ReactNode }) {
  return (
    <div className={cx('flex flex-col gap-4 rounded-xl border border-line bg-card p-5 shadow-sm', !m.is_active && 'opacity-70')} data-testid="mechanic-card">
      <div className="flex items-start gap-3">
        <MechanicAvatar m={m} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{m.name}</p>
          <p className="font-label text-xs text-ink-3">{m.phone || 'Tanpa nomor'}</p>
        </div>
        {!m.is_active ? <Badge>Diarsipkan</Badge> : task ? <Badge tone="info">Bertugas</Badge> : <Badge tone="success">Tersedia</Badge>}
      </div>
      {task && (
        <Link to={`/orders/${task.id}`} className={cx('rounded-lg px-3 py-2 font-label text-xs font-semibold', task.type === 'EMERGENCY' ? 'bg-emergency-soft text-emergency-ink' : 'bg-sky text-primary')}>
          {task.type === 'EMERGENCY' ? `SOS: ${splitPriceRange(task.emergency?.problem_description).text}` : `${task.booking?.service_name} · ${task.customer.name}`}
        </Link>
      )}
      <div className="flex flex-wrap gap-1.5">
        {m.specializations.length ? (
          m.specializations.map((s) => (
            <span key={s} className="rounded-md bg-sky px-2 py-1 font-label text-xs font-semibold text-primary">
              {s}
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-3">Belum ada tag keahlian</span>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <Stars value={m.avg_rating} count={m.total_reviews} />
        <div className="flex gap-1.5">{children}</div>
      </div>
    </div>
  );
}

function EditMechanicModal({ m, onClose, onSaved }: { m: Mechanic; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: m.name, phone: m.phone ?? '', specializations: m.specializations.join(', ') });
  const save = useMutation({
    // The API cannot clear a saved number, so an empty field keeps it.
    mutationFn: () => ownerApi.updateMechanic(m, { name: f.name.trim(), phone: f.phone.trim() || undefined, specializations: tagsOf(f.specializations) }),
    onSuccess: () => {
      onSaved();
      onClose();
      toast('Data teknisi diperbarui', { text: f.name.trim() });
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      icon="edit"
      title="Ubah data teknisi"
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button icon="save" loading={save.isPending} disabled={f.name.trim().length < 2} onClick={() => save.mutate()} data-testid="mechanic-save">
            Simpan
          </Button>
        </>
      }
    >
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.name.trim().length >= 2) save.mutate();
        }}
      >
        <Input label="Nama" icon="person" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Input label="WhatsApp" icon="call" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="08xxxxxxxxxx" hint={m.phone ? 'Kosongkan untuk tetap memakai nomor lama' : undefined} />
        <Input label="Keahlian" hint="Pisahkan dengan koma" value={f.specializations} onChange={(e) => setF({ ...f, specializations: e.target.value })} />
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <button type="submit" className="sr-only">
          Simpan
        </button>
      </form>
    </Modal>
  );
}


// ================================================================ calendar & quotas tab
export function OwnerQuotasPage() {
  const ws = useMyWorkshop();
  const approved = ws.data?.status === 'APPROVED';
  const [date, setDate] = useState(jakartaDate(1));
  // The API only serves quotas for approved workshops.
  const slots = useQuery({ queryKey: ['owner-quotas', date], queryFn: () => ownerApi.quotas(date), enabled: approved });
  const bookings = useQuery({ queryKey: ['owner-orders', 'bookings', date], queryFn: () => orderApi.workshop({ type: 'BOOKING', date, limit: 100 }), enabled: approved });
  const total = (slots.data ?? []).reduce((a, s) => ({ booked: a.booked + s.current_booked, max: a.max + s.max_slot_per_hour, wait: a.wait + s.waitlisted }), { booked: 0, max: 0, wait: 0 });

  return (
    <>
      <PageHeader eyebrow="Kalender & kuota" title="Kalender & Kuota Slot" subtitle="Ubah kapasitas jam tertentu (mis. ada mekanik tambahan). Antrean otomatis naik saat kapasitas ditambah." />
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-card p-4 shadow-sm sm:p-5">
        <DateStrip value={date} onChange={setDate} days={14} />
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-52">
            <Input label="Tanggal lain" type="date" icon="calendar_today" value={date} min={jakartaDate(0)} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <p className="pb-3 font-label text-xs text-ink-2">{friendlyDay(date)}</p>
          {slots.data && (
            <div className="ml-auto flex flex-wrap gap-2 pb-2 font-label text-sm">
              <Badge tone="info">
                {total.booked}/{total.max} terisi
              </Badge>
              {total.wait > 0 && <Badge tone="warning">{total.wait} daftar tunggu</Badge>}
            </div>
          )}
        </div>
      </div>
      {ws.data && !approved ? (
        <EmptyState icon="pending_actions">
          Kuota slot bisa diatur setelah bengkel diverifikasi admin. Status saat ini: <b>{WORKSHOP_STATUS[ws.data.status].label}</b>.
        </EmptyState>
      ) : ws.isLoading || slots.isLoading ? (
        <Loading />
      ) : slots.error ? (
        <Alert tone="danger">{errorMessage(slots.error)}</Alert>
      ) : (
        <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <SlotBoard date={date} slots={slots.data ?? []} bookings={bookings.data ?? []} highlightHour={date === jakartaDate(0) ? jakartaHour() : undefined} />
        </section>
      )}
    </>
  );
}

// ================================================================ settings tab (profile + services + QRIS)
const SECTIONS = ['profil', 'layanan', 'jadwal', 'foto', 'qris'] as const;
type Section = (typeof SECTIONS)[number];

export function OwnerProfilePage() {
  const qc = useQueryClient();
  const ws = useMyWorkshop();
  const [f, setF] = useState<Partial<OwnWorkshop>>({});
  const [point, setPoint] = useState<LatLng | null>(null);
  // QR codes need sharp edges: keep more pixels than photos do.
  const qrisPhoto = usePreparedImage({ maxSide: 2000 });
  const qris = qrisPhoto.file;
  // The tab follows the URL hash (#layanan, #jadwal, #foto, #qris), also when a link changes only the hash.
  const { hash } = useLocation();
  const navigate = useNavigate();
  const fromHash = (h: string): Section => (SECTIONS.includes(h as Section) ? (h as Section) : 'profil');
  const [section, setSectionState] = useState<Section>(() => fromHash(hash.slice(1)));
  useEffect(() => setSectionState(fromHash(hash.slice(1))), [hash]);
  const setSection = (next: Section) => {
    setSectionState(next);
    navigate({ hash: next === 'profil' ? '' : next }, { replace: true });
  };

  useEffect(() => {
    if (ws.data) {
      setF(ws.data);
      setPoint({ lat: ws.data.latitude, lng: ws.data.longitude });
    }
  }, [ws.data]);

  const save = useMutation({
    mutationFn: () =>
      ownerApi.updateProfile({
        name: f.name,
        description: f.description ?? undefined,
        address: f.address,
        phone: f.phone,
        open_time: f.open_time,
        close_time: f.close_time,
        max_slot_per_hour: Number(f.max_slot_per_hour),
        is_open: f.is_open,
        accepts_emergency: f.accepts_emergency,
        ...(point ? { latitude: point.lat, longitude: point.lng } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-workshop'] });
      toast('Profil bengkel tersimpan');
    },
  });
  const upload = useMutation({
    mutationFn: () => ownerApi.uploadQris(qris!),
    onSuccess: () => {
      qrisPhoto.reset();
      void qc.invalidateQueries({ queryKey: ['my-workshop'] });
      toast('QRIS tersimpan', { text: 'Pelanggan kini bisa membayar lewat QRIS bengkel Anda.' });
    },
  });

  if (ws.isLoading || !f.id) return <Loading />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Pengaturan" title="Pengaturan Bengkel" />
      <StatusNotice w={ws.data!} />
      <Segmented
        label="Bagian pengaturan"
        value={section}
        onChange={setSection}
        options={[
          { value: 'profil', label: 'Profil & Operasional', icon: 'storefront' },
          { value: 'layanan', label: 'Layanan Servis', icon: 'build' },
          { value: 'jadwal', label: 'Jadwal & Libur', icon: 'event_busy' },
          { value: 'foto', label: 'Foto', icon: 'photo_library' },
          { value: 'qris', label: 'QRIS Pembayaran', icon: 'qr_code_2' },
        ]}
      />

      {section === 'layanan' && <OwnerServicesPage embedded />}

      {section === 'jadwal' && ws.data && <OwnerScheduleSection w={ws.data} />}
      {section === 'foto' && <OwnerPhotosSection />}

      {section === 'qris' && (
        <Card title="QRIS pembayaran" icon="qr_code_2" subtitle="Gambar QRIS statis yang dipindai pelanggan saat membayar." actions={ws.data?.has_qris ? <Badge tone="success">Sudah diunggah</Badge> : <Badge tone="warning">Belum ada</Badge>}>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (qris) upload.mutate();
            }}
          >
            <div className="min-w-64 flex-1">
              <Input
                type="file"
                accept={ACCEPT_IMAGES}
                label="Gambar QRIS statis"
                hint="Foto JPG/PNG/WEBP. Foto di atas 2 MB diperkecil otomatis."
                data-testid="qris-input"
                onChange={(e) => {
                  upload.reset();
                  void qrisPhoto.choose(e.target.files?.[0]);
                }}
              />
            </div>
            <Button type="submit" icon="upload" disabled={!qris || qrisPhoto.busy} loading={upload.isPending || qrisPhoto.busy} data-testid="qris-submit">
              Unggah QRIS
            </Button>
          </form>
          {qrisPhoto.preview && (
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <img src={qrisPhoto.preview} alt="Pratinjau QRIS" className="max-h-56 rounded-lg border border-line bg-white object-contain p-2" />
              <p className="text-xs text-ink-2">
                Pratinjau sebelum diunggah. Pastikan kode QR terlihat jelas dan tidak terpotong.
                {qrisPhoto.image?.changed && (
                  <span className="block">
                    Diperkecil dari {fileSize(qrisPhoto.image.originalSize)} menjadi {fileSize(qrisPhoto.image.file.size)}.
                  </span>
                )}
              </p>
            </div>
          )}
          {qrisPhoto.error && (
            <div className="mt-4">
              <Alert tone="danger">{qrisPhoto.error}</Alert>
            </div>
          )}
          {upload.error && (
            <div className="mt-4">
              <Alert tone="danger">{errorMessage(upload.error)}</Alert>
            </div>
          )}
        </Card>
      )}

      {section === 'profil' && (
        <form
          className="grid gap-6 xl:grid-cols-[1fr_360px]"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex min-w-0 flex-col gap-6">
            <Card title="Informasi bengkel" icon="storefront">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Nama bengkel" value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
                <Input label="Telepon" icon="call" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <div className="sm:col-span-2">
                  <TextArea label="Alamat" value={f.address ?? ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Deskripsi" value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
                </div>
              </div>
            </Card>
            <Card title="Lokasi" icon="location_on" subtitle="Klik peta untuk memindahkan titik bengkel.">
              <MapPicker value={point} onChange={setPoint} height={300} />
            </Card>
          </div>
          <div className="flex flex-col gap-6">
            <Card title="Operasional" icon="schedule">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Jam buka" type="time" step={3600} value={f.open_time ?? ''} onChange={(e) => setF({ ...f, open_time: e.target.value })} />
                  <Input label="Jam tutup" type="time" step={3600} value={f.close_time ?? ''} onChange={(e) => setF({ ...f, close_time: e.target.value })} />
                </div>
                <Input
                  label="Kuota default per jam"
                  type="number"
                  min={1}
                  max={100}
                  value={f.max_slot_per_hour ?? 1}
                  onChange={(e) => setF({ ...f, max_slot_per_hour: Number(e.target.value) })}
                  hint="Berlaku untuk slot yang belum pernah dibooking"
                />
                <Toggle checked={!!f.is_open} onChange={(v) => setF({ ...f, is_open: v })} icon="door_open" label="Bengkel buka" hint="Menerima booking dari pelanggan" />
                <Toggle checked={!!f.accepts_emergency} onChange={(v) => setF({ ...f, accepts_emergency: v })} icon="e911_emergency" label="Siaga darurat SOS" hint="Masuk radar panggilan radius 5 km" />
              </div>
            </Card>
            {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
            <Button type="submit" size="lg" icon="save" loading={save.isPending}>
              Simpan profil
            </Button>
            <p className="text-center font-label text-xs text-ink-3">Terakhir dibuat {dateTime(ws.data!.created_at)}</p>
          </div>
        </form>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: ReactNode; icon: string }) {
  return (
    <label className={cx('flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition', checked ? 'border-primary/40 bg-sky/50' : 'border-line')}>
      <Icon name={icon} className={checked ? 'text-primary' : 'text-ink-3'} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink-3">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-line-strong transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

// ================================================================ reviews (owner replies)
export function OwnerReviewsPage() {
  const ws = useMyWorkshop();
  const list = useQuery({ queryKey: ['owner-reviews'], queryFn: () => ownerApi.reviews({ limit: 100 }) });
  const reviews = list.data ?? [];
  const unanswered = reviews.filter((r) => !r.owner_reply).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reputasi"
        title="Ulasan Pelanggan"
        subtitle="Balasan Anda tampil publik di bawah ulasan, di halaman bengkel."
        actions={ws.data && <Stars value={ws.data.avg_rating} count={ws.data.total_reviews} />}
      />
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : reviews.length ? (
        <>
          {unanswered > 0 && <Alert tone="info">{unanswered} ulasan belum dibalas.</Alert>}
          <ul className="flex flex-col gap-4">
            {reviews.map((r) => (
              <ReviewReplyCard key={r.id} review={r} />
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon="reviews">Belum ada ulasan. Ulasan muncul setelah pelanggan menyelesaikan pesanan.</EmptyState>
      )}
    </div>
  );
}

function ReviewReplyCard({ review: r }: { review: Review }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(!r.owner_reply);
  const [text, setText] = useState(r.owner_reply ?? '');
  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ['owner-reviews'] });
    toast(msg);
  };
  const save = useMutation({
    mutationFn: () => ownerApi.replyReview(r.id, text.trim()),
    onSuccess: () => {
      setEditing(false);
      done('Balasan tersimpan');
    },
  });
  const remove = useMutation({
    mutationFn: () => ownerApi.deleteReply(r.id),
    onSuccess: () => {
      setText('');
      setEditing(true);
      done('Balasan dihapus');
    },
  });
  return (
    <li className="rounded-xl border border-line bg-card p-5 shadow-sm" data-testid="owner-review">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-navy">{r.customer_name}</p>
          <p className="font-label text-xs text-ink-3">
            {dateTime(r.created_at)}
            {r.mechanic_name && ` · Mekanik: ${r.mechanic_name}`}
          </p>
        </div>
        <StarRow rating={r.rating} />
      </div>
      {r.comment ? <p className="mt-2 text-sm text-navy">{r.comment}</p> : <p className="mt-2 text-sm text-ink-3">Tanpa komentar.</p>}
      {editing ? (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 2) save.mutate();
          }}
        >
          <TextArea label="Balasan Anda" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Terima kasih atas ulasannya…" data-testid="review-reply-input" />
          {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" icon="send" disabled={text.trim().length < 2} loading={save.isPending} data-testid="review-reply-save">
              Kirim balasan
            </Button>
            {r.owner_reply && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Batal
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-lg border-l-2 border-primary bg-sky/60 px-3 py-2">
          <p className="font-label text-[11px] font-bold text-primary">Balasan Anda{r.replied_at && ` · ${dateTime(r.replied_at)}`}</p>
          <p className="text-sm text-navy">{r.owner_reply}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>
              Ubah
            </Button>
            <Button size="sm" variant="ghost" icon="delete" className="text-emergency-ink" loading={remove.isPending} onClick={() => remove.mutate()}>
              Hapus balasan
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

// ================================================================ schedule: weekly closed days, break, holidays
const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function OwnerScheduleSection({ w }: { w: OwnWorkshop }) {
  const qc = useQueryClient();
  const [closed, setClosed] = useState<number[]>(w.closed_weekdays ?? []);
  const [hasBreak, setHasBreak] = useState(!!w.break_start);
  const [brk, setBrk] = useState({ start: w.break_start ?? '12:00', end: w.break_end ?? '13:00' });
  const [holiday, setHoliday] = useState({ date: jakartaDate(7), note: '' });
  const holidays = useQuery({ queryKey: ['owner-holidays'], queryFn: ownerApi.holidays });
  const badBreak = hasBreak && brk.start >= brk.end;
  const save = useMutation({
    mutationFn: () => ownerApi.setSchedule({ closed_weekdays: closed, break_start: hasBreak ? brk.start : null, break_end: hasBreak ? brk.end : null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-workshop'] });
      toast('Jadwal tersimpan', { text: 'Slot booking pada hari tutup dan jam istirahat otomatis tidak bisa dipilih.' });
    },
  });
  const addHoliday = useMutation({
    mutationFn: () => ownerApi.addHoliday({ date: holiday.date, note: holiday.note.trim() || undefined }),
    onSuccess: () => {
      setHoliday({ ...holiday, note: '' });
      void qc.invalidateQueries({ queryKey: ['owner-holidays'] });
      toast('Hari libur ditambahkan', { text: longDate(holiday.date) });
    },
  });
  const removeHoliday = useMutation({
    mutationFn: (id: string) => ownerApi.deleteHoliday(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['owner-holidays'] }),
  });
  const upcoming = (holidays.data ?? []).filter((h) => h.holiday_date >= jakartaDate(0));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title="Jadwal mingguan" icon="calendar_view_week" subtitle={`Jam buka ${w.open_time}–${w.close_time}. Ubah jam buka di tab Profil & Operasional.`}>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!badBreak) save.mutate();
          }}
        >
          <fieldset>
            <legend className="mb-2 font-label text-xs font-semibold">Hari tutup</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d, i) => {
                const on = closed.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setClosed(on ? closed.filter((x) => x !== i) : [...closed, i].sort())}
                    className={cx('h-9 rounded-lg border px-3 font-label text-xs font-semibold transition', on ? 'border-emergency bg-emergency-soft text-emergency-ink' : 'border-line bg-white text-navy hover:border-primary/50')}
                    data-testid={`closed-day-${i}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink-3">{closed.length ? `Tutup setiap ${closed.map((i) => WEEKDAYS[i]).join(', ')}.` : 'Buka setiap hari.'}</p>
          </fieldset>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-navy">
              <input type="checkbox" checked={hasBreak} onChange={(e) => setHasBreak(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" data-testid="break-toggle" />
              Ada jam istirahat
            </label>
            {hasBreak && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Mulai" type="time" step={900} value={brk.start} onChange={(e) => setBrk({ ...brk, start: e.target.value })} />
                <Input label="Selesai" type="time" step={900} value={brk.end} onChange={(e) => setBrk({ ...brk, end: e.target.value })} error={badBreak ? 'Harus setelah jam mulai' : undefined} />
              </div>
            )}
            <p className="text-xs text-ink-3">Slot per jam yang bersinggungan dengan jam istirahat tidak bisa dibooking.</p>
          </div>
          {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
          <Button type="submit" icon="save" className="self-start" disabled={badBreak} loading={save.isPending} data-testid="schedule-save">
            Simpan jadwal
          </Button>
        </form>
      </Card>

      <Card title="Hari libur" icon="event_busy" subtitle="Tanggal tertentu bengkel tutup, mis. cuti bersama.">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            addHoliday.mutate();
          }}
        >
          <Input label="Tanggal" type="date" min={jakartaDate(0)} required value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} data-testid="holiday-date" />
          <div className="min-w-40 flex-1">
            <Input label="Keterangan (opsional)" maxLength={150} value={holiday.note} onChange={(e) => setHoliday({ ...holiday, note: e.target.value })} placeholder="Cuti bersama" />
          </div>
          <Button type="submit" icon="add" loading={addHoliday.isPending} data-testid="holiday-add">
            Tambah
          </Button>
        </form>
        {addHoliday.error && (
          <div className="mt-3">
            <Alert tone="danger">{errorMessage(addHoliday.error)}</Alert>
          </div>
        )}
        <ul className="mt-4 flex flex-col divide-y divide-line" data-testid="holiday-list">
          {upcoming.length ? (
            upcoming.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  <span className="font-semibold text-navy">{longDate(h.holiday_date)}</span>
                  {h.note && <span className="ml-2 text-sm text-ink-2">{h.note}</span>}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="delete"
                  className="text-emergency-ink"
                  loading={removeHoliday.isPending && removeHoliday.variables === h.id}
                  onClick={() => removeHoliday.mutate(h.id)}
                  aria-label={`Hapus libur ${longDate(h.holiday_date)}`}
                >
                  Hapus
                </Button>
              </li>
            ))
          ) : (
            <li className="py-2.5 text-sm text-ink-3">Belum ada hari libur terjadwal.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

// ================================================================ photos
function OwnerPhotosSection() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['owner-photos'], queryFn: ownerApi.photos });
  const photo = usePreparedImage();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['owner-photos'] });
    void qc.invalidateQueries({ queryKey: ['workshop'] });
  };
  const upload = useMutation({
    mutationFn: () => ownerApi.addPhoto(photo.file!),
    onSuccess: () => {
      photo.reset();
      refresh();
      toast('Foto ditambahkan');
    },
  });
  const cover = useMutation({ mutationFn: (id: string) => ownerApi.setCoverPhoto(id), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => ownerApi.deletePhoto(id), onSuccess: refresh });
  const photos = list.data ?? [];
  const full = photos.length >= 10;

  return (
    <Card
      title="Foto bengkel"
      icon="photo_library"
      subtitle="Tampil di halaman bengkel untuk pelanggan. Maks. 10 foto; foto sampul tampil paling depan."
      actions={<Badge tone={photos.length ? 'success' : 'warning'}>{photos.length}/10</Badge>}
    >
      <div className="flex flex-col gap-5">
        {!full && (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (photo.file) upload.mutate();
            }}
          >
            <div className="min-w-64 flex-1">
              <Input
                type="file"
                accept={ACCEPT_IMAGES}
                label="Tambah foto"
                hint="Tampak depan, area servis, ruang tunggu. Foto besar diperkecil otomatis."
                onChange={(e) => void photo.choose(e.target.files?.[0])}
                data-testid="photo-input"
              />
            </div>
            <Button type="submit" icon="upload" disabled={!photo.file || photo.busy} loading={upload.isPending || photo.busy} data-testid="photo-upload">
              Unggah foto
            </Button>
          </form>
        )}
        {photo.error && <Alert tone="danger">{photo.error}</Alert>}
        {upload.error && <Alert tone="danger">{errorMessage(upload.error)}</Alert>}
        {photos.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="photo-grid">
            {photos.map((p) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-card">
                <img src={apiAsset(p.url)!} alt="Foto bengkel" className="aspect-[4/3] w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-1 p-2">
                  {p.is_cover ? (
                    <Badge tone="success">Sampul</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" className="px-2" loading={cover.isPending && cover.variables === p.id} onClick={() => cover.mutate(p.id)}>
                      Jadikan sampul
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="delete"
                    className="px-2 text-emergency-ink"
                    loading={remove.isPending && remove.variables === p.id}
                    onClick={() => remove.mutate(p.id)}
                    aria-label="Hapus foto"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="add_photo_alternate">Belum ada foto. Bengkel dengan foto lebih dipercaya pelanggan.</EmptyState>
        )}
      </div>
    </Card>
  );
}

/** Mechanic photo when uploaded (served publicly once the workshop is approved), else the initial. */
function MechanicAvatar({ m }: { m: Mechanic }) {
  const [broken, setBroken] = useState(false);
  const src = m.has_photo && m.workshop_id ? apiAsset(`/workshops/${m.workshop_id}/mechanics/${m.id}/photo`) : null;
  if (src && !broken) {
    return <img src={src} alt={`Foto ${m.name}`} onError={() => setBroken(true)} className="h-12 w-12 shrink-0 rounded-full object-cover" data-testid="mechanic-photo" />;
  }
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy text-lg font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>;
}

function MechanicPhotoButton({ m }: { m: Mechanic }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const prepared = await prepareImage(file, { maxSide: 800 });
      return ownerApi.setMechanicPhoto(m.id, prepared.file);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['owner-mechanics'] });
      toast('Foto teknisi diperbarui', { text: m.name });
    },
    onError: (e) => toast('Foto gagal diunggah', { tone: 'danger', text: e instanceof ImageCheckError ? e.message : errorMessage(e) }),
  });
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_IMAGES}
        className="sr-only"
        aria-label={`Foto ${m.name}`}
        data-testid="mechanic-photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
          e.target.value = '';
        }}
      />
      <Button size="sm" variant="ghost" icon="photo_camera" className="bg-surface-low" loading={upload.isPending} onClick={() => input.current?.click()} aria-label={`Ganti foto ${m.name}`} />
    </>
  );
}

/** Today's numbers computed by the server (GET /workshops/me/stats). */
function OwnerTodayStrip() {
  const { data: s } = useQuery({ queryKey: ['owner-stats'], queryFn: () => ownerApi.stats(), refetchInterval: 60_000 });
  if (!s) return null;
  const items = [
    { icon: 'payments', label: 'Pendapatan terverifikasi hari ini', value: rupiah(s.verified_revenue) },
    { icon: 'receipt_long', label: 'Bukti bayar menunggu', value: String(s.payments_to_verify) },
    { icon: 'event_available', label: 'Booking hari ini', value: `${s.bookings}${s.waitlisted ? ` (+${s.waitlisted} antre)` : ''}` },
    { icon: 'percent', label: 'Utilisasi kuota', value: s.quota_utilization == null ? '–' : `${Math.round(s.quota_utilization * 100)}%` },
  ];
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-line bg-card px-5 py-3 text-sm shadow-sm" data-testid="owner-today">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <Icon name={i.icon} className="text-[18px] text-primary" />
          <span className="text-ink-2">{i.label}:</span>
          <b className="text-navy tabular-nums">{i.value}</b>
        </li>
      ))}
    </ul>
  );
}
