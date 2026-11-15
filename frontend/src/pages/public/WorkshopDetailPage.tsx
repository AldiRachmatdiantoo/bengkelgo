import { useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { accountApi, apiAsset, bookingApi, vehicleApi, workshopApi } from '@/services/api/endpoints';
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
  chipDate,
  dayMonthYear,
  dotTime,
  friendlyDay,
  IllustrationTag,
  monthYear,
  slotRange,
  vehicleLabel,
} from '@/components/workshop/WorkshopComponents';
import { Alert, Icon, Input, MissingFields, TextArea, cx, SkeletonDetail, SkeletonList, SkeletonSlots } from '@/components/ui';
import { BottomBar, CarGlyph, ChoiceChip, NoteBox, ScreenAction, ScreenHeader, ScreenSection, VehicleCard, WorkshopArt } from '@/components/ui/screen';
import { distance, jakartaDate, rupiah, vehicleName } from '@/utils/format';
import { isIdPhone } from '@/utils/formChecks';

/** Straight-line distance in meters (haversine), for "x km dari lokasi Anda". */
function metersBetween(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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

const secondaryLink =
  'inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-line bg-card px-3 text-sm font-bold text-ink transition hover:bg-surface';

/** The Figma "Detail booking" screen: workshop, vehicle, service, schedule, complaint, then the bottom bar. */
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
  const [date, setDate] = useState(draft.date ?? (paramDate && paramDate >= jakartaDate(0) ? paramDate : jakartaDate(1)));
  const [slot, setSlot] = useState(draft.slot ?? '');
  const [plate, setPlate] = useState(draft.plate ?? '');
  const [notes, setNotes] = useState(draft.notes ?? '');
  const [vehicleId, setVehicleId] = useState('');
  // Accounts made with Google have no phone number: asked here once and saved to the account.
  const [phone, setPhone] = useState('');
  const needsPhone = user?.role === 'CUSTOMER' && !user.phone;

  const detail = useQuery({ queryKey: ['workshop', id], queryFn: () => workshopApi.detail(id) });
  const slots = useQuery({ queryKey: ['availability', id, date], queryFn: () => workshopApi.availability(id, date), enabled: !!date });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => workshopApi.reviews(id) });
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list, enabled: user?.role === 'CUSTOMER' });
  const nextSlot = useQuery({ queryKey: ['next-slot', id], queryFn: () => workshopApi.nextSlot(id) });

  const book = useMutation({
    mutationFn: async () => {
      if (needsPhone) await accountApi.update({ phone: phone.trim() });
      return bookingApi.create({
        workshop_id: id,
        service_id: serviceId,
        booking_date: date,
        time_slot: slot,
        vehicle_plate: plate || undefined,
        notes: notes || undefined,
        vehicle_id: vehicleId || undefined,
      });
    },
    onSuccess: (b) => {
      writeDraft(id, null);
      // Pay right away when the slot is confirmed; waiting-list bookings go to their ticket.
      navigate(b.status === 'CONFIRMED' ? `/orders/${b.id}/pay` : `/orders/${b.id}`);
    },
  });

  if (detail.isLoading) return <SkeletonDetail />;
  if (detail.error || !detail.data) return <Alert tone="danger">{errorMessage(detail.error)}</Alert>;
  const w = detail.data;
  const service = w.services.find((s) => s.id === serviceId);
  // Saved vehicles of the matching type (the API rejects a motorbike for a car service).
  const myVehicles = (vehicles.data ?? []).filter((v) => !service || v.vehicle_type === service.vehicle_type);
  const vehicle = myVehicles.find((v) => v.id === vehicleId);
  const chosenSlot = slots.data?.find((s) => s.time_slot === slot);
  const wrongRole = !!user && user.role !== 'CUSTOMER';
  const inStrip = Array.from({ length: 7 }, (_, i) => jakartaDate(i)).includes(date);

  const changeDate = (d: string) => {
    setDate(d);
    setSlot('');
  };
  const changeService = (sid: string) => {
    setServiceId(sid);
    const next = w.services.find((s) => s.id === sid);
    if (vehicle && next && vehicle.vehicle_type !== next.vehicle_type) setVehicleId('');
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
    if (needsPhone && !isIdPhone(phone)) return document.getElementById('booking-phone')?.focus();
    book.mutate();
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      {geo.dialog}
      <ScreenHeader back="/workshops" backLabel="Kembali ke daftar bengkel" title="Detail booking" subtitle="Atur servis, jadwal, dan keluhan kendaraan Anda." />

      <form onSubmit={submit}>
        {/* Workshop (the "Pilih bengkel" card): photo or line art, name and rating, address, distance. */}
        <section className="overflow-hidden rounded-2xl border border-line bg-card" aria-label={`Bengkel ${w.name}`}>
          {w.photos?.length ? <PhotoGallery photos={w.photos} name={w.name} /> : <WorkshopArt className="block h-[84px] w-full" />}
          <div className="px-4 pt-3.5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-bold break-words text-ink">{w.name}</h2>
              <span className="inline-flex shrink-0 items-center gap-1 text-subtitle font-bold text-primary" aria-label={w.avg_rating > 0 ? `Rating ${w.avg_rating.toFixed(1)} dari 5, ${w.total_reviews} ulasan` : 'Belum ada rating'}>
                <Icon name="star" filled className="text-[16px] text-star" />
                {w.avg_rating > 0 ? w.avg_rating.toFixed(1).replace('.', ',') : 'Baru'}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-2">{w.address}</p>
            <p className={cx('mt-1 text-xs font-semibold', w.is_open ? 'text-ink-2' : 'text-ink-3')}>
              {w.is_open ? `Buka ${w.open_time}-${w.close_time}` : 'Sedang tutup'}
              {w.has_qris && ' · Bayar QRIS'}
              {w.accepts_emergency && ' · Siaga SOS'}
            </p>
            {geo.position ? (
              <p className="mt-1.5 text-xs font-bold text-primary" data-testid="workshop-distance">
                {distance(metersBetween(geo.position, { lat: w.latitude, lng: w.longitude }))} dari lokasi Anda
              </p>
            ) : (
              <button type="button" onClick={geo.locate} disabled={geo.locating} className="mt-1 -ml-1 inline-flex min-h-8 items-center gap-1 rounded px-1 text-xs font-bold text-primary hover:underline disabled:opacity-60">
                <Icon name="my_location" className="text-[14px]" /> {geo.locating ? 'Mencari lokasi…' : 'Hitung jarak dari lokasi saya'}
              </button>
            )}
            {geo.error && <p className="mt-1 text-xs text-warning-ink">{geo.error.replace(' Pilih lokasi di peta.', '')}</p>}
            <div className="mt-3.5 flex gap-2">
              <a href={directionsUrl({ lat: w.latitude, lng: w.longitude })} target="_blank" rel="noreferrer" className={secondaryLink}>
                <Icon name="near_me" className="text-primary" /> Rute
              </a>
              <a href={`tel:${w.phone}`} className={secondaryLink}>
                <Icon name="call" className="text-primary" /> Telepon
              </a>
            </div>
          </div>
        </section>

        {nextSlot.data && (
          <button
            type="button"
            onClick={() => {
              setDate(nextSlot.data!.booking_date);
              setSlot(nextSlot.data!.time_slot);
            }}
            className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-lg bg-sky px-4 py-3 text-left transition hover:bg-surface"
            data-testid="next-slot"
          >
            <Icon name="bolt" filled className="text-[20px] text-primary" />
            <span className="min-w-0 flex-1 text-sm text-ink-2">
              Slot terdekat: <b className="text-primary">{friendlyDay(nextSlot.data.booking_date)}, {dotTime(nextSlot.data.time_slot)} WIB</b>
            </span>
            <span className="shrink-0 text-sm font-bold text-primary">Pilih</span>
          </button>
        )}

        <ScreenSection title="Kendaraan" className="mt-6">
          {myVehicles.length > 0 ? (
            // The whole card opens the native picker; "Ubah" says it can be changed.
            <div className="relative">
              <VehicleCard
                name={vehicle ? vehicleName(vehicle) : 'Isi plat nomor sendiri'}
                plate={vehicle ? vehicle.plate || vehicleLabel(vehicle.vehicle_type) : `${myVehicles.length} kendaraan tersimpan`}
                icon={vehicle?.vehicle_type === 'MOTOR' ? <Icon name="two_wheeler" className="text-[26px]" /> : <CarGlyph />}
                action={<span className="text-sm font-bold text-primary">{vehicle ? 'Ubah' : 'Pilih'}</span>}
              />
              <select
                aria-label="Kendaraan tersimpan"
                value={vehicleId}
                data-testid="booking-vehicle"
                onChange={(e) => {
                  const v = myVehicles.find((x) => x.id === e.target.value);
                  setVehicleId(e.target.value);
                  if (v?.plate) setPlate(v.plate);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[13px] opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <option value="">Isi plat nomor sendiri</option>
                {myVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vehicleName(v)}
                    {v.plate ? ` (${v.plate})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {!vehicle && (
            <div className={cx(myVehicles.length > 0 && 'mt-2.5')}>
              <Input label="Plat nomor (opsional)" icon="pin" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="B 1234 XYZ" maxLength={15} />
            </div>
          )}
        </ScreenSection>

        <ScreenSection title="Kategori servis" id="booking-service">
          <ServicePicker services={w.services} value={serviceId} onChange={changeService} />
        </ScreenSection>

        <ScreenSection title="Jadwal kunjungan" id="booking-slot" aside={monthYear(date)}>
          <DateStrip
            value={date}
            onChange={changeDate}
            extra={
              // Eighth cell: any date up to 30 days ahead from the native calendar; shows that date once picked.
              <div className="relative grid">
                <ChoiceChip checked={!inStrip} onSelect={() => dateInput.current?.showPicker?.()} aria-label="Pilih tanggal lain di kalender">
                  {inStrip ? (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="calendar_month" className="text-[16px]" /> Lain
                    </span>
                  ) : (
                    chipDate(date)
                  )}
                </ChoiceChip>
                <input
                  ref={dateInput}
                  type="date"
                  tabIndex={-1}
                  aria-hidden
                  value={date}
                  min={jakartaDate(0)}
                  max={jakartaDate(30)}
                  onChange={(e) => e.target.value && changeDate(e.target.value)}
                  className="pointer-events-none absolute inset-0 opacity-0"
                />
              </div>
            }
          />
          <p className="mt-2.5 text-xs text-ink-2">
            {friendlyDay(date)}, {dayMonthYear(date)}
          </p>
          <div className="mt-3">
            {slots.isLoading ? (
              <SkeletonSlots />
            ) : slots.error ? (
              <Alert tone="danger">{errorMessage(slots.error)}</Alert>
            ) : (
              <SlotPicker slots={slots.data ?? []} value={slot} onChange={setSlot} durationMinutes={service?.duration_minutes} />
            )}
          </div>
          {chosenSlot && (
            <NoteBox className="mt-3" tone={chosenSlot.remaining === 0 ? 'warning' : 'success'} title={chosenSlot.remaining === 0 ? 'Jam ini penuh' : `Datang pukul ${slotRange(chosenSlot.time_slot).replaceAll(':', '.')} WIB`}>
              {chosenSlot.remaining === 0 ? (
                <>Anda masuk daftar tunggu ({chosenSlot.waitlisted} orang di depan) dan otomatis terkonfirmasi bila ada tempat kosong.</>
              ) : (
                <>
                  Sebutkan nomor pesanan ke bengkel saat tiba.
                  {service && <> Perkiraan selesai pukul {dotTime(addMinutes(chosenSlot.time_slot, service.duration_minutes))} WIB.</>}
                </>
              )}
            </NoteBox>
          )}
        </ScreenSection>

        {needsPhone && (
          <ScreenSection title="Nomor WhatsApp">
            <Input
              id="booking-phone"
              label="Nomor WhatsApp Anda"
              icon="call"
              inputMode="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              hint="Akun Google tidak menyertakan nomor telepon. Nomor ini disimpan di akun Anda agar bengkel bisa menghubungi Anda."
              data-testid="booking-phone"
            />
          </ScreenSection>
        )}

        <ScreenSection title="Keluhan kendaraan">
          <TextArea
            aria-label="Keluhan kendaraan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={300}
            placeholder="Contoh: tarikan berat dan terdengar bunyi decit."
            hint={`Opsional, maksimal 300 karakter (${notes.length}/300). Bengkel membacanya sebelum servis.`}
          />
        </ScreenSection>

        <div className="mt-5 flex flex-col gap-3">
          {wrongRole && <Alert tone="warning">Booking hanya untuk akun pelanggan. Silakan masuk dengan akun customer.</Alert>}
          {book.error && <Alert tone="danger">{errorMessage(book.error)}</Alert>}
          <MissingFields
            items={[
              !serviceId && { label: 'Kategori servis', target: 'booking-service' },
              !slot && { label: 'Jam kunjungan', target: 'booking-slot' },
              needsPhone && !isIdPhone(phone) && { label: phone.trim() ? 'Nomor WhatsApp belum benar (mis. 0812…)' : 'Nomor WhatsApp Anda', target: 'booking-phone' },
            ]}
          />
          <p className="text-xs text-ink-2">
            {user
              ? 'Bayar langsung ke QRIS bengkel setelah booking dikonfirmasi.'
              : 'Anda diminta masuk dulu, lalu kembali ke halaman ini dengan pilihan yang sama.'}
          </p>
        </div>

        <BottomBar caption="Estimasi biaya" amount={service ? rupiah(service.price) : 'Rp0'}>
          <ScreenAction type="submit" disabled={!serviceId || !slot || wrongRole} loading={book.isPending} data-testid="booking-submit">
            Booking →
          </ScreenAction>
        </BottomBar>
      </form>

      <ScreenSection title={`Ulasan pelanggan (${w.total_reviews})`} className="mt-8">
        <div className="rounded-xl border border-line bg-card p-4">{reviews.data ? <ReviewList reviews={reviews.data} /> : <SkeletonList rows={3} />}</div>
      </ScreenSection>
      <ScreenSection title="Tim mekanik">
        <div className="rounded-xl border border-line bg-card p-4">
          <MechanicList mechanics={w.mechanics} />
        </div>
      </ScreenSection>
    </div>
  );
}

/** Workshop photos: the cover across the card, and small thumbnails to switch when there are more. */
function PhotoGallery({ photos, name }: { photos: { id: string; url: string; is_cover: boolean; is_illustration?: boolean }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = photos[Math.min(active, photos.length - 1)];
  return (
    <div data-testid="workshop-photos">
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-art">
        <img src={apiAsset(current.url)!} alt={current.is_illustration ? 'Foto ilustrasi bengkel' : `Foto ${name}`} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        {current.is_illustration && <IllustrationTag className="bottom-3 left-3 text-[11px]" />}
        {photos.length > 1 && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
            {active + 1}/{photos.length}
          </span>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Lihat foto ${i + 1}`}
              aria-pressed={i === active}
              className={cx('h-12 w-16 shrink-0 overflow-hidden rounded-md ring-2 transition', i === active ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')}
            >
              <img src={apiAsset(`${p.url}?size=sm`)!} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
