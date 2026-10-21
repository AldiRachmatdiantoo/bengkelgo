import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workshopApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { VehicleType, Workshop } from '@/services/api/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { DEFAULT_CENTER, PointsMap } from '@/components/map/Maps';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { useReverseAddress } from '@/components/map/AddressHint';
import { WorkshopCard, friendlyDay, regionOf } from '@/components/workshop/WorkshopComponents';
import { Alert, Button, EmptyState, Icon, Loading, SectionHeading, cx } from '@/components/ui';
import { distance, jakartaDate } from '@/utils/format';

type Tab = 'booking' | 'sos' | 'cari';
type Sort = 'near' | 'recommended' | 'rating';

/** Booking hours offered by the slot filter (workshops' own hours are checked by the API). */
const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

const TABS: { key: Tab; label: string; icon: string; badge: string; tone: string }[] = [
  { key: 'booking', label: 'Booking Servis Berkala', icon: 'calendar_month', badge: 'Anti-Antre', tone: 'bg-white/20 text-white' },
  { key: 'sos', label: 'Bantuan Darurat SOS (5 Km)', icon: 'emergency', badge: 'Respon Cepat', tone: 'bg-emergency text-white' },
  { key: 'cari', label: 'Cari Bengkel Terdekat', icon: 'storefront', badge: '', tone: '' },
];

const PROBLEMS = [
  { icon: 'battery_alert', label: 'Aki Mati / Jumper', hint: 'Jumper darurat / ganti', text: 'Aki mati, kendaraan tidak bisa distarter.' },
  { icon: 'tire_repair', label: 'Ban Bocor / Pecah', hint: 'Tambal / ban cadangan', text: 'Ban bocor, kendaraan tidak bisa jalan.' },
  { icon: 'warning', label: 'Mesin Mogok / Overheat', hint: 'Diagnosa darurat mesin', text: 'Mesin mati mendadak / overheat di jalan.' },
  { icon: 'local_gas_station', label: 'Kehabisan Bensin', hint: 'Antar bahan bakar', text: 'Kehabisan bahan bakar di jalan.' },
];

const isTab = (t: string | null): t is Tab => t === 'booking' || t === 'sos' || t === 'cari';

/** Page 2: the booking / SOS / nearby search card, results and the radar map (moved off the landing page). */
export default function WorkshopSearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLElement>(null);

  // Header links (/workshops?tab=booking|sos|cari) open the matching tab.
  const tabParam = params.get('tab');
  const tab: Tab = isTab(tabParam) ? tabParam : 'booking';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [vehicle, setVehicle] = useState<VehicleType | ''>('');
  const [radiusKm, setRadiusKm] = useState(10);
  const [date, setDate] = useState(jakartaDate(1));
  const [sort, setSort] = useState<Sort>('recommended');
  const [slotTime, setSlotTime] = useState('');
  const [problem, setProblem] = useState(PROBLEMS[0].text);
  const geo = useGeolocation();
  // Name of the place picked in the location search (null when the point came from GPS).
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const gpsAddress = useReverseAddress(placeLabel ? null : geo.position);

  // Wait until typing pauses before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Sorting happens on the server: nearest / recommended (distance + rating) need a location.
  const apiSort = geo.position ? ({ near: 'distance', recommended: 'recommended', rating: 'rating' } as const)[sort] : sort === 'rating' ? 'rating' : undefined;
  // Hours already started today can't be booked, so they aren't offered.
  const nowHour = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  const hours = date === jakartaDate(0) ? SLOT_HOURS.filter((h) => Number(h.slice(0, 2)) > nowHour) : SLOT_HOURS;
  const slotFilter = tab === 'booking' && slotTime && hours.includes(slotTime) ? { date, time_slot: slotTime } : {};
  const filters = {
    search: query || undefined,
    vehicle_type: vehicle || undefined,
    sort: apiSort,
    ...slotFilter,
    ...(geo.position ? { latitude: geo.position.lat, longitude: geo.position.lng, radius_km: radiusKm } : {}),
  };
  const { data, isLoading, error } = useQuery({ queryKey: ['workshops', filters], queryFn: () => workshopApi.list(filters) });
  const list = useMemo(() => data ?? [], [data]);
  const showResults = () => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex flex-col gap-12">
      {geo.dialog}
      <section className="relative -mx-5 -mt-8 overflow-hidden px-5 pt-8 pb-2 sm:-mx-8 sm:-mt-12 sm:px-8 sm:pt-10 lg:-mx-20 lg:px-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,#f0f3ff_0%,rgba(248,250,251,0)_70%)]" />
        <div className="relative">
          <p className="font-label text-label-sm text-primary uppercase">Cari &amp; booking</p>
          <h1 className="mt-1 text-[21px] leading-tight font-bold tracking-[-0.02em] text-navy sm:text-headline-lg">Temukan Bengkel &amp; Pesan Servis</h1>
          <p className="mt-2 max-w-2xl text-subtitle text-ink-2">
            Pilih kebutuhan Anda: booking servis terjadwal, minta bantuan darurat, atau cari bengkel terdekat.{' '}
            <Link to="/#cara-kerja" className="font-semibold text-primary hover:underline">
              Lihat cara kerja
            </Link>
          </p>

          <div ref={cardRef} id="booking" className="mt-8 scroll-mt-28 rounded-xl border border-line bg-card p-4 shadow-float sm:p-6">
            <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1" role="tablist">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={cx(
                      'inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 font-label text-sm font-semibold transition',
                      active ? (t.key === 'sos' ? 'bg-emergency text-white shadow-sm' : 'bg-primary text-white shadow-sm') : 'bg-surface-low text-navy hover:bg-surface',
                    )}
                  >
                    <Icon name={t.icon} className={cx(!active && t.key === 'sos' && 'text-emergency')} />
                    {t.label}
                    {t.badge && (
                      <span className={cx('rounded-md px-1.5 py-0.5 text-[10px] font-bold', active ? 'bg-white/20 text-white' : t.key === 'sos' ? 'bg-emergency text-white' : 'bg-primary text-white')}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {tab !== 'sos' && (
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <PlaceSearch
                    className="flex-1"
                    near={geo.position}
                    placeholder="Cari bengkel di sekitar… (mis. Margonda Depok, Stasiun Bogor)"
                    onPick={(p) => {
                      geo.setPosition({ lat: p.lat, lng: p.lng });
                      setPlaceLabel(p.label);
                    }}
                  />
                  <Button
                    variant="secondary"
                    icon="my_location"
                    loading={geo.locating}
                    onClick={() => {
                      setPlaceLabel(null);
                      void geo.locate();
                    }}
                    className="shrink-0"
                  >
                    Pakai GPS saya
                  </Button>
                </div>
                {geo.position && (
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-label text-xs text-ink-2" data-testid="search-around">
                    <Icon name="near_me" className="text-[16px] text-primary" />
                    Menampilkan bengkel di sekitar <b className="text-navy">{placeLabel ?? (gpsAddress.data ? `${gpsAddress.data.name} (lokasi GPS Anda)` : 'lokasi GPS Anda')}</b>
                    <button
                      type="button"
                      onClick={() => {
                        geo.setPosition(null);
                        setPlaceLabel(null);
                      }}
                      className="font-semibold text-primary hover:underline"
                    >
                      Hapus lokasi
                    </button>
                  </p>
                )}
              </div>
            )}

            {tab === 'booking' && (
              <div className="flex flex-col gap-4">
                <div className="grid gap-2 rounded-xl bg-surface-low p-2 sm:grid-cols-2 lg:grid-cols-4">
                  <FieldCell icon="location_on" label="Lokasi Anda" hint={geo.position ? `Radius pencarian < ${radiusKm} km` : geo.error ?? 'Belum ditentukan'}>
                    {geo.position ? (
                      <span className="flex items-center gap-2">
                        <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="min-w-0 flex-1 bg-transparent font-bold text-navy focus:outline-none" aria-label="Radius pencarian">
                          {[2, 5, 10, 20, 50].map((r) => (
                            <option key={r} value={r}>
                              {placeLabel ? 'Sekitar lokasi dipilih' : 'Sekitar saya'} · {r} km
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            geo.setPosition(null);
                            setPlaceLabel(null);
                          }}
                          className="text-ink-3 hover:text-emergency"
                          aria-label="Hapus lokasi"
                        >
                          <Icon name="close" />
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={geo.locate} className="flex items-center gap-1.5 font-bold text-primary hover:underline">
                        <Icon name="my_location" /> {geo.locating ? 'Mencari lokasi…' : 'Deteksi lokasi GPS'}
                      </button>
                    )}
                  </FieldCell>
                  <FieldCell icon="directions_car" label="Jenis Kendaraan" hint="Bengkel yang melayani kendaraan ini">
                    <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType | '')} className="w-full bg-transparent font-bold text-navy focus:outline-none" aria-label="Jenis kendaraan">
                      <option value="">Semua kendaraan</option>
                      <option value="MOTOR">Motor</option>
                      <option value="MOBIL">Mobil</option>
                    </select>
                  </FieldCell>
                  <FieldCell icon="calendar_today" label="Tanggal & Jam Servis" hint={slotTime ? `${friendlyDay(date)} · hanya bengkel yang masih ada slot` : friendlyDay(date)}>
                    <span className="flex items-center gap-2">
                      <input
                        type="date"
                        value={date}
                        min={jakartaDate(0)}
                        max={jakartaDate(30)}
                        onChange={(e) => e.target.value && setDate(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent font-bold text-navy focus:outline-none"
                        aria-label="Tanggal servis"
                      />
                      <select
                        value={hours.includes(slotTime) ? slotTime : ''}
                        onChange={(e) => setSlotTime(e.target.value)}
                        className="bg-transparent font-bold text-navy focus:outline-none"
                        aria-label="Jam servis"
                        data-testid="search-slot"
                      >
                        <option value="">Semua jam</option>
                        {hours.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </span>
                  </FieldCell>
                  <FieldCell icon="search" label="Nama Bengkel" hint="Opsional, kosongkan untuk semua">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="mis. Jaya Motor" className="w-full bg-transparent font-bold text-navy placeholder:font-normal placeholder:text-ink-3 focus:outline-none" data-testid="search-input" />
                  </FieldCell>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-label text-xs font-semibold text-ink-2">
                    <Icon name="lock" className="text-success" /> Slot jam dikunci saat konfirmasi sehingga tidak bentrok dengan pelanggan lain
                  </p>
                  <Button icon="search" onClick={showResults} className="bg-navy hover:bg-navy/90">
                    Cari Bengkel ({data?.length ?? 0})
                  </Button>
                </div>
              </div>
            )}

            {tab === 'sos' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-emergency/20 bg-emergency-soft p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-emergency-ink shadow-sm">
                    <Icon name="my_location" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label text-xs font-bold tracking-[0.04em] text-emergency-ink uppercase">Deteksi koordinat GPS (radius 5 km)</p>
                    <p className="font-semibold text-navy">{geo.position ? `${geo.position.lat.toFixed(5)}, ${geo.position.lng.toFixed(5)}` : (geo.error ?? 'Lokasi belum terdeteksi')}</p>
                    <p className="font-label text-xs text-ink-2">Bengkel aktif dalam 5 km dari titik ini akan dihubungi otomatis.</p>
                  </div>
                  <Button variant="secondary" size="sm" icon="sync" loading={geo.locating} onClick={geo.locate} className="border-emergency text-emergency-ink hover:bg-white">
                    {geo.position ? 'Perbarui Titik GPS' : 'Deteksi GPS'}
                  </Button>
                </div>
                <div>
                  <p className="mb-2 font-label text-xs font-semibold text-navy">Pilih masalah kendaraan Anda saat ini:</p>
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="radiogroup" aria-label="Masalah kendaraan">
                    {PROBLEMS.map((p) => {
                      const sel = problem === p.text;
                      return (
                        <button
                          type="button"
                          key={p.label}
                          role="radio"
                          aria-checked={sel}
                          onClick={() => setProblem(p.text)}
                          className={cx('flex items-start gap-3 rounded-xl border p-3 text-left transition', sel ? 'border-2 border-emergency bg-emergency-soft' : 'border-line bg-white hover:border-emergency/50')}
                        >
                          <Icon name={p.icon} className={sel ? 'text-emergency' : 'text-ink-2'} />
                          <span>
                            <span className="block text-sm font-bold text-navy">{p.label}</span>
                            <span className="block font-label text-[11px] text-ink-3">{p.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 font-label text-xs font-semibold text-ink-2">
                    <Icon name="timer" className="text-emergency" /> Bengkel wajib merespons dalam 2 menit, atau dialihkan otomatis
                  </p>
                  <Button variant="danger" icon="e911_emergency" onClick={() => navigate('/emergency', { state: { position: geo.position, problem } })}>
                    Lanjut Kirim Bantuan Darurat
                  </Button>
                </div>
              </div>
            )}

            {tab === 'cari' && (
              <div className="flex flex-col gap-4">
                <div className="grid gap-2 rounded-xl bg-surface-low p-2 sm:grid-cols-3">
                  <FieldCell icon="search" label="Cari Nama Bengkel" hint="Ketik minimal 1 huruf">
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="mis. Jaya Motor" className="w-full bg-transparent font-bold text-navy placeholder:font-normal placeholder:text-ink-3 focus:outline-none" />
                  </FieldCell>
                  <FieldCell icon="directions_car" label="Jenis Kendaraan" hint="Bengkel yang melayani kendaraan ini">
                    <select value={vehicle} onChange={(e) => setVehicle(e.target.value as VehicleType | '')} className="w-full bg-transparent font-bold text-navy focus:outline-none" aria-label="Jenis kendaraan">
                      <option value="">Semua kendaraan</option>
                      <option value="MOTOR">Motor</option>
                      <option value="MOBIL">Mobil</option>
                    </select>
                  </FieldCell>
                  <FieldCell icon="sort" label="Urutkan Berdasarkan" hint={geo.position ? (placeLabel ? 'Dari lokasi yang Anda pilih' : 'Lokasi Anda terdeteksi') : 'Terdekat: pilih lokasi atau GPS'}>
                    <select
                      value={!geo.position && sort === 'near' ? 'recommended' : sort}
                      onChange={(e) => {
                        const next = e.target.value as Sort;
                        setSort(next);
                        if (next === 'near' && !geo.position) geo.locate();
                      }}
                      className="w-full bg-transparent font-bold text-navy focus:outline-none"
                      aria-label="Urutkan"
                    >
                      <option value="recommended">{geo.position ? 'Rekomendasi (jarak + rating)' : 'Rekomendasi'}</option>
                      <option value="near">Paling dekat dari lokasi</option>
                      <option value="rating">Rating tertinggi</option>
                    </select>
                  </FieldCell>
                </div>
                <div className="flex justify-end">
                  <Button icon="filter_list" onClick={showResults} className="bg-navy hover:bg-navy/90">
                    Tampilkan {data?.length ?? 0} Bengkel
                  </Button>
                </div>
              </div>
            )}
            {geo.error && tab !== 'sos' && (
              <div className="mt-4">
                <Alert tone="warning">{geo.error}</Alert>
              </div>
            )}
          </div>

          {/* SOS banner right under the card */}
          <div className="mt-4 flex flex-col items-start gap-4 rounded-xl border border-line bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emergency-soft text-emergency-ink">
              <Icon name="car_crash" />
              <span className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-emergency" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-bold text-navy">
                Kendaraan Tiba-tiba Mogok di Jalan Tol atau Pemukiman?
                <span className="rounded-md bg-emergency-ink px-1.5 py-0.5 font-label text-[10px] font-bold text-white">Radius 5 Km</span>
              </p>
              <p className="text-sm text-ink-2">Tidak perlu panik mencari nomor derek tak resmi. Kirim lokasi GPS, bengkel mitra terdekat akan dihubungi otomatis.</p>
            </div>
            <Link to="/emergency" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-emergency px-5 font-label text-sm font-bold text-white shadow-sm hover:bg-emergency-dark">
              <Icon name="phone_in_talk" /> SOS Panggil Sekarang
            </Link>
          </div>
        </div>
      </section>

      <section ref={resultsRef} id="hasil" className="scroll-mt-24">
        <SectionHeading
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <span className="rounded-md bg-navy px-1.5 py-0.5 text-white normal-case">Top Verified</span> Mitra terverifikasi admin
            </span>
          }
          title={geo.position ? 'Bengkel Rekomendasi Terdekat' : 'Bengkel Rekomendasi'}
          subtitle={geo.position ? `Dalam radius ${radiusKm} km dari lokasi Anda, diurutkan dari yang paling dekat.` : 'Diurutkan berdasarkan rating pelanggan.'}
          action={data && <span className="font-label text-sm text-ink-3">{list.length} bengkel ditemukan</span>}
        />
        {isLoading ? (
          <Loading text="Mencari bengkel…" />
        ) : error ? (
          <Alert tone="danger">{errorMessage(error)}</Alert>
        ) : list.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((w, i) => (
              <WorkshopCard key={w.id} workshop={w} featured={i === 0} date={date} />
            ))}
          </div>
        ) : (
          <EmptyState icon="search_off">Tidak ada bengkel yang cocok dengan filter. Coba perluas radius atau ubah kata kunci.</EmptyState>
        )}
      </section>

      {list.length > 0 && <RadarSection workshops={list} origin={geo.position} />}
    </div>
  );
}

function FieldCell({ icon, label, hint, children }: { icon: string; label: string; hint: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <span className="flex items-center gap-1.5 font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">
        <Icon name={icon} className="text-[16px] text-primary" /> {label}
      </span>
      <div className="min-h-7 text-[14px]">{children}</div>
      <span className="truncate font-label text-[11px] text-ink-3">{hint}</span>
    </div>
  );
}

function RadarSection({ workshops, origin }: { workshops: Workshop[]; origin: { lat: number; lng: number } | null }) {
  const top = workshops[0];
  const center = origin ?? (top ? { lat: top.latitude, lng: top.longitude } : DEFAULT_CENTER);
  const sosReady = workshops.filter((w) => w.accepts_emergency && w.is_open).length;
  return (
    <section>
      <SectionHeading
        eyebrow={<span className="text-emergency-ink">Radar bengkel realtime</span>}
        title="Pantau Bengkel Aktif di Sekitar Anda"
        subtitle="Lokasi bengkel mitra dari data terbaru. Panggilan darurat menjangkau bengkel dalam radius 5 km."
        action={
          <span className="inline-flex items-center gap-2 rounded-full bg-sky px-3 py-1.5 font-label text-xs font-bold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" /> {sosReady} bengkel siaga SOS
          </span>
        }
      />
      <div className="relative">
        <PointsMap
          origin={center}
          hideOrigin={!origin}
          originLabel="Lokasi Anda"
          radiusMeters={origin ? 5000 : undefined}
          zoom={origin ? 13 : 12}
          points={workshops.map((w, i) => ({ id: w.id, lat: w.latitude, lng: w.longitude, label: w.name, highlight: i === 0 }))}
          height={380}
          className="shadow-sm"
        />
        {top && (
          <div className="absolute top-4 left-4 z-[500] w-[min(320px,calc(100%-2rem))] rounded-xl bg-white/95 p-4 shadow-lift backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md bg-emergency-ink px-1.5 py-0.5 font-label text-[10px] font-bold text-white uppercase">{origin ? 'Terdekat terdeteksi' : 'Rekomendasi'}</span>
              <span className="font-label text-[11px] text-ink-3">{regionOf(top.address)}</span>
            </div>
            <p className="mt-2 font-bold text-navy">{top.name}</p>
            <p className="line-clamp-2 text-xs text-ink-2">{top.description || top.address}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-low px-2.5 py-2">
                <p className="font-label text-[10px] font-bold text-ink-3 uppercase">{origin ? 'Jarak' : 'Jam buka'}</p>
                <p className="text-sm font-bold text-navy">{origin ? distance(top.distance_meters) : `${top.open_time}–${top.close_time}`}</p>
              </div>
              <div className="rounded-lg bg-surface-low px-2.5 py-2">
                <p className="font-label text-[10px] font-bold text-ink-3 uppercase">Rating bengkel</p>
                <p className="text-sm font-bold text-navy">★ {top.avg_rating > 0 ? `${top.avg_rating.toFixed(1)} / 5.0` : 'Baru'}</p>
              </div>
            </div>
            <Link to="/emergency" className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-emergency font-label text-sm font-bold text-white hover:bg-emergency-dark">
              <Icon name="warning" /> Panggil Bantuan Sekarang
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
