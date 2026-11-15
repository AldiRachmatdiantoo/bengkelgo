import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { accountApi, authApi, emergencyApi, vehicleApi } from '@/services/api/endpoints';
import { errorCode, errorMessage } from '@/services/api/client';
import type { ProblemCategory, VehicleType } from '@/services/api/types';
import { useAuth } from '@/services/auth/AuthProvider';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapPicker, PointsMap, type LatLng } from '@/components/map/Maps';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { AddressHint } from '@/components/map/AddressHint';
import { SafetyBanner } from '@/components/orders/OrderComponents';
import { Alert, Badge, Button, Icon, Input, MissingFields, Segmented, Skeleton, Stars, TextArea, cx } from '@/components/ui';
import { BottomBar, OptionCard, ScreenAction, ScreenHeader } from '@/components/ui/screen';
import { ReviewRow, StepHeading, StepProgress, useStepDraft, useStepFlow } from '@/components/ui/steps';
import { isIdPhone } from '@/utils/formChecks';
import { distance, vehicleName } from '@/utils/format';
import { PRICE_PRESETS, rangeLabel, type PriceRange } from '@/utils/priceRange';

const PROBLEMS: { category: ProblemCategory; icon: string; label: string; text: string }[] = [
  { category: 'BATTERY', icon: 'battery_alert', label: 'Aki mati / soak', text: 'Aki mati, kendaraan tidak bisa distarter.' },
  { category: 'TIRE', icon: 'tire_repair', label: 'Ban bocor / pecah', text: 'Ban bocor, kendaraan tidak bisa jalan.' },
  { category: 'ENGINE', icon: 'warning', label: 'Mesin mogok / overheat', text: 'Mesin mati mendadak / overheat di jalan.' },
  { category: 'FUEL', icon: 'local_gas_station', label: 'Kehabisan bensin', text: 'Kehabisan bahan bakar di jalan.' },
  { category: 'TOWING', icon: 'rv_hookup', label: 'Perlu derek', text: 'Kendaraan tidak bisa jalan sama sekali, perlu diderek.' },
  { category: 'LOCKOUT', icon: 'key_off', label: 'Kunci tertinggal', text: 'Kunci tertinggal di dalam kendaraan.' },
];

type StepId = 'lokasi' | 'bengkel' | 'kendaraan' | 'keluhan' | 'kontak' | 'kirim';

type Draft = {
  position: LatLng | null;
  addressNote: string;
  vehicle: VehicleType;
  /** The customer chose Motor/Mobil (or a saved vehicle) themself, so saved vehicles no longer override it. */
  vehicleTouched: boolean;
  /** A vehicle card (or "Motor/Mobil lain") was tapped, so no saved vehicle is picked automatically any more. */
  vehiclePicked: boolean;
  vehicleId: string;
  plate: string;
  category?: ProblemCategory;
  problem: string;
  range: PriceRange;
  guest: { name: string; whatsapp: string };
};

const EMPTY: Draft = {
  position: null,
  addressNote: '',
  vehicle: 'MOTOR',
  vehicleTouched: false,
  vehiclePicked: false,
  vehicleId: '',
  plate: '',
  problem: '',
  range: {},
  guest: { name: '', whatsapp: '' },
};

/**
 * SOS as a short step-by-step flow: location, the workshops on standby around it, vehicle, problem, contact, then a
 * review before sending. Steps whose data is already known are skipped (no saved vehicle of that type, or a
 * signed-in customer with a phone number).
 */
export default function EmergencyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Prefill from the landing page (location + chosen problem).
  const prefill = (useLocation().state as { position?: LatLng | null; problem?: string; vehicle?: VehicleType } | null) ?? {};
  const geo = useGeolocation();
  const [draft, update, clearDraft] = useStepDraft<Draft>('sos-draft', EMPTY);
  const [tried, setTried] = useState<StepId | null>(null);
  const canSaveVehicles = user?.role === 'CUSTOMER' || user?.role === 'GUEST';
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list, enabled: canSaveVehicles });
  // Signed in with Google and no phone number yet: the mechanic needs one to call, so it is asked here.
  const needsPhone = !!user && !user.phone;

  // Arrival: landing prefill wins over the draft; then the GPS runs by itself if the browser already allows it.
  useEffect(() => {
    // "Motor mogok" / "Mobil mogok" from the landing page question.
    if (prefill.vehicle) update({ vehicle: prefill.vehicle, vehicleTouched: true, vehiclePicked: false, vehicleId: '', plate: '' });
    if (prefill.problem) update({ problem: prefill.problem, category: PROBLEMS.find((p) => p.text === prefill.problem)?.category });
    const start = prefill.position ?? draft.position;
    if (start) geo.setPosition(start);
    else
      navigator.permissions
        ?.query({ name: 'geolocation' })
        .then((s) => {
          if (s.state === 'granted') void geo.locate();
        })
        .catch(() => undefined);
    // Only once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (geo.position) update({ position: geo.position });
  }, [geo.position, update]);

  // A saved vehicle is picked for the customer: the first one, or the first of the type they chose, until they tap
  // a vehicle card themself.
  useEffect(() => {
    if (!vehicles.data || draft.vehiclePicked || draft.vehicleId) return;
    const v = draft.vehicleTouched ? vehicles.data.find((x) => x.vehicle_type === draft.vehicle) : vehicles.data[0];
    if (v) update({ vehicle: v.vehicle_type, vehicleId: v.id, plate: v.plate ?? '' });
  }, [vehicles.data, draft.vehiclePicked, draft.vehicleTouched, draft.vehicleId, draft.vehicle, update]);

  // The draft's point counts on the first render too (geo picks it up in an effect), so a refresh stays on its step.
  const position = geo.position ?? draft.position;
  const matching = (vehicles.data ?? []).filter((v) => v.vehicle_type === draft.vehicle);
  const flow = useStepFlow<StepId>([
    { id: 'lokasi', label: 'Lokasi' },
    { id: 'bengkel', label: 'Bengkel terdekat' },
    { id: 'kendaraan', label: 'Kendaraan', skip: matching.length === 0 },
    { id: 'keluhan', label: 'Keluhan' },
    { id: 'kontak', label: 'Kontak', skip: !!user && !needsPhone },
    { id: 'kirim', label: 'Periksa & kirim' },
  ]);
  const step = flow.active.id;

  const scan = useQuery({
    queryKey: ['sos-scan', position?.lat, position?.lng, draft.vehicle],
    queryFn: () => emergencyApi.scan({ latitude: position!.lat, longitude: position!.lng, vehicle_type: draft.vehicle }),
    enabled: !!position && step !== 'lokasi',
    staleTime: 60_000,
  });
  const workshops = scan.data?.workshops ?? [];
  // Routing skips workshops without a free mechanic, so the "priority" pick is the first one that has one.
  const priority = workshops.find((w) => w.available_mechanics > 0);

  const request = useMutation({
    mutationFn: async () => {
      const pos = position!;
      // Not logged in -> quick guest session (name + WhatsApp + GPS), then send the SOS.
      if (!user) await authApi.guest({ name: draft.guest.name, whatsapp: draft.guest.whatsapp, latitude: pos.lat, longitude: pos.lng });
      else if (needsPhone) await accountApi.update({ phone: draft.guest.whatsapp.trim() });
      return emergencyApi.request({
        latitude: pos.lat,
        longitude: pos.lng,
        vehicle_type: draft.vehicle,
        problem_description: draft.problem.trim(),
        problem_category: draft.category,
        price_min: draft.range.min,
        price_max: draft.range.max,
        address_note: draft.addressNote || undefined,
        vehicle_plate: draft.plate || undefined,
        vehicle_id: draft.vehicleId || undefined,
      });
    },
    onSuccess: (o) => {
      clearDraft();
      navigate(`/orders/${o.id}`, { replace: true });
    },
  });

  const badRange = !!draft.range.min && !!draft.range.max && draft.range.min > draft.range.max;
  const missingFor = (id: StepId) => {
    switch (id) {
      case 'lokasi':
        return [!position && { label: 'Titik lokasi (GPS, cari lokasi, atau ketuk peta)', target: 'sos-gps' }];
      case 'bengkel':
        return [scan.isSuccess && workshops.length === 0 && { label: 'Belum ada bengkel siaga di sekitar titik ini' }];
      case 'keluhan':
        return [
          draft.problem.trim().length < 5 && { label: 'Apa yang terjadi (min. 5 karakter)', target: 'sos-problem' },
          badRange && { label: 'Kisaran biaya: minimum melebihi maksimum', target: 'sos-price' },
        ];
      case 'kontak':
        return [
          !user && draft.guest.name.trim().length < 2 && { label: 'Nama Anda', target: 'sos-guest-name' },
          (!user || needsPhone) &&
            !isIdPhone(draft.guest.whatsapp) && { label: draft.guest.whatsapp.trim() ? 'Nomor WhatsApp belum benar (mis. 0812…)' : 'Nomor WhatsApp', target: 'sos-guest-wa' },
        ];
      default:
        return [];
    }
  };
  const isValid = (id: StepId) => !missingFor(id).some(Boolean);

  // Opened on a later step (refresh, shared link) with an earlier step incomplete: go back to that step.
  const firstInvalid = flow.steps.findIndex((s) => s.id !== 'kirim' && !isValid(s.id));
  useEffect(() => {
    if (firstInvalid !== -1 && firstInvalid < flow.index) flow.go(flow.steps[firstInvalid].id, true);
  }, [firstInvalid, flow]);

  if (user && (user.role === 'WORKSHOP_OWNER' || user.role === 'ADMIN')) {
    return <Alert tone="warning">Fitur darurat hanya untuk pelanggan. Keluar terlebih dahulu untuk mencoba sebagai tamu.</Alert>;
  }

  const next = () => {
    if (!isValid(step)) return setTried(step);
    setTried(null);
    flow.next();
  };
  const selectedVehicle = vehicles.data?.find((v) => v.id === draft.vehicleId);
  const problemLabel = PROBLEMS.find((p) => p.category === draft.category)?.label;
  const plateInput = <Input label="Plat nomor (opsional)" value={draft.plate} onChange={(e) => update({ plate: e.target.value })} placeholder="B 1234 XYZ" data-testid="sos-plate" />;

  const titles: Record<StepId, { title: string; description?: string }> = {
    lokasi: { title: 'Di mana kendaraan Anda?', description: 'Pakai GPS, cari nama jalan, atau ketuk peta di titik kendaraan.' },
    bengkel: { title: 'Bengkel siaga di sekitar Anda', description: 'Bengkel dalam radius 5 km yang melayani kendaraan Anda.' },
    kendaraan: { title: 'Kendaraan yang mogok', description: 'Pilih dari kendaraan tersimpan atau isi plat kendaraan lain.' },
    keluhan: { title: 'Apa masalahnya?', description: 'Pilih yang paling dekat, lalu ceritakan singkat. Mekanik membaca ini sebelum berangkat.' },
    kontak: needsPhone
      ? { title: 'Nomor WhatsApp Anda', description: 'Akun Google tidak menyertakan nomor telepon. Mekanik menghubungi Anda lewat nomor ini.' }
      : { title: 'Siapa yang bisa dihubungi?', description: 'Tanpa akun tidak masalah, Anda masuk sebagai tamu.' },
    kirim: { title: 'Periksa sebelum mengirim', description: 'Setelah dikirim, bengkel prioritas langsung menerima panggilan Anda.' },
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <ScreenHeader
        title="Bantuan darurat"
        back={flow.isFirst ? '/' : undefined}
        onBack={flow.isFirst ? undefined : flow.back}
        backLabel={flow.isFirst ? 'Kembali ke beranda' : 'Langkah sebelumnya'}
      />
      <StepProgress index={flow.index} total={flow.total} label={flow.active.label} tone="emergency" />
      <StepHeading stepKey={step} index={flow.index} total={flow.total} {...titles[step]} />

      {step === 'lokasi' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="danger" icon="my_location" onClick={geo.locate} loading={geo.locating} data-testid="sos-gps" id="sos-gps">
              {position ? 'Ambil ulang GPS' : 'Gunakan GPS saya'}
            </Button>
            {position && (
              <span className="inline-flex items-center gap-1.5 font-label text-xs text-ink-2" data-testid="sos-position">
                <Icon name="check_circle" filled className="text-success" />
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </span>
            )}
          </div>
          {geo.error && <Alert tone="warning">{geo.error}</Alert>}
          <PlaceSearch near={position} placeholder="Atau cari lokasi: nama jalan, daerah, patokan" onPick={(p) => geo.setPosition({ lat: p.lat, lng: p.lng })} />
          <MapPicker value={position} onChange={geo.setPosition} height={280} />
          <p className="-mt-2 font-label text-xs text-ink-3">Hasil pencarian menandai titik perkiraan. Ketuk peta untuk menggeser ke posisi kendaraan yang tepat.</p>
          <AddressHint
            point={position}
            useLabel="Salin ke patokan"
            onUse={(a) => update({ addressNote: (draft.addressNote.trim() && !draft.addressNote.includes(a) ? `${draft.addressNote.trim()} (${a})` : a).slice(0, 300) })}
          />
          <Input
            label="Patokan lokasi (opsional)"
            icon="pin_drop"
            value={draft.addressNote}
            onChange={(e) => update({ addressNote: e.target.value })}
            placeholder="mis. Depan minimarket, sebelah SPBU"
          />
        </div>
      )}

      {step === 'bengkel' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold">Jenis kendaraan</span>
            <Segmented
              label="Jenis kendaraan"
              value={draft.vehicle}
              onChange={(v) => update({ vehicle: v, vehicleTouched: true, ...(selectedVehicle && selectedVehicle.vehicle_type !== v ? { vehicleId: '', plate: '' } : {}) })}
              options={[
                { value: 'MOTOR', label: 'Motor', icon: 'two_wheeler' },
                { value: 'MOBIL', label: 'Mobil', icon: 'directions_car' },
              ]}
            />
          </div>
          {scan.isPending ? (
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Mencari bengkel siaga">
              <Skeleton className="h-[220px] w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : scan.isError ? (
            <Alert tone="danger">
              {errorMessage(scan.error)}{' '}
              <button type="button" className="font-semibold underline" onClick={() => scan.refetch()}>
                Coba lagi
              </button>
            </Alert>
          ) : (
            <>
              <PointsMap
                origin={position!}
                originLabel="Titik mogok Anda"
                radiusMeters={scan.data.radius_meters}
                points={workshops.map((w) => ({ id: w.id, lat: w.latitude, lng: w.longitude, label: w.name, highlight: w.id === priority?.id }))}
                height={220}
              />
              {workshops.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-lg border border-emergency/40 bg-emergency-soft px-4 py-3.5" data-testid="sos-no-workshops">
                  <p className="text-sm text-ink">Belum ada bengkel siaga dalam 5 km dari titik ini. Periksa lagi titiknya, atau pilih jenis kendaraan lain bila keliru.</p>
                  <Button variant="secondary" icon="edit_location_alt" onClick={() => flow.go('lokasi')}>
                    Geser lokasi
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-lg border border-emergency/40 bg-emergency-soft px-4 py-3.5">
                    <Icon name="route" className="mt-px text-emergency-ink" />
                    <p className="text-sm text-ink-2">
                      Bengkel dipilih otomatis: yang ditandai <b className="text-ink">Prioritas</b> dihubungi lebih dulu. Jika tidak merespons dalam 2 menit, permintaan pindah ke bengkel
                      berikutnya.
                    </p>
                  </div>
                  <ul className="flex flex-col gap-2" data-testid="sos-workshops">
                    {workshops.map((w, i) => (
                      <li key={w.id} className={cx('flex items-center gap-3 rounded-xl border p-3', w.id === priority?.id ? 'border-success/40 bg-success-soft/50' : 'border-line bg-card')}>
                        <span
                          className={cx(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full font-label text-sm font-bold',
                            w.id === priority?.id ? 'bg-success text-on-primary' : 'bg-canvas text-ink-2',
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{w.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 font-label text-xs text-ink-2">
                            {distance(w.distance_meters)} · <Stars value={w.top_mechanic_rating} />
                          </p>
                        </div>
                        {w.id === priority?.id ? <Badge tone="success">Prioritas</Badge> : w.available_mechanics === 0 && <Badge>Mekanik sibuk</Badge>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}

      {step === 'kendaraan' && (
        <div className="flex flex-col gap-3" role="radiogroup" aria-label="Kendaraan">
          {matching.map((v) => (
            <OptionCard
              key={v.id}
              checked={draft.vehicleId === v.id}
              onSelect={() => update({ vehicleId: v.id, plate: v.plate ?? '', vehicleTouched: true, vehiclePicked: true })}
              title={vehicleName(v)}
              description={v.plate || undefined}
              data-testid="sos-vehicle-option"
            />
          ))}
          <OptionCard
            checked={!draft.vehicleId}
            onSelect={() => update({ vehicleId: '', plate: '', vehicleTouched: true, vehiclePicked: true })}
            title={`${draft.vehicle === 'MOBIL' ? 'Mobil' : 'Motor'} lain`}
            description="Isi platnya di bawah (opsional)"
            data-testid="sos-vehicle-other"
          />
          {!draft.vehicleId && plateInput}
        </div>
      )}

      {step === 'keluhan' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROBLEMS.map((p) => {
              const selected = draft.category === p.category;
              return (
                <button
                  type="button"
                  key={p.label}
                  aria-pressed={selected}
                  onClick={() =>
                    // Keep what the customer already typed; only fill in an empty box or replace another preset.
                    update({ category: p.category, ...(!draft.problem.trim() || PROBLEMS.some((x) => x.text === draft.problem) ? { problem: p.text } : {}) })
                  }
                  className={cx(
                    'flex min-h-11 flex-col items-start gap-2 rounded-xl border p-3 text-left transition',
                    selected ? 'border-emergency bg-emergency-soft ring-1 ring-emergency' : 'border-line bg-card hover:border-emergency/50',
                  )}
                >
                  <Icon name={p.icon} className={selected ? 'text-emergency-ink' : 'text-ink-2'} />
                  <span className="text-sm font-semibold text-ink">{p.label}</span>
                </button>
              );
            })}
          </div>
          <TextArea
            label="Apa yang terjadi?"
            required
            value={draft.problem}
            onChange={(e) => update({ problem: e.target.value })}
            placeholder="mis. Ban belakang bocor, motor tidak bisa jalan"
            maxLength={900}
            id="sos-problem"
            data-testid="sos-problem"
          />
          {matching.length === 0 && plateInput}
          <div id="sos-price">
            <PriceRangeField value={draft.range} onChange={(range) => update({ range })} />
          </div>
        </div>
      )}

      {step === 'kontak' && (
        <div className="flex flex-col gap-4">
          {!user && (
            <Input
              id="sos-guest-name"
              label="Nama Anda"
              icon="person"
              required
              value={draft.guest.name}
              onChange={(e) => update({ guest: { ...draft.guest, name: e.target.value } })}
              data-testid="sos-guest-name"
            />
          )}
          <Input
            label="Nomor WhatsApp"
            icon="call"
            inputMode="tel"
            required
            value={draft.guest.whatsapp}
            onChange={(e) => update({ guest: { ...draft.guest, whatsapp: e.target.value } })}
            placeholder="08xxxxxxxxxx"
            hint={needsPhone ? 'Disimpan di akun Anda, jadi cukup diisi sekali.' : 'Mekanik menghubungi Anda lewat nomor ini.'}
            id="sos-guest-wa"
            data-testid={needsPhone ? 'sos-user-wa' : 'sos-guest-wa'}
          />
          {!user && (
            <p className="text-sm text-ink-2">
              Sudah punya akun?{' '}
              <Link to="/login" state={{ from: '/emergency?langkah=kontak' }} className="font-semibold text-primary hover:underline">
                Masuk
              </Link>{' '}
              (isian Anda tetap tersimpan)
            </p>
          )}
        </div>
      )}

      {step === 'kirim' && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-line bg-card px-4" data-testid="sos-review">
            <ReviewRow label="Lokasi" onEdit={() => flow.go('lokasi')}>
              {draft.addressNote || 'Titik di peta'}
              {position && (
                <span className="block font-label text-xs font-normal text-ink-2">
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </span>
              )}
            </ReviewRow>
            <ReviewRow label="Bengkel prioritas" onEdit={() => flow.go('bengkel')}>
              {priority ? priority.name : 'Semua bengkel sedang sibuk, permintaan menunggu mekanik kosong'}
              {workshops.length > 1 && <span className="block text-xs font-normal text-ink-2">{workshops.length - 1} bengkel lain siaga sebagai cadangan</span>}
            </ReviewRow>
            <ReviewRow label="Kendaraan" onEdit={() => flow.go(matching.length ? 'kendaraan' : 'bengkel')}>
              <span className="inline-flex items-center gap-2">
                <Icon name={draft.vehicle === 'MOBIL' ? 'directions_car' : 'two_wheeler'} className="text-[20px] text-primary" />
                {selectedVehicle ? vehicleName(selectedVehicle) : draft.vehicle === 'MOBIL' ? 'Mobil' : 'Motor'}
              </span>
              {draft.plate && <span className="block text-xs font-normal text-ink-2">{draft.plate}</span>}
            </ReviewRow>
            <ReviewRow label="Masalah" onEdit={() => flow.go('keluhan')}>
              {problemLabel && <span className="block">{problemLabel}</span>}
              <span className="block font-normal text-ink-2">{draft.problem.trim()}</span>
            </ReviewRow>
            <ReviewRow label="Kisaran biaya" onEdit={() => flow.go('keluhan')}>
              {rangeLabel(draft.range)}
            </ReviewRow>
            <ReviewRow label="Kontak" onEdit={flow.steps.some((s) => s.id === 'kontak') ? () => flow.go('kontak') : undefined}>
              {user ? user.name : draft.guest.name}
              <span className="block text-xs font-normal text-ink-2">{needsPhone || !user ? draft.guest.whatsapp : user.phone}</span>
            </ReviewRow>
          </div>
          {request.error && (
            <Alert tone="danger">
              {errorMessage(request.error)}
              {errorCode(request.error) === 'ACTIVE_EMERGENCY_EXISTS' && (
                <>
                  {' '}
                  <Link to="/orders" className="font-semibold underline">
                    Lihat pesanan aktif
                  </Link>
                </>
              )}
            </Alert>
          )}
          <SafetyBanner />
        </div>
      )}

      {tried === step && <MissingFields className="mt-5" items={missingFor(step)} />}

      <BottomBar>
        {!flow.isFirst && (
          <ScreenAction variant="secondary" className="!w-auto shrink-0 px-5" onClick={flow.back} data-testid="step-back">
            Kembali
          </ScreenAction>
        )}
        {flow.isLast ? (
          <ScreenAction variant="danger" className="flex-1" onClick={() => request.mutate()} loading={request.isPending} data-testid="sos-submit">
            Kirim SOS
          </ScreenAction>
        ) : (
          <ScreenAction className="flex-1" onClick={next} disabled={step === 'bengkel' && scan.isPending} data-testid="step-next">
            Lanjut
          </ScreenAction>
        )}
      </BottomBar>
      {geo.dialog}
    </div>
  );
}

/** Budget range for the SOS. Empty = "Bisa dibicarakan" (the workshop sets the price after diagnosis). */
export function PriceRangeField({ value, onChange }: { value: PriceRange; onChange: (r: PriceRange) => void }) {
  const same = (r: PriceRange) => (r.min ?? 0) === (value.min ?? 0) && (r.max ?? 0) === (value.max ?? 0);
  const num = (v: string) => (v ? Math.max(0, Math.round(Number(v))) || undefined : undefined);
  const invalid = !!value.min && !!value.max && value.min > value.max;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-low p-4" data-testid="sos-price-range">
      <div>
        <p className="font-label text-xs font-semibold text-ink">Kisaran biaya yang Anda siapkan</p>
        <p className="text-xs text-ink-3">Harga pasti ditentukan bengkel setelah diagnosa di lokasi. Pilih “Bisa dibicarakan” jika belum tahu.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kisaran biaya">
        {PRICE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            role="radio"
            aria-checked={same(p.range)}
            onClick={() => onChange(p.range)}
            className={cx(
              'h-9 rounded-lg border px-3.5 font-label text-xs font-semibold transition',
              same(p.range) ? 'border-primary bg-primary text-on-primary' : 'border-line bg-card text-ink hover:border-primary/50',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Minimal (Rp)" type="number" min={0} step={5000} value={value.min ?? ''} onChange={(e) => onChange({ ...value, min: num(e.target.value) })} placeholder="0" />
        <Input label="Maksimal (Rp)" type="number" min={0} step={5000} value={value.max ?? ''} onChange={(e) => onChange({ ...value, max: num(e.target.value) })} placeholder="Tanpa batas" />
      </div>
      {invalid ? (
        <p className="text-xs text-emergency-ink">Nilai minimal lebih besar dari maksimal.</p>
      ) : (
        <p className="font-label text-xs text-ink-2">
          Dikirim ke bengkel: <b className="text-ink">{rangeLabel(value)}</b>
        </p>
      )}
    </div>
  );
}
