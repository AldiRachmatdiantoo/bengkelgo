import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Order, OrderStatus } from '@/services/api/types';
import { useAuth } from '@/services/auth/AuthProvider';
import {
  BookingHero,
  BookingPass,
  CalendarSyncCard,
  CancelOrderModal,
  RescheduleModal,
  StatusHistoryCard,
  canReschedule,
  CustomerPaymentPanel,
  EmergencyCostCard,
  EmergencyHeader,
  EmergencyMapCard,
  EmergencyProblemCard,
  EmergencyTimeline,
  MechanicCard,
  OrderCard,
  OrderReceipt,
  OrderStatusBadge,
  OwnerOrderActions,
  PageBackLink,
  ProofUploadCard,
  QrisPayCard,
  ReviewForm,
  SafetyBanner,
  WorkshopContactCard,
  canUploadProof,
} from '@/components/orders/OrderComponents';
import { PointsMap } from '@/components/map/Maps';
import { slotRange, vehicleIcon, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { Alert, CopyButton, EmptyState, Icon, Loading, PageHeader, Segmented, Stepper, toast } from '@/components/ui';
import { longDate, rupiah } from '@/utils/format';

const LIVE: OrderStatus[] = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'CONFIRMED', 'IN_QUEUE'];
type Filter = 'ALL' | 'ACTIVE' | 'DONE' | 'CANCELLED';

export function MyOrdersPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, isLoading, error } = useQuery({ queryKey: ['my-orders'], queryFn: () => orderApi.mine({ limit: 50 }) });
  // Cancelled orders are hidden from the main lists and only appear under "Riwayat dibatalkan".
  const cancelled = (data ?? []).filter((o) => o.status === 'CANCELLED');
  const visible = (data ?? []).filter((o) => o.status !== 'CANCELLED');
  const shown =
    filter === 'CANCELLED' ? cancelled : visible.filter((o) => (filter === 'ALL' ? true : filter === 'ACTIVE' ? LIVE.includes(o.status) : !LIVE.includes(o.status)));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Akun saya"
        title="Riwayat & Status Servis"
        subtitle="Tiket booking, status bantuan darurat, dan pembayaran Anda."
        actions={
          <Link to="/workshops?tab=booking" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 font-label text-sm font-semibold text-white hover:bg-primary-dark">
            <Icon name="add" /> Booking baru
          </Link>
        }
      />
      <div className="mb-5">
        <Segmented
          label="Filter pesanan"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'ALL', label: 'Semua' },
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'DONE', label: 'Selesai' },
            { value: 'CANCELLED', label: `Riwayat dibatalkan${cancelled.length ? ` (${cancelled.length})` : ''}`, icon: 'history' },
          ]}
        />
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
        <EmptyState
          icon="receipt_long"
          action={
            <Link to="/workshops" className="font-label text-sm font-semibold text-primary hover:underline">
              Cari bengkel
            </Link>
          }
        >
          {filter === 'CANCELLED' ? 'Belum ada pesanan yang dibatalkan.' : data?.length ? 'Tidak ada pesanan pada filter ini.' : 'Belum ada pesanan. Booking servis pertama Anda sekarang.'}
        </EmptyState>
      )}
    </div>
  );
}

function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.detail(id),
    // Live status updates (emergency dispatch, waitlist promotion, payment verification)
    refetchInterval: (q) => (q.state.data && LIVE.includes(q.state.data.status) ? 5000 : false),
  });
}

/** Step 4 of the booking flow: pay the workshop's QRIS and upload the proof (Stitch "Konfirmasi & Pembayaran QRIS"). */
export function PaymentPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(id);

  if (isLoading) return <Loading />;
  if (error || !order) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (user?.id !== order.customer_id || !canUploadProof(order)) return <Navigate to={`/orders/${order.id}`} replace />;
  const b = order.booking;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-card px-4 py-4 shadow-sm sm:px-6">
        <Stepper steps={['Bengkel & Paket', 'Jadwal & Slot', 'Kendaraan & Data', 'Bayar & QRIS']} current={3} />
      </div>

      <section className="flex flex-col gap-4 overflow-hidden rounded-xl border border-warning/30 bg-[linear-gradient(90deg,#fef3c7_0%,#fffbeb_60%,#ffffff_100%)] p-5 shadow-sm sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning-ink ring-1 ring-warning/30">
          <Icon name="schedule" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-headline-sm text-navy">Selesaikan Pembayaran Sebelum Datang</p>
          <p className="text-sm text-ink-2">
            {b ? (
              <>
                Slot <b>{longDate(b.booking_date)}, {slotRange(b.time_slot)} WIB</b> (antrean <b>#{b.queue_number}</b>) sudah tercatat atas nama Anda.
              </>
            ) : (
              'Pesanan Anda sudah tercatat.'
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-white/80 px-4 py-2 ring-1 ring-line">
          <div>
            <p className="font-label text-[10px] font-bold tracking-[0.04em] text-ink-3 uppercase">Kode reservasi</p>
            <p className="font-mono text-sm font-bold text-navy">{order.order_number}</p>
          </div>
          <CopyButton text={order.order_number} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <QrisPayCard order={order} />
          <ProofUploadCard order={order} onUploaded={() => navigate(`/orders/${order.id}`)} />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-xl border border-line bg-card p-5 shadow-lift">
            <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Ringkasan pemesanan</p>
            <h2 className="mt-1 text-headline-sm text-navy">{order.workshop?.name}</h2>
            <p className="font-label text-xs text-ink-2">{order.workshop?.address}</p>
            <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
              {b && (
                <SummaryLine icon="calendar_today" label="Waktu servis terjadwal">
                  {longDate(b.booking_date)}
                  <span className="block font-label text-xs font-normal text-ink-2">{slotRange(b.time_slot)} WIB</span>
                </SummaryLine>
              )}
              <SummaryLine icon="build" label="Antrean & mekanik">
                {b && <span className="mr-2 rounded-md bg-sky px-1.5 py-0.5 font-label text-xs font-bold text-primary">Antrean #{b.queue_number}</span>}
                <span className="font-label text-xs font-normal text-ink-2">{order.mechanic ? `Mekanik: ${order.mechanic.name}` : 'Mekanik ditugaskan bengkel'}</span>
              </SummaryLine>
              <SummaryLine icon={vehicleIcon(order.vehicle_type)} label="Kendaraan">
                {vehicleLabel(order.vehicle_type)}
                {order.vehicle_plate && <span className="ml-2 font-mono text-xs text-ink-2">{order.vehicle_plate}</span>}
              </SummaryLine>
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
              <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Rincian paket &amp; biaya</p>
              <div className="flex justify-between gap-3">
                <span className="text-navy">{b?.service_name ?? 'Layanan'}</span>
                <span className="font-semibold text-navy">{rupiah(order.total_amount)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-2">Biaya layanan platform</span>
                <span className="font-bold text-success">GRATIS (Rp0)</span>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
              <div>
                <p className="font-label text-[11px] text-ink-3">Total biaya reservasi</p>
                <p className="text-[21px] leading-tight font-extrabold text-primary">{rupiah(order.total_amount)}</p>
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <p className="mb-3 font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Perlindungan pengendara</p>
            <ul className="space-y-3 text-sm">
              {[
                ['verified', 'Bengkel terverifikasi', 'Mitra diverifikasi admin sebelum tampil ke pelanggan.'],
                ['receipt_long', 'Tercatat di sistem', 'Bukti bayar dan status pembayaran tersimpan di pesanan Anda.'],
                ['cancel', 'Bisa dibatalkan', 'Selama belum dikerjakan dan pembayaran belum diverifikasi.'],
              ].map(([icon, t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                    <Icon name={icon} className="text-[18px]" />
                  </span>
                  <span>
                    <span className="block font-bold text-navy">{t}</span>
                    <span className="block text-xs text-ink-2">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            {order.workshop && (
              <a href={`tel:${order.workshop.phone}`} className="mt-4 flex items-center gap-3 rounded-lg bg-surface-low p-3 hover:bg-surface">
                <Icon name="support_agent" className="text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-navy">Butuh bantuan pembayaran?</span>
                  <span className="block font-label text-xs text-ink-2">Hubungi bengkel {order.workshop.phone}</span>
                </span>
                <Icon name="chevron_right" className="text-ink-3" />
              </a>
            )}
          </section>
          <Link to={`/orders/${order.id}`} className="text-center font-label text-sm font-semibold text-primary hover:underline">
            Bayar nanti, lihat tiket booking
          </Link>
        </aside>
      </div>
    </div>
  );
}

function SummaryLine({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 text-primary" />
      <div className="min-w-0">
        <p className="font-label text-[11px] text-ink-3">{label}</p>
        <div className="font-semibold text-navy">{children}</div>
      </div>
    </div>
  );
}

/** Shared by customer/guest (ticket, pay, review) and workshop owner (respond, progress, verify). */
export function OrderDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(id);
  const cancel = useMutation({
    mutationFn: (reason?: string) => orderApi.cancel(id, reason || undefined),
    onSuccess: () => {
      setConfirmCancel(false);
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void qc.invalidateQueries({ queryKey: ['my-orders'] });
      toast('Pesanan dibatalkan', { text: 'Pesanan dipindah ke Riwayat dibatalkan.' });
      navigate('/orders');
    },
  });

  if (isLoading) return <Loading />;
  if (error || !order) return <Alert tone="danger">{errorMessage(error)}</Alert>;

  const isOwner = user?.role === 'WORKSHOP_OWNER';
  const isCustomer = user?.id === order.customer_id;
  // Paid orders, or orders whose payment proof is still being checked, can only be cancelled by the workshop.
  const cancellable =
    isCustomer && ['PENDING', 'CONFIRMED', 'IN_QUEUE', 'ACCEPTED'].includes(order.status) && !['VERIFIED', 'PENDING_VERIFICATION'].includes(order.payment.status);
  const emergency = order.type === 'EMERGENCY';

  const cancelModal = (
    <CancelOrderModal open={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={(reason) => cancel.mutate(reason)} loading={cancel.isPending} emergency={emergency} mechanicName={order.mechanic?.name} />
  );

  if (isOwner) return <OwnerOrderView order={order} />;

  if (emergency && order.emergency) {
    const live = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(order.status);
    return (
      <div className="flex flex-col gap-6">
        <EmergencyHeader order={order} />
        {cancel.error && <Alert tone="danger">{errorMessage(cancel.error)}</Alert>}
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="flex min-w-0 flex-col gap-6">
            <EmergencyMapCard order={order} />
            <EmergencyTimeline order={order} />
            {isCustomer && <CustomerPaymentPanel order={order} />}
            {isCustomer && <ReviewForm order={order} />}
          </div>
          <div className="flex flex-col gap-6">
            <MechanicCard order={order} />
            <EmergencyProblemCard order={order} />
            <EmergencyCostCard order={order} />
            {!order.mechanic && <WorkshopContactCard order={order} />}
            <StatusHistoryCard order={order} />
          </div>
        </div>
        {(live || cancellable) && <SafetyBanner onCancel={cancellable ? () => setConfirmCancel(true) : undefined} cancelling={cancel.isPending} />}
        <PageBackLink to="/orders">Lihat riwayat &amp; status servis saya</PageBackLink>
        {cancelModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BookingHero order={order} />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          {order.booking && order.status !== 'CANCELLED' && <BookingPass order={order} />}
          {isCustomer && order.payment.status !== 'VERIFIED' && <CustomerPaymentPanel order={order} />}
          {isCustomer && <ReviewForm order={order} />}
          <WorkshopContactCard order={order} />
        </div>
        <div className="flex flex-col gap-6">
          <OrderReceipt order={order} />
          <StatusHistoryCard order={order} />
        </div>
      </div>
      <CalendarSyncCard order={order} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-5 py-4 shadow-sm" data-print-hide>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <PageBackLink to="/">Kembali ke Beranda</PageBackLink>
          {isCustomer && canReschedule(order) && (
            <button type="button" onClick={() => setRescheduling(true)} className="inline-flex items-center gap-1 font-label text-sm font-semibold text-primary hover:underline" data-testid="reschedule-open">
              <Icon name="event_repeat" /> Ganti jadwal
            </button>
          )}
          {cancellable && (
            <button type="button" onClick={() => setConfirmCancel(true)} className="inline-flex items-center gap-1 font-label text-sm font-semibold text-emergency-ink hover:underline">
              <Icon name="event_busy" /> Batalkan booking
            </button>
          )}
        </div>
        <Link to="/orders" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-sky px-4 font-label text-sm font-semibold text-primary hover:bg-primary-fixed/60">
          <Icon name="receipt_long" /> Lihat Riwayat &amp; Status Servis Saya
        </Link>
      </div>
      {cancel.error && <Alert tone="danger">{errorMessage(cancel.error)}</Alert>}
      {cancelModal}
      {isCustomer && canReschedule(order) && <RescheduleModal order={order} open={rescheduling} onClose={() => setRescheduling(false)} />}
    </div>
  );
}

function OwnerOrderView({ order }: { order: Order }) {
  const emergency = order.type === 'EMERGENCY' && order.emergency;
  return (
    <div className="flex flex-col gap-6">
      <PageBackLink to={emergency ? '/owner/emergency' : '/owner/orders'}>{emergency ? 'Kembali ke panggilan darurat' : 'Kembali ke pesanan masuk'}</PageBackLink>
      <PageHeader
        eyebrow={emergency ? 'Panggilan darurat' : 'Booking servis'}
        title={order.order_number}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge order={order} /> {order.customer.name}
            {order.customer.phone && (
              <a href={`tel:${order.customer.phone}`} className="inline-flex items-center gap-1 font-label text-sm font-semibold text-primary">
                <Icon name="call" className="text-[16px]" /> {order.customer.phone}
              </a>
            )}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex min-w-0 flex-col gap-6">
          <OwnerOrderActions order={order} />
          {emergency && (
            <PointsMap
              origin={{ lat: order.emergency!.latitude, lng: order.emergency!.longitude }}
              originLabel="Titik mogok pelanggan"
              points={order.workshop ? [{ id: order.workshop.id, lat: order.workshop.latitude, lng: order.workshop.longitude, label: order.workshop.name, highlight: true }] : []}
              route
              labels
              height={300}
            />
          )}
          {emergency ? <EmergencyTimeline order={order} /> : order.booking && <BookingPass order={order} />}
        </div>
        <div className="flex flex-col gap-6">
          {emergency && <EmergencyProblemCard order={order} />}
          <OrderReceipt order={order} />
          <StatusHistoryCard order={order} />
        </div>
      </div>
    </div>
  );
}
