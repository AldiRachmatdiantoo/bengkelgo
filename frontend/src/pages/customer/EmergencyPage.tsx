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
import { Alert, Badge, Button, Card, EmptyState, Icon, Input, MissingFields, Segmented, Select, Stars, TextArea, cx } from '@/components/ui';
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

export default function EmergencyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Prefill from the SOS tab on the landing page (location + chosen problem).
  const prefill = (useLocation().state as { position?: LatLng | null; problem?: string } | null) ?? {};
  const geo = useGeolocation();
  const [vehicle, setVehicle] = useState<VehicleType>('MOTOR');
  const [problem, setProblem] = useState(prefill.problem ?? '');
  const [category, setCategory] = useState<ProblemCategory | undefined>(() => PROBLEMS.find((p) => p.text === prefill.problem)?.category);
  const [vehicleId, setVehicleId] = useState('');
  const canSaveVehicles = user?.role === 'CUSTOMER' || user?.role === 'GUEST';
  const vehicles = useQuery({ queryKey: ['vehicles'], queryFn: vehicleApi.list, enabled: canSaveVehicles });
  useEffect(() => {
    if (prefill.position) geo.setPosition(prefill.position);
    // Only once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [addressNote, setAddressNote] = useState('');
  const [plate, setPlate] = useState('');
  const [guest, setGuest] = useState({ name: '', whatsapp: '' });
  // Signed in with Google and no phone number yet: the mechanic needs one to call, so it is asked here.
  const needsPhone = !!user && !user.phone;
  // Default: price is negotiated with the workshop; the customer may set a budget range.
  const [range, setRange] = useState<PriceRange>({});

  const scan = useMutation({ mutationFn: () => emergencyApi.scan({ latitude: geo.position!.lat, longitude: geo.position!.lng, vehicle_type: vehicle }) });

  const request = useMutation({
    mutationFn: async () => {
      const pos = geo.position!;
      // Not logged in -> quick guest session (name + WhatsApp + GPS), then send the SOS.
      if (!user) await authApi.guest({ name: guest.name, whatsapp: guest.whatsapp, latitude: pos.lat, longitude: pos.lng });
      else if (needsPhone) await accountApi.update({ phone: guest.whatsapp.trim() });
      return emergencyApi.request({
        latitude: pos.lat,
        longitude: pos.lng,
        vehicle_type: vehicle,
        problem_description: problem.trim(),
        problem_category: category,
        price_min: range.min,
        price_max: range.max,
        address_note: addressNote || undefined,
        vehicle_plate: plate || undefined,
        vehicle_id: vehicleId || undefined,
      });
    },
    onSuccess: (o) => navigate(`/orders/${o.id}`),
  });

  if (user && (user.role === 'WORKSHOP_OWNER' || user.role === 'ADMIN')) {
    return <Alert tone="warning">Fitur darurat hanya untuk pelanggan. Keluar terlebih dahulu untuk mencoba sebagai tamu.</Alert>;
  }

  const workshops = scan.data?.workshops ?? [];
  // Routing skips workshops without a free mechanic, so the "priority" pick is the first one that has one.
  const priorityId = workshops.find((w) => w.available_mechanics > 0)?.id;
  const badRange = !!range.min && !!range.max && range.min > range.max;
  const canSend =
    !!geo.position && problem.trim().length >= 5 && !badRange && (user ? !needsPhone || isIdPhone(guest.whatsapp) : guest.name.trim().length >= 2 && isIdPhone(guest.whatsapp));
  const missing = [
    !geo.position && { label: 'Lokasi Anda (GPS atau titik di peta)', target: 'sos-location' },
    problem.trim().length < 5 && { label: 'Apa yang terjadi (min. 5 karakter)', target: 'sos-problem' },
    badRange && { label: 'Kisaran biaya: minimum melebihi maksimum', target: 'sos-price' },
    !user && guest.name.trim().length < 2 && { label: 'Nama Anda', target: 'sos-guest-name' },
    (!user || needsPhone) && !isIdPhone(guest.whatsapp) && { label: guest.whatsapp.trim() ? 'Nomor WhatsApp belum benar (mis. 0812…)' : 'Nomor WhatsApp', target: 'sos-guest-wa' },
  ];

  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      {/* Hero */}
      {/* Deep SOS orange (#C2410C) behind long white text: 5.2:1 contrast (WCAG AA). */}
      <section className="relative overflow-hidden rounded-xl bg-emergency-ink p-6 text-white shadow-lift sm:p-8">
        <div className="pointer-events-none absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-card text-emergency-ink animate-beacon">
            <Icon name="e911_emergency" filled className="text-[30px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-label text-xs font-bold tracking-[0.06em] text-white uppercase">Layanan darurat 24 jam · radius 5 km</p>
            <h1 className="mt-1 text-[20px] leading-tight font-bold tracking-[-0.015em] sm:text-[24px]">Kendaraan mogok? Kami kirim mekanik terdekat.</h1>
            <p className="mt-1 text-subtitle text-white">
              Bengkel terdekat dengan mekanik terbaik dihubungi lebih dulu. Jika tidak merespons dalam 2 menit, permintaan dialihkan otomatis ke bengkel berikutnya.
            </p>
          </div>
        </div>
      </section>

      <form
        className="grid gap-6 lg:grid-cols-[1fr_400px]"
        onSubmit={(e) => {
          e.preventDefault();
          request.mutate();
        }}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* 1. Location */}
          <Card id="sos-location" title="1. Lokasi Anda" icon="my_location" subtitle="Gunakan GPS atau klik peta untuk menandai titik kendaraan.">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger" icon="my_location" onClick={geo.locate} loading={geo.locating} data-testid="sos-gps">
                  Gunakan GPS saya
                </Button>
                {geo.position && (
                  <span className="inline-flex items-center gap-1.5 font-label text-xs text-ink-2">
                    <Icon name="check_circle" filled className="text-success" />
                    {geo.position.lat.toFixed(5)}, {geo.position.lng.toFixed(5)}
                  </span>
                )}
              </div>
              {geo.error && <Alert tone="warning">{geo.error}</Alert>}
              <PlaceSearch
                near={geo.position}
                placeholder="Atau cari lokasi: nama jalan, daerah, patokan"
                onPick={(p) => geo.setPosition({ lat: p.lat, lng: p.lng })}
              />
              <MapPicker value={geo.position} onChange={geo.setPosition} height={300} />
              <p className="-mt-2 font-label text-xs text-ink-3">Hasil pencarian menandai titik perkiraan. Klik peta untuk menggeser ke posisi kendaraan yang tepat.</p>
              <AddressHint
                point={geo.position}
                useLabel="Salin ke patokan"
                onUse={(a) => setAddressNote((prev) => (prev.trim() && !prev.includes(a) ? `${prev.trim()} (${a})` : a).slice(0, 300))}
              />
              <Input label="Patokan lokasi (opsional)" icon="pin_drop" value={addressNote} onChange={(e) => setAddressNote(e.target.value)} placeholder="mis. Depan minimarket, sebelah SPBU" />
            </div>
          </Card>

          {/* 2. Problem */}
          <Card title="2. Kendaraan & kendala" icon="car_crash">
            <div className="flex flex-col gap-5">
              {!!vehicles.data?.length && (
                <Select
                  label="Kendaraan tersimpan"
                  icon="garage"
                  value={vehicleId}
                  data-testid="sos-vehicle"
                  onChange={(e) => {
                    const v = vehicles.data!.find((x) => x.id === e.target.value);
                    setVehicleId(e.target.value);
                    if (v) {
                      setVehicle(v.vehicle_type);
                      setPlate(v.plate ?? '');
                    }
                  }}
                >
                  <option value="">Pilih kendaraan lain / isi manual</option>
                  {vehicles.data.map((v) => (
                    <option key={v.id} value={v.id}>
                      {vehicleName(v)}
                      {v.plate ? ` (${v.plate})` : ''}
                    </option>
                  ))}
                </Select>
              )}
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-label text-xs font-semibold">Jenis kendaraan</span>
                  <Segmented
                    label="Jenis kendaraan"
                    value={vehicle}
                    onChange={(v) => {
                      setVehicle(v);
                      setVehicleId(''); // a manual type no longer matches the saved vehicle
                    }}
                    options={[
                      { value: 'MOTOR', label: 'Motor', icon: 'two_wheeler' },
                      { value: 'MOBIL', label: 'Mobil', icon: 'directions_car' },
                    ]}
                  />
                </div>
                <div className="min-w-48 flex-1">
                  <Input label="Plat nomor (opsional)" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="B 1234 XYZ" />
                </div>
              </div>
              <div>
                <p className="mb-2 font-label text-xs font-semibold">Pilih masalah kendaraan</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PROBLEMS.map((p) => {
                    const selected = category === p.category;
                    return (
                      <button
                        type="button"
                        key={p.label}
                        aria-pressed={selected}
                        onClick={() => {
                          setCategory(p.category);
                          // Keep what the customer already typed; only fill in an empty box or replace another preset.
                          if (!problem.trim() || PROBLEMS.some((x) => x.text === problem)) setProblem(p.text);
                        }}
                        className={cx(
                          'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition',
                          selected ? 'border-emergency bg-emergency-soft ring-1 ring-emergency' : 'border-line bg-card hover:border-emergency/50',
                        )}
                      >
                        <Icon name={p.icon} className={selected ? 'text-emergency' : 'text-ink-2'} />
                        <span className="text-sm font-semibold text-navy">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <TextArea
                label="Apa yang terjadi?"
                required
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="mis. Ban belakang bocor, motor tidak bisa jalan"
                maxLength={900}
                id="sos-problem"
                data-testid="sos-problem"
              />
              <div id="sos-price">
                <PriceRangeField value={range} onChange={setRange} />
              </div>
            </div>
          </Card>

          {/* 3. Guest contact */}
          {!user && (
            <Card title="3. Kontak Anda" icon="contact_phone" subtitle="Tanpa akun? Tidak masalah, Anda masuk sebagai tamu.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input id="sos-guest-name" label="Nama Anda" icon="person" required value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} data-testid="sos-guest-name" />
                <Input
                  label="Nomor WhatsApp"
                  icon="call"
                  required
                  value={guest.whatsapp}
                  onChange={(e) => setGuest({ ...guest, whatsapp: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  id="sos-guest-wa"
                  data-testid="sos-guest-wa"
                />
              </div>
              <p className="mt-3 text-sm text-ink-2">
                Sudah punya akun?{' '}
                <Link to="/login" state={{ from: '/emergency' }} className="font-semibold text-primary hover:underline">
                  Masuk
                </Link>
              </p>
            </Card>
          )}
          {needsPhone && (
            <Card title="3. Nomor WhatsApp Anda" icon="contact_phone" subtitle="Akun Google tidak menyertakan nomor telepon. Mekanik menghubungi Anda lewat nomor ini.">
              <div className="max-w-sm">
                <Input
                  label="Nomor WhatsApp"
                  icon="call"
                  inputMode="tel"
                  required
                  value={guest.whatsapp}
                  onChange={(e) => setGuest({ ...guest, whatsapp: e.target.value })}
                  placeholder="08xxxxxxxxxx"
                  hint="Disimpan di akun Anda, jadi cukup diisi sekali."
                  id="sos-guest-wa"
                  data-testid="sos-user-wa"
                />
              </div>
            </Card>
          )}
          {/* Phones: the full checklist sits here in the page; the fixed send bar only shows a one-line summary. */}
          <div id="sos-missing" className="lg:hidden">
            <MissingFields items={missing} />
          </div>
        </div>

        {/* Nearby + send */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <Card
            title="Bengkel siaga dalam 5 km"
            icon="radar"
            actions={
              <Button size="sm" variant="secondary" icon="search" disabled={!geo.position} loading={scan.isPending} onClick={() => scan.mutate()}>
                Pindai
              </Button>
            }
          >
            {!scan.data ? (
              <EmptyState icon="travel_explore">Tentukan lokasi lalu tekan “Pindai” untuk melihat bengkel yang siap membantu.</EmptyState>
            ) : (
              <div className="flex flex-col gap-4">
                <PointsMap
                  origin={geo.position!}
                  originLabel="Titik mogok Anda"
                  radiusMeters={scan.data.radius_meters}
                  points={workshops.map((w) => ({ id: w.id, lat: w.latitude, lng: w.longitude, label: w.name, highlight: w.id === priorityId }))}
                  height={220}
                />
                {workshops.length === 0 ? (
                  <Alert tone="danger">Tidak ada bengkel tersedia dalam radius 5 km.</Alert>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {workshops.map((w, i) => (
                      <li key={w.id} className={cx('flex items-center gap-3 rounded-xl border p-3', w.id === priorityId ? 'border-success/40 bg-success-soft/50' : 'border-line')}>
                        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full font-label text-sm font-bold', w.id === priorityId ? 'bg-success text-white' : 'bg-canvas text-ink-2')}>
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{w.name}</p>
                          <p className="flex flex-wrap items-center gap-x-2 font-label text-xs text-ink-2">
                            {distance(w.distance_meters)} · <Stars value={w.top_mechanic_rating} />
                          </p>
                        </div>
                        {w.id === priorityId ? <Badge tone="success">Prioritas</Badge> : w.available_mechanics === 0 && <Badge>Mekanik sibuk</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {scan.error && (
              <div className="mt-3">
                <Alert tone="danger">{errorMessage(scan.error)}</Alert>
              </div>
            )}
          </Card>

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

          {/* Mobile: one slim bar pinned to the bottom edge (thumb reach, little screen taken). Desktop: inline. */}
          <div className="fixed inset-x-0 bottom-0 z-[900] border-t border-line bg-card px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <div className="flex items-center gap-2 lg:block">
              {missing.some(Boolean) && (
                <button
                  type="button"
                  onClick={() => document.getElementById('sos-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  aria-label={`Lengkapi ${missing.filter(Boolean).length} isian lagi`}
                  className="flex h-10 shrink-0 items-center gap-1 rounded-lg bg-warning-soft px-2.5 font-label text-xs font-semibold text-warning-ink lg:hidden"
                >
                  <Icon name="checklist" className="text-[16px]" /> {missing.filter(Boolean).length} lagi
                </button>
              )}
              <Button
                type="submit"
                variant="danger"
                size="lg"
                icon="e911_emergency"
                className="min-w-0 flex-1 max-lg:h-10 max-lg:px-3 max-lg:text-sm lg:w-full"
                disabled={!canSend}
                loading={request.isPending}
                data-testid="sos-submit"
              >
                Kirim permintaan bantuan
              </Button>
            </div>
            <div className="hidden lg:block">
              <MissingFields className="mt-2" items={missing} />
            </div>
          </div>
        </aside>
      </form>

      <SafetyBanner />
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
        <p className="font-label text-xs font-semibold text-navy">Kisaran biaya yang Anda siapkan</p>
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
              same(p.range) ? 'border-primary bg-primary text-white' : 'border-line bg-card text-navy hover:border-primary/50',
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
          Dikirim ke bengkel: <b className="text-navy">{rangeLabel(value)}</b>
        </p>
      )}
    </div>
  );
}
