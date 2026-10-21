import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiAsset, bookingApi, vehicleApi, workshopApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import { useAuth } from '@/services/auth/AuthProvider';
import { directionsUrl, type LatLng } from '@/components/map/Maps';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  DateStrip,
  MechanicList,
  ReviewList,
  ServicePicker,
  SlotPicker,
  addMinutes,
  friendlyDay,
  slotRange,
  vehicleIcon,
  vehicleLabel,
} from '@/components/workshop/WorkshopComponents';
import { Alert, Badge, Button, Card, Icon, Input, Loading, MissingFields, Select, Stars, Stepper, TextArea, cx } from '@/components/ui';
import { distance, jakartaDate, longDate, rupiah, vehicleName } from '@/utils/format';

/** Straight-line distance in meters (haversine), for "x km dari lokasi Anda". */
function metersBetween(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STEPS = ['Bengkel & Paket', 'Pilih Jadwal', 'Kendaraan & Catatan', 'Bayar & QRIS'];

/** Unfinished booking choices survive the detour through /login (per tab, cleared after booking). */
type Draft = { serviceId: string; date: string; slot: string; plate: string; notes: string };
const draftKey = (workshopId: string) => `booking-draft:${workshopId}`;
function readDraft(workshopId: string): Partial<Draft> {
  try {
    const d = JSON.parse(sessionStorage.getItem(draftKey(workshopId)) ?? '{}') as Partial<Draft>;
    return d.date && d.date >= jakartaDate(0) ? d : {};
  } catch {
    return {};
  }
}
function writeDraft(workshopId: string, d: Draft | null) {
  try {
    if (d) sessionStorage.setItem(draftKey(workshopId), JSON.stringify(d));
    else sessionStorage.removeItem(draftKey(workshopId));
  } catch {
    // Storage unavailable (private mode): the user just picks again.
  }
}

function Section({ n, id, title, subtitle, action, children }: { n: number; id?: string; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-headline-sm text-navy">
            <Icon name={n === 1 ? 'calendar_month' : n === 2 ? 'schedule' : 'directions_car'} className="text-primary" />
            {n}. {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function WorkshopDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dateInput = useRef<HTMLInputElement>(null);
  // GPS is only asked when the user taps "Hitung jarak" (same rule as the search page).
  const geo = useGeolocation();

  const [draft] = useState(() => readDraft(id));
  const paramDate = params.get('date');
  const [serviceId, setServiceId] = useState(draft.serviceId ?? '');
  const [pickService, setPickService] = useState(!draft.serviceId);
  const [date, setDate] = useState(draft.date ?? (paramDate && paramDate >= jakartaDate(0) ? paramDate : jakartaDate(1)));
  const [slot, setSlot] = useState(draft.slot ?? '');
  const [plate, setPlate] = useState(draft.plate ?? '');
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [vehicleId, setVehicleId] = useState('');

  const detail = useQuery({ queryKey: ['workshop', id], queryFn: () => workshopApi.detail(id) });
  const slots = useQuery({ queryKey: ['availability', id, date], queryFn: () => workshopApi.availability(id, date), enabled: !!date });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => workshopApi.reviews(id) });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list, enabled: user?.role === 'CUSTOMER' });
  const nextSlot = useQuery({ queryKey: ['next-slot', id], queryFn: () => workshopApi.nextSlot(id) });

  const book = useMutation({
    mutationFn: () =>
      bookingApi.create({ workshop_id: id, service_id: serviceId, booking_date: date, time_slot: slot, vehicle_plate: plate || undefined, notes: notes || undefined, vehicle_id: vehicleId || undefined }),
    onSuccess: (b) => {
      writeDraft(id, null);
      // Step 4 of the flow: pay right away when the slot is confirmed; waiting-list bookings go to their ticket.
      navigate(b.status === 'CONFIRMED' ? `/orders/${b.id}/pay` : `/orders/${b.id}`);
    },
  });

  if (detail.isLoading) return <Loading />;
  if (detail.error || !detail.data) return <Alert tone="danger">{errorMessage(detail.error)}</Alert>;
  const w = detail.data;
  const service = w.services.find((s) => s.id === serviceId);
  const myVehicles = (vehicles.data ?? []).filter((v) => !service || v.vehicle_type === service.vehicle_type);
  const chosenSlot = slots.data?.find((s) => s.time_slot === slot);
  const step = !serviceId ? 0 : !slot ? 1 : 2;
  const wrongRole = !!user && user.role !== 'CUSTOMER';

  const changeDate = (d: string) => {
    setDate(d);
    setSlot('');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Login is requested only at confirmation; afterwards the user returns here.
    if (!user) {
      writeDraft(id, { serviceId, date, slot, plate, notes });
      return navigate('/login', { state: { from: location.pathname } });
    }
    if (user.role === 'CUSTOMER' && user.email_verified === false) {
      writeDraft(id, { serviceId, date, slot, plate, notes });
      return navigate('/verifikasi-email', { state: { from: location.pathname } });
    }
    book.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      {geo.dialog}
      {/* Step bar + quota notice (Stitch layout) */}
      <div className="rounded-xl border border-line bg-card px-4 py-4 shadow-sm sm:px-6">
        <Stepper steps={STEPS} current={step} />
      </div>
      <div className="-mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-primary/15 bg-sky px-4 py-3 sm:px-6">
        <Icon name="lock_clock" className="text-primary" />
        <p className="text-sm text-navy">
          <b>Jadwal Anda aman:</b> jam yang Anda pilih langsung jadi milik Anda begitu Anda menekan konfirmasi, jadi tidak akan bentrok dengan pelanggan lain.
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-label text-[11px] font-bold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Ketersediaan selalu terbaru
        </span>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Workshop + chosen package */}
          <section className="relative overflow-hidden rounded-xl border border-line bg-card shadow-sm">
            <span className="absolute inset-x-0 top-0 z-10 h-[3px] bg-primary" />
            {!!w.photos?.length && <PhotoGallery photos={w.photos} name={w.name} />}
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                {!w.photos?.length && (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky text-primary sm:h-12 sm:w-12">
                    <Icon name="storefront" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky px-2 py-0.5 font-label text-xs font-bold whitespace-nowrap text-primary">
                      <Icon name="verified" className="text-[14px]" /> Mitra Resmi<span className="hidden sm:inline"> BengkelGo</span>
                    </span>
                    <Link to="/workshops" className="shrink-0 rounded-lg bg-sky px-3 py-1.5 font-label text-xs font-bold text-primary hover:bg-primary-fixed/60">
                      Ubah Bengkel
                    </Link>
                  </div>
                  <h1 className="mt-1.5 text-headline-md break-words text-navy">{w.name}</h1>
                  <p className="mt-0.5 text-sm text-ink-2">{w.address}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-label text-xs text-ink-2">
                <Stars value={w.avg_rating} count={w.total_reviews} />
                <span className={cx('inline-flex items-center gap-1', w.is_open ? 'font-semibold text-success' : 'text-ink-3')}>
                  <Icon name="schedule" className="text-[14px]" /> {w.is_open ? `Buka ${w.open_time}–${w.close_time}` : 'Sedang tutup'}
                </span>
                {geo.position ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-navy" data-testid="workshop-distance">
                    <Icon name="near_me" className="text-[14px] text-primary" /> {distance(metersBetween(geo.position, { lat: w.latitude, lng: w.longitude }))} dari lokasi Anda
                  </span>
                ) : (
                  <button type="button" onClick={geo.locate} disabled={geo.locating} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline disabled:opacity-60">
                    <Icon name="my_location" className="text-[14px]" /> {geo.locating ? 'Mencari lokasi…' : 'Hitung jarak dari lokasi saya'}
                  </button>
                )}
              </div>
              {geo.error && <p className="mt-1 font-label text-xs text-warning-ink">{geo.error.replace(' Pilih lokasi di peta.', '')}</p>}

              {nextSlot.data && (
                <button
                  type="button"
                  onClick={() => {
                    setDate(nextSlot.data!.booking_date);
                    setSlot(nextSlot.data!.time_slot);
                  }}
                  className="mt-3 flex w-full items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-left font-label text-xs text-success hover:brightness-95 sm:inline-flex sm:w-auto"
                  data-testid="next-slot"
                >
                  <Icon name="bolt" className="text-[18px]" />
                  <span className="min-w-0 flex-1">
                    Slot terdekat: <b>{friendlyDay(nextSlot.data.booking_date)}, {nextSlot.data.time_slot} WIB</b>
                  </span>
                  <span className="shrink-0 rounded-md bg-success px-2 py-0.5 font-bold text-white">Pilih</span>
                </button>
              )}
            </div>

            <div id="booking-service" className="border-t border-line p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">{service ? 'Paket servis dipilih' : 'Pilih paket servis'}</p>
                {service && (
                  <button type="button" onClick={() => setPickService((p) => !p)} className="font-label text-xs font-bold text-primary hover:underline">
                    {pickService ? 'Tutup' : 'Ganti paket'}
                  </button>
                )}
              </div>
              {service && !pickService ? (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-navy">
                      <Icon name="tune" className="text-primary" /> {service.name}
                    </p>
                    {service.description && <p className="mt-1 text-sm text-ink-2">{service.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-label text-[11px] text-ink-3">Estimasi durasi</p>
                    <p className="text-headline-sm text-navy">{service.duration_minutes} Menit</p>
                    <p className="font-label text-xs font-bold text-success">{vehicleLabel(service.vehicle_type)}</p>
                  </div>
                </div>
              ) : (
                <ServicePicker
                  services={w.services}
                  value={serviceId}
                  onChange={(s) => {
                    setServiceId(s);
                    setPickService(false);
                  }}
                />
              )}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                {w.vehicle_types.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 font-label text-xs font-semibold text-navy">
                    <Icon name={vehicleIcon(v)} className="text-[16px] text-primary" /> Melayani {vehicleLabel(v)}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 font-label text-xs font-semibold text-navy">
                  <Icon name="engineering" className="text-[16px] text-primary" /> {w.mechanics.length} mekanik
                </span>
                {w.has_qris && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 font-label text-xs font-semibold text-navy">
                    <Icon name="qr_code_2" className="text-[16px] text-primary" /> QRIS Ready
                  </span>
                )}
                {w.accepts_emergency && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-low px-3 py-1 font-label text-xs font-semibold text-navy">
                    <Icon name="e911_emergency" className="text-[16px] text-emergency" /> Siaga SOS
                  </span>
                )}
              </div>
            </div>
          </section>

          <Section
            n={1}
            title="Pilih Tanggal Servis"
            subtitle="Pilih tanggal kedatangan Anda."
            action={
              <label className="relative inline-flex cursor-pointer items-center gap-1.5 font-label text-xs font-bold text-primary hover:underline">
                <Icon name="event" /> Pilih di Kalender
                <input
                  ref={dateInput}
                  type="date"
                  value={date}
                  min={jakartaDate(0)}
                  max={jakartaDate(30)}
                  onChange={(e) => e.target.value && changeDate(e.target.value)}
                  onClick={() => dateInput.current?.showPicker?.()}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Pilih tanggal di kalender"
                />
              </label>
            }
          >
            <DateStrip value={date} onChange={changeDate} />
            <p className="mt-3 font-label text-xs text-ink-2">
              Dipilih: <b className="text-navy">{longDate(date)}</b> ({friendlyDay(date)})
            </p>
          </Section>

          <Section
            n={2}
            id="booking-slot"
            title="Pilih Jam Kedatangan"
            subtitle="Nomor antrean dibuat otomatis saat booking dikonfirmasi. Jam yang penuh tetap bisa dipilih untuk masuk daftar tunggu."
            action={
              <span className="flex flex-wrap gap-3 font-label text-xs text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-sky" /> Terpilih
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" /> Tersedia
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-line-strong" /> Penuh
                </span>
              </span>
            }
          >
            {slots.isLoading ? (
              <Loading />
            ) : slots.error ? (
              <Alert tone="danger">{errorMessage(slots.error)}</Alert>
            ) : (
              <SlotPicker slots={slots.data ?? []} value={slot} onChange={setSlot} durationMinutes={service?.duration_minutes} />
            )}
            {chosenSlot && (
              <div className={cx('mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm', chosenSlot.remaining === 0 ? 'border-warning/30 bg-warning-soft text-warning-ink' : 'border-success/20 bg-success-soft text-[#006b35]')}>
                <Icon name={chosenSlot.remaining === 0 ? 'hourglass_top' : 'verified'} className="mt-px" />
                <p>
                  {chosenSlot.remaining === 0 ? (
                    <>
                      <b>Slot ini penuh:</b> Anda masuk daftar tunggu (saat ini {chosenSlot.waitlisted} orang) dan otomatis terkonfirmasi bila ada slot kosong.
                    </>
                  ) : (
                    <>
                      <b>Slot tersedia:</b> datang sesuai jadwal ({slotRange(chosenSlot.time_slot)} WIB) dan sebutkan nomor pesanan Anda ke bengkel.
                      {service && <> Estimasi selesai pukul {addMinutes(chosenSlot.time_slot, service.duration_minutes)} WIB.</>}
                    </>
                  )}
                </p>
              </div>
            )}
          </Section>

          <Section n={3} title="Data Kendaraan & Catatan Khusus" subtitle="Informasi ini membantu teknisi mempersiapkan alat sebelum kedatangan Anda.">
            <div className="grid gap-4">
              {/* Saved vehicles of the matching type (the API rejects a motorbike for a car service). */}
              {!!myVehicles.length && (
                <div className="max-w-md">
                  <Select
                    label="Kendaraan tersimpan"
                    icon="garage"
                    value={vehicleId}
                    data-testid="booking-vehicle"
                    onChange={(e) => {
                      const v = myVehicles.find((x) => x.id === e.target.value);
                      setVehicleId(e.target.value);
                      if (v?.plate) setPlate(v.plate);
                    }}
                  >
                    <option value="">Isi manual</option>
                    {myVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {vehicleName(v)}
                        {v.plate ? ` (${v.plate})` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="max-w-sm">
                <Input label="Plat nomor kendaraan (opsional)" icon="pin" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="B 1234 XYZ" maxLength={15} />
              </div>
              <TextArea
                label="Catatan keluhan / indikasi kerusakan (opsional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                placeholder="Contoh: tarikan gas terasa berat di rpm rendah, ada bunyi halus di rem depan."
                hint={`Maksimal 300 karakter (${notes.length}/300). Bengkel membaca catatan ini sebelum servis.`}
              />
            </div>
          </Section>
        </div>

        {/* Order summary */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-line bg-card p-5 shadow-lift">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-headline-sm text-navy">Ringkasan Pesanan</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 font-label text-[11px] font-bold text-success">
                <Icon name="verified_user" className="text-[14px]" /> Aman &amp; Terlindungi
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-sky p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-white">
                <Icon name="event_available" />
              </span>
              <div className="min-w-0">
                <p className="font-label text-[10px] font-bold tracking-[0.04em] text-ink-3 uppercase">Waktu kedatangan</p>
                <p className="font-bold text-navy">{longDate(date)}</p>
                <p className="font-label text-xs text-ink-2">{slot ? `Pukul ${slotRange(slot)} WIB` : 'Pilih jam kedatangan'}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">{service ? service.name : 'Paket servis'}</dt>
                <dd className="font-semibold text-navy">{service ? rupiah(service.price) : '-'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="flex items-center gap-1 text-ink-2">Biaya layanan aplikasi</dt>
                <dd className="font-bold text-success">GRATIS</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">Biaya pesan jadwal</dt>
                <dd className="font-semibold text-navy">Rp0</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-dashed border-line-strong pt-4">
              <div>
                <p className="font-label text-[11px] text-ink-3">Total tagihan (estimasi)</p>
                <p className="font-label text-[11px] font-semibold text-success">Dibayar via QRIS bengkel</p>
              </div>
              <p className="text-[22px] leading-none font-extrabold tracking-[-0.02em] text-navy">{service ? rupiah(service.price) : '-'}</p>
            </div>
            <ul className="mt-4 space-y-2 border-t border-line pt-4 text-xs text-ink-2">
              {[
                ['lock', 'Jadwal per jam, tidak bentrok'],
                ['hourglass_top', 'Masuk daftar tunggu otomatis bila jam penuh'],
                ['qr_code_2', 'Bayar langsung ke QRIS bengkel'],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon name={icon} className="text-[18px] text-success" /> {text}
                </li>
              ))}
            </ul>
            {wrongRole && (
              <div className="mt-4">
                <Alert tone="warning">Booking hanya untuk akun pelanggan. Silakan masuk dengan akun customer.</Alert>
              </div>
            )}
            {book.error && (
              <div className="mt-4">
                <Alert tone="danger">{errorMessage(book.error)}</Alert>
              </div>
            )}
            <MissingFields
              className="mt-4"
              items={[!serviceId && { label: 'Paket servis', target: 'booking-service' }, !slot && { label: 'Jam kedatangan', target: 'booking-slot' }]}
            />
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={!serviceId || !slot || wrongRole} loading={book.isPending} data-testid="booking-submit">
              {user ? 'Konfirmasi & Lanjut ke QRIS' : 'Masuk untuk Booking'} <Icon name="arrow_forward" />
            </Button>
            <p className="mt-3 text-center font-label text-[11px] text-ink-3">
              {user ? 'Booking langsung diterima bengkel setelah tombol ditekan.' : 'Anda akan kembali ke halaman ini setelah masuk; pilihan Anda tersimpan.'}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 shadow-sm">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky text-primary">
              <Icon name="support_agent" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy">Punya pertanyaan khusus?</p>
              <p className="font-label text-xs text-ink-2">Hubungi bengkel langsung sebelum datang.</p>
            </div>
            <a href={`tel:${w.phone}`} className="font-label text-xs font-bold text-primary hover:underline">
              Telepon
            </a>
          </div>
          <a
            href={directionsUrl({ lat: w.latitude, lng: w.longitude })}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card p-3 font-label text-sm font-bold text-navy shadow-sm hover:bg-sky"
          >
            <Icon name="near_me" className="text-primary" /> Lihat rute ke bengkel
          </a>
        </aside>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card title="Ulasan pelanggan" icon="reviews" actions={<Badge tone="info">{w.total_reviews} ulasan</Badge>}>
          {reviews.data ? <ReviewList reviews={reviews.data} /> : <Loading />}
        </Card>
        <Card title="Tim mekanik" icon="engineering">
          <MechanicList mechanics={w.mechanics} />
        </Card>
      </div>
    </div>
  );
}

/** Workshop photos uploaded by the owner (cover first); scrolls sideways on small screens. */
/** Workshop photos: the cover across the full card, and small thumbnails to switch when there are more. */
function PhotoGallery({ photos, name }: { photos: { id: string; url: string; is_cover: boolean }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = photos[Math.min(active, photos.length - 1)];
  return (
    <div data-testid="workshop-photos">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-low sm:aspect-[21/8]">
        <img src={apiAsset(current.url)!} alt={`Foto ${name}`} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        {photos.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 font-label text-[11px] font-bold text-white">
            {active + 1}/{photos.length}
          </span>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pt-3 sm:px-6">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Lihat foto ${i + 1}`}
              aria-pressed={i === active}
              className={cx('h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition', i === active ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')}
            >
              <img src={apiAsset(p.url)!} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
