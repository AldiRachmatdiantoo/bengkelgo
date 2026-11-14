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
import { dotTime, shortDate, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { BottomBar, NoteBox, ScreenHeader, ScreenLink, ScreenSection, ScreenTopBar, SummaryCard } from '@/components/ui/screen';
import { Alert, CopyButton, EmptyState, Icon, PageHeader, Segmented, toast, SkeletonList, SkeletonPage } from '@/components/ui';
import { rupiah } from '@/utils/format';

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
          <Link to="/workshops?tab=booking" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-5 font-label text-sm font-semibold text-on-primary hover:bg-primary-dark">
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
        <SkeletonList rows={4} />
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

/** Pay the workshop's QRIS and send the proof (Figma "Pembayaran"). */
export function PaymentPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(id);

  if (isLoading) return <SkeletonPage />;
  if (error || !order) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  if (user?.id !== order.customer_id || !canUploadProof(order)) return <Navigate to={`/orders/${order.id}`} replace />;
  const b = order.booking;

  return (
    <div className="mx-auto w-full max-w-xl">
      <ScreenHeader back={`/orders/${order.id}`} backLabel="Lihat tiket booking" title="Pembayaran" subtitle="Bayar ke QRIS bengkel, lalu kirim buktinya." />

      <NoteBox tone="warning" title="Menunggu pembayaran">
        {b ? (
          <>
            Jam {shortDate(b.booking_date)}, {dotTime(b.time_slot)} WIB (antrean #{b.queue_number}) sudah tercatat atas nama Anda.
          </>
        ) : (
          'Pesanan Anda sudah tercatat.'
        )}
      </NoteBox>

      <div className="mt-4">
        <QrisPayCard order={order} />
      </div>

      <ScreenSection title="Ringkasan booking" className="mt-6">
        <SummaryCard
          rows={[
            ['Bengkel', order.workshop?.name ?? '-'],
            b && ['Layanan', b.service_name],
            ['Kendaraan', [vehicleLabel(order.vehicle_type), order.vehicle_plate].filter(Boolean).join(' · ')],
            b && ['Jadwal', `${shortDate(b.booking_date)} · ${dotTime(b.time_slot)} WIB`],
            [
              'Kode pesanan',
              <span key="code" className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                <span className="whitespace-nowrap">{order.order_number}</span>
                <CopyButton text={order.order_number} label="Salin" className="h-8 px-2" />
              </span>,
            ],
            ['Total', rupiah(order.total_amount)],
          ]}
        />
      </ScreenSection>

      <ScreenSection title="Bukti pembayaran">
        <ProofUploadCard order={order} onUploaded={() => navigate(`/orders/${order.id}`)} />
      </ScreenSection>

      <Link to={`/orders/${order.id}`} className="mt-5 flex min-h-11 items-center justify-center text-sm font-bold text-primary hover:underline">
        Bayar nanti, lihat tiket booking
      </Link>
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

  if (isLoading) return <SkeletonPage />;
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
        <ScreenTopBar back="/orders" backLabel="Kembali ke pesanan saya" />
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

  const b = order.booking;
  const pay = isCustomer && canUploadProof(order);
  const subtitle = b ? `${b.service_name} di ${order.workshop?.name ?? 'bengkel'}.` : `Pesanan ${order.order_number}.`;

  return (
    <div className="mx-auto w-full max-w-xl">
      <ScreenHeader back="/orders" backLabel="Kembali ke pesanan saya" title="Status pesanan" subtitle={subtitle} />
      <div className="flex flex-col gap-6">
        <BookingHero order={order} />
        {b && order.status !== 'CANCELLED' && <BookingPass order={order} />}
        <StatusHistoryCard order={order} />
        <MechanicCard order={order} />
        {isCustomer && order.payment.status !== 'VERIFIED' && !pay && <CustomerPaymentPanel order={order} />}
        {isCustomer && <ReviewForm order={order} />}
        <OrderReceipt order={order} />
        <WorkshopContactCard order={order} />
        {isCustomer && (canReschedule(order) || cancellable) && (
          <div className="flex gap-2" data-print-hide>
            {canReschedule(order) && (
              <button
                type="button"
                onClick={() => setRescheduling(true)}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink hover:bg-surface"
                data-testid="reschedule-open"
              >
                <Icon name="event_repeat" className="text-primary" /> Ganti jadwal
              </button>
            )}
            {cancellable && (
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-card px-3 text-sm font-bold text-emergency-ink hover:bg-surface"
              >
                <Icon name="event_busy" /> Batalkan booking
              </button>
            )}
          </div>
        )}
        {cancel.error && <Alert tone="danger">{errorMessage(cancel.error)}</Alert>}
      </div>
      {pay ? (
        <BottomBar caption="Total bayar" amount={rupiah(order.payment.amount || order.total_amount)}>
          <ScreenLink to={`/orders/${order.id}/pay`} data-testid="pay-now">
            Bayar sekarang →
          </ScreenLink>
        </BottomBar>
      ) : (
        order.workshop &&
        order.status !== 'CANCELLED' && (
          <BottomBar>
            <a
              href={`tel:${order.workshop.phone}`}
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-subtitle font-bold text-on-primary transition hover:bg-primary-dark"
            >
              <Icon name="call" /> Telepon bengkel
            </a>
          </BottomBar>
        )
      )}
      {cancelModal}
      {isCustomer && canReschedule(order) && <RescheduleModal order={order} open={rescheduling} onClose={() => setRescheduling(false)} />}
    </div>
  );
}


function OwnerOrderView({ order }: { order: Order }) {
  const emergency = order.type === 'EMERGENCY' && order.emergency;
  return (
    <div className="flex flex-col gap-6">
      <ScreenTopBar back={emergency ? '/owner/emergency' : '/owner/orders'} backLabel={emergency ? 'Kembali ke panggilan darurat' : 'Kembali ke pesanan masuk'} />
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
