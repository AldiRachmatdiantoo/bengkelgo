import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { workshopApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { VehicleType, Workshop } from '@/services/api/types';
import { useGeolocation } from '@/hooks/useGeolocation';
import { PHONE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_CENTER, PointsMap } from '@/components/map/Maps';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { useReverseAddress } from '@/components/map/AddressHint';
import { DateStrip, WorkshopCard, dotTime, friendlyDay, monthYear, regionOf } from '@/components/workshop/WorkshopComponents';
import { ChoiceChip, OptionCard, ScreenSection } from '@/components/ui/screen';
import { Alert, Button, EmptyState, Icon, Input, Pagination, SectionHeading, Select, cx, SkeletonCards } from '@/components/ui';
import { distance, jakartaDate } from '@/utils/format';

type Tab = 'booking' | 'sos' | 'cari';
type Sort = 'near' | 'recommended' | 'rating';

/** Workshop cards per page on phones. */
const PAGE_SIZE = 10;

/** Booking hours offered by the slot filter (workshops' own hours are checked by the API). */
const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`);

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'booking', label: 'Booking', icon: 'calendar_month' },
  { key: 'cari', label: 'Terdekat', icon: 'near_me' },
  { key: 'sos', label: 'Darurat', icon: 'emergency' },
];

const VEHICLES: { value: VehicleType | ''; label: string; icon: string }[] = [
  { value: '', label: 'Semua', icon: 'garage' },
  { value: 'MOTOR', label: 'Motor', icon: 'two_wheeler' },
  { value: 'MOBIL', label: 'Mobil', icon: 'directions_car' },
];

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recommended', label: 'Rekomendasi' },
  { value: 'near', label: 'Terdekat' },
  { value: 'rating', label: 'Rating' },
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

  // The home page's MOTOR / MOBIL cards and search box arrive with ?vehicle= and ?q=.
  const vParam = params.get('vehicle');
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [vehicle, setVehicle] = useState<VehicleType | ''>(vParam === 'MOTOR' || vParam === 'MOBIL' ? vParam : '');
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
  // Phones: two cards per row and 10 per page; larger screens show the whole list.
  const phone = useMediaQuery(PHONE_QUERY);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [data]);
  const pages = phone ? Math.ceil(list.length / PAGE_SIZE) : 1;
  const current = Math.min(page, Math.max(pages, 1));
  const shown = phone ? list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) : list;
  const goToPage = (n: number) => {
    setPage(n);
    showResults();
  };

  return (
    <div className="flex flex-col gap-10">
      {geo.dialog}
      <section ref={cardRef} id="booking" className="scroll-mt-28">
        <h1 className="text-display text-ink">Pilih bengkel</h1>
        <p className="mt-1.5 max-w-2xl text-subtitle text-ink-2">
          Booking servis terjadwal, cari bengkel terdekat, atau minta bantuan darurat.{' '}
          <Link to="/#cara-kerja" className="font-bold text-primary hover:underline">
            Cara kerja
          </Link>
        </p>

        <div className="mt-6 grid max-w-2xl grid-cols-3 gap-2" role="tablist" aria-label="Kebutuhan Anda">
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
                  'inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  active
                    ? t.key === 'sos'
                      ? 'border-emergency bg-emergency text-white'
                      : 'border-primary bg-primary text-on-primary'
                    : 'border-line bg-card text-ink hover:border-line-strong',
                )}
              >
                <span className="hidden sm:inline-flex">
                  <Icon name={t.icon} className={cx('text-[18px]', !active && (t.key === 'sos' ? 'text-emergency-ink' : 'text-primary'))} />
                </span>
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-x-8 lg:grid-cols-2">
          {tab !== 'sos' && (
            <>
              <ScreenSection title="Lokasi" className="mt-0 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <PlaceSearch
                    className="flex-1"
                    near={geo.position}
                    placeholder="Cari daerah, mis. Ketintang Surabaya"
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
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-2" data-testid="search-around">
                    <span>
                      Di sekitar <b className="text-ink">{placeLabel ?? (gpsAddress.data ? `${gpsAddress.data.name} (GPS)` : 'lokasi GPS Anda')}</b>
                    </span>
                    <label className="inline-flex items-center gap-1.5">
                      <span className="sr-only">Radius pencarian</span>
                      <select
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(Number(e.target.value))}
                        className="h-8 rounded-md border border-line bg-card px-2 text-xs font-bold text-ink focus:border-primary focus:outline-none"
                        aria-label="Radius pencarian"
                      >
                        {[2, 5, 10, 20, 50].map((r) => (
                          <option key={r} value={r}>
                            Radius {r} km
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        geo.setPosition(null);
                        setPlaceLabel(null);
                      }}
                      className="font-bold text-primary hover:underline"
                    >
                      Hapus lokasi
                    </button>
                  </div>
                )}
                {geo.error && (
                  <div className="mt-3">
                    <Alert tone="warning">{geo.error}</Alert>
                  </div>
                )}
              </ScreenSection>

              <ScreenSection title="Kendaraan" className="lg:mt-6">
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Jenis kendaraan">
                  {VEHICLES.map((v) => (
                    <ChoiceChip key={v.value} checked={vehicle === v.value} onSelect={() => setVehicle(v.value)}>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name={v.icon} className="text-[18px]" /> {v.label}
                      </span>
                    </ChoiceChip>
                  ))}
                </div>
              </ScreenSection>

              <ScreenSection title="Nama bengkel" className="lg:mt-6">
                <Input aria-label="Nama bengkel" icon="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Opsional, mis. Jaya Motor" data-testid="search-input" />
              </ScreenSection>
            </>
          )}

          {tab === 'booking' && (
            <ScreenSection title="Jadwal servis" aside={monthYear(date)} className="lg:col-span-2">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px] lg:items-start">
                <DateStrip value={date} onChange={setDate} />
                <Select aria-label="Jam servis" value={hours.includes(slotTime) ? slotTime : ''} onChange={(e) => setSlotTime(e.target.value)} data-testid="search-slot" icon="schedule">
                  <option value="">Semua jam</option>
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {dotTime(h)} WIB
                    </option>
                  ))}
                </Select>
              </div>
              <p className="mt-2.5 text-xs text-ink-2">
                {friendlyDay(date)}
                {slotTime && hours.includes(slotTime) ? ' · hanya bengkel yang masih punya tempat di jam ini' : ''}
              </p>
            </ScreenSection>
          )}

          {tab === 'cari' && (
            <ScreenSection title="Urutkan" className="lg:col-span-2">
              <div className="grid max-w-2xl grid-cols-3 gap-2" role="radiogroup" aria-label="Urutkan">
                {SORTS.map((s) => (
                  <ChoiceChip
                    key={s.value}
                    checked={(!geo.position && sort === 'near' ? 'recommended' : sort) === s.value}
                    onSelect={() => {
                      setSort(s.value);
                      if (s.value === 'near' && !geo.position) void geo.locate();
                    }}
                  >
                    {s.label}
                  </ChoiceChip>
                ))}
              </div>
            </ScreenSection>
          )}

          {tab === 'sos' && (
            <div className="flex flex-col gap-5 lg:col-span-2 lg:max-w-2xl">
              <div className="flex items-start gap-3 rounded-lg border border-emergency/40 bg-emergency-soft px-4 py-3.5">
                <Icon name="my_location" className="mt-px text-emergency-ink" />
                <div className="min-w-0 flex-1">
                  <p className="text-subtitle font-bold text-emergency-ink">Lokasi Anda (radius 5 km)</p>
                  <p className="mt-0.5 text-sm text-ink-2">
                    {geo.position ? `${geo.position.lat.toFixed(5)}, ${geo.position.lng.toFixed(5)}` : (geo.error ?? 'Lokasi belum terdeteksi')}. Bengkel aktif di sekitar titik ini
                    dihubungi otomatis.
                  </p>
                </div>
                <button type="button" onClick={geo.locate} disabled={geo.locating} className="min-h-11 shrink-0 rounded-md px-2 text-sm font-bold text-emergency-ink hover:underline disabled:opacity-60">
                  {geo.locating ? 'Mencari…' : geo.position ? 'Perbarui' : 'Deteksi'}
                </button>
              </div>
              <ScreenSection title="Masalah kendaraan" className="mt-0">
                <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Masalah kendaraan">
                  {PROBLEMS.map((p) => (
                    <OptionCard key={p.label} checked={problem === p.text} onSelect={() => setProblem(p.text)} title={p.label} description={p.hint} />
                  ))}
                </div>
              </ScreenSection>
              <p className="text-xs text-ink-2">Bengkel wajib merespons dalam 2 menit, atau permintaan dialihkan otomatis ke bengkel lain.</p>
              <Button variant="danger" size="lg" icon="e911_emergency" onClick={() => navigate('/emergency', { state: { position: geo.position, problem } })}>
                Lanjut kirim bantuan darurat
              </Button>
            </div>
          )}
        </div>
      </section>

      {tab !== 'sos' && (
        <section ref={resultsRef} id="hasil" className="scroll-mt-24">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-xl font-bold text-ink">{geo.position ? 'Bengkel terdekat' : 'Rekomendasi bengkel'}</h2>
            {data && <span className="shrink-0 text-sm text-ink-2">{list.length} bengkel</span>}
          </div>
          {isLoading ? (
            <SkeletonCards media count={6} label="Mencari bengkel…" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3" />
          ) : error ? (
            <Alert tone="danger">{errorMessage(error)}</Alert>
          ) : list.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                {shown.map((w) => (
                  <WorkshopCard key={w.id} workshop={w} featured={w.id === list[0].id} date={tab === 'booking' ? date : undefined} />
                ))}
              </div>
              <Pagination className="mt-6" page={current} pages={pages} total={list.length} pageSize={PAGE_SIZE} onChange={goToPage} />
            </>
          ) : (
            <EmptyState icon="search_off">Tidak ada bengkel yang cocok dengan filter. Coba perluas radius atau ubah kata kunci.</EmptyState>
          )}
        </section>
      )}

      {list.length > 0 && tab !== 'sos' && <RadarSection workshops={list} origin={geo.position} />}
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
        eyebrow={<span className="text-emergency-ink">Peta bengkel terdekat</span>}
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
          <div className="absolute top-4 left-4 z-[500] w-[min(320px,calc(100%-2rem))] rounded-xl bg-card/95 p-4 shadow-lift backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md bg-emergency px-1.5 py-0.5 font-label text-[10px] font-bold text-white uppercase">{origin ? 'Terdekat terdeteksi' : 'Rekomendasi'}</span>
              <span className="font-label text-[11px] text-ink-3">{regionOf(top.address)}</span>
            </div>
            <p className="mt-2 font-bold text-ink">{top.name}</p>
            <p className="line-clamp-2 text-xs text-ink-2">{top.description || top.address}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface-low px-2.5 py-2">
                <p className="font-label text-[10px] font-bold text-ink-3 uppercase">{origin ? 'Jarak' : 'Jam buka'}</p>
                <p className="text-sm font-bold text-ink">{origin ? distance(top.distance_meters) : `${top.open_time}–${top.close_time}`}</p>
              </div>
              <div className="rounded-lg bg-surface-low px-2.5 py-2">
                <p className="font-label text-[10px] font-bold text-ink-3 uppercase">Rating bengkel</p>
                <p className="text-sm font-bold text-ink">★ {top.avg_rating > 0 ? `${top.avg_rating.toFixed(1)} / 5.0` : 'Baru'}</p>
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
