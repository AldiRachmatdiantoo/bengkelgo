import { Link } from 'react-router-dom';
import type { Mechanic, Review, Service, SlotAvailability, VehicleType, Workshop } from '@/services/api/types';
import { EmptyState, Icon, Stars, cx } from '@/components/ui';
import { dateTime, distance, jakartaDate, rupiah } from '@/utils/format';

export const vehicleLabel = (v: VehicleType) => (v === 'MOTOR' ? 'Motor' : 'Mobil');
export const vehicleIcon = (v: VehicleType) => (v === 'MOTOR' ? 'two_wheeler' : 'directions_car');

/** "09:00" -> "09:00 – 10:00" (slots are hourly). */
export const slotRange = (slot: string) => {
  const h = Number(slot.slice(0, 2));
  return `${slot} – ${String((h + 1) % 24).padStart(2, '0')}:${slot.slice(3, 5)}`;
};

/** "09:00" + 75 min -> "10:15". */
export const addMinutes = (slot: string, minutes: number) => {
  const t = Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5)) + minutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Javanese market day (Legi, Pahing, …) for a YYYY-MM-DD date; 17 Aug 1945 was Jumat Legi. */
const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
export function pasaran(isoDate: string) {
  const days = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - Date.parse('1945-08-17T00:00:00Z')) / 864e5);
  return PASARAN[((days % 5) + 5) % 5];
}

const weekdayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' });
const dayShortFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' });

/** "Besok, Senin Wage" */
export function friendlyDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const rel = isoDate === jakartaDate(0) ? 'Hari ini' : isoDate === jakartaDate(1) ? 'Besok' : null;
  const day = `${weekdayFmt.format(d)} ${pasaran(isoDate)}`;
  return rel ? `${rel}, ${day}` : day;
}

/** Last meaningful part of an address ("Gambir, Jakarta Pusat"). */
export const regionOf = (address: string) => address.split(',').map((p) => p.trim()).filter(Boolean).slice(-2).join(', ');

export function WorkshopCard({ workshop, featured, date }: { workshop: Workshop; featured?: boolean; date?: string }) {
  const to = `/workshops/${workshop.id}${date ? `?date=${date}` : ''}`;
  return (
    <Link
      to={to}
      data-testid="workshop-card"
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      {/* Visual header: stands in for the workshop photo until the API stores photos (BE-2). */}
      <div className="relative aspect-[16/8] overflow-hidden bg-gradient-to-br from-primary to-navy">
        <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:16px_16px]" />
        <Icon name="car_repair" className="absolute -right-4 -bottom-6 text-[140px] text-white/15" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 font-label text-[11px] font-bold text-navy shadow-sm">
          <Icon name="verified" filled className="text-[14px] text-primary" /> {featured ? 'Rekomendasi BengkelGo' : 'Mitra Resmi BengkelGo'}
        </span>
        <span className="absolute bottom-3 left-3 max-w-[70%] truncate text-lg font-bold text-white drop-shadow">{workshop.name}</span>
        {workshop.distance_meters != null && (
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-navy/80 px-2.5 py-1 font-label text-[11px] font-bold text-white backdrop-blur">
            <Icon name="pin_drop" className="text-[14px]" /> {distance(workshop.distance_meters)} dari Anda
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">{regionOf(workshop.address)}</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 font-label text-xs font-bold text-warning-ink">
            <Icon name="star" filled className="text-[14px] text-warning" />
            {workshop.avg_rating > 0 ? workshop.avg_rating.toFixed(1) : 'Baru'} ({workshop.total_reviews})
          </span>
        </div>
        <h3 className="text-headline-sm leading-snug text-navy group-hover:text-primary">{workshop.name}</h3>
        <p className="line-clamp-2 text-sm text-ink-2">{workshop.description || workshop.address}</p>
        <div className="flex flex-wrap gap-1.5">
          {workshop.vehicle_types.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-surface-low px-2 py-1 font-label text-[11px] font-semibold text-ink-2">
              <Icon name={vehicleIcon(v)} className="text-[14px]" /> {vehicleLabel(v)}
            </span>
          ))}
          {workshop.accepts_emergency && <span className="rounded-md bg-surface-low px-2 py-1 font-label text-[11px] font-semibold text-ink-2">Siaga SOS</span>}
          {workshop.has_qris && <span className="rounded-md bg-surface-low px-2 py-1 font-label text-[11px] font-semibold text-ink-2">QRIS Ready</span>}
        </div>
        <div
          className={cx(
            'flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-label text-xs font-semibold',
            workshop.is_open ? 'bg-success-soft text-success' : 'bg-surface-low text-ink-3',
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon name="event_available" className="text-[16px]" />
            {workshop.is_open ? `Buka ${workshop.open_time}–${workshop.close_time}` : 'Sedang tutup'}
          </span>
          <span className="text-[11px] text-ink-3">{workshop.max_slot_per_hour} booking/jam</span>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <span className="font-label text-xs text-ink-3">Jadwal per jam, tidak bentrok</span>
          <span className="inline-flex h-10 shrink-0 items-center rounded-lg bg-primary px-5 font-label text-sm font-semibold text-white transition group-hover:bg-primary-dark">
            Pilih Jadwal
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ServicePicker({ services, value, onChange }: { services: Service[]; value: string; onChange: (id: string) => void }) {
  if (services.length === 0) return <EmptyState icon="build">Bengkel belum menambahkan layanan.</EmptyState>;
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Pilih layanan">
      {services.map((s) => {
        const selected = value === s.id;
        return (
          <button
            type="button"
            key={s.id}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s.id)}
            className={cx(
              'flex flex-col gap-2 rounded-xl border p-4 text-left transition',
              selected ? 'border-primary bg-sky ring-2 ring-primary' : 'border-line bg-white hover:border-primary/50 hover:shadow-sm',
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-lg', selected ? 'bg-primary text-white' : 'bg-sky text-primary')}>
                <Icon name={vehicleIcon(s.vehicle_type)} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy">{s.name}</p>
                <p className="font-label text-xs text-ink-3">
                  {vehicleLabel(s.vehicle_type)} · ±{s.duration_minutes} menit
                </p>
              </div>
              <span className={cx('mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px]', selected ? 'border-primary bg-primary' : 'border-line-strong')}>
                {selected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
            </div>
            {s.description && <p className="text-sm text-ink-2">{s.description}</p>}
            <p className="text-lg font-extrabold text-navy">{rupiah(s.price)}</p>
          </button>
        );
      })}
    </div>
  );
}

/** Next N days as tappable cards (dates in Asia/Jakarta). */
export function DateStrip({ value, onChange, days = 7 }: { value: string; onChange: (d: string) => void; days?: number }) {
  const dates = Array.from({ length: days }, (_, i) => jakartaDate(i));
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Pilih tanggal">
      {dates.map((d, i) => {
        const dt = new Date(`${d}T00:00:00Z`);
        const selected = value === d;
        return (
          <button
            type="button"
            key={d}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(d)}
            className={cx(
              'relative flex w-[88px] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition',
              selected ? 'border-2 border-primary bg-sky' : 'border-line bg-white hover:border-primary/50',
            )}
          >
            {selected && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />}
            <span className={cx('font-label text-[11px] font-bold tracking-[0.04em] uppercase', selected ? 'text-primary' : 'text-ink-3')}>
              {i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : weekdayFmt.format(dt)}
            </span>
            <span className="text-2xl font-extrabold text-navy">{dt.getUTCDate()}</span>
            <span className="font-label text-xs text-ink-2">
              {monthFmt.format(dt)} ({dayShortFmt.format(dt)})
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Hourly slots grouped into morning / afternoon sessions. Full slots stay selectable (waiting list). */
export function SlotPicker({ slots, value, onChange, durationMinutes }: { slots: SlotAvailability[]; value: string; onChange: (slot: string) => void; durationMinutes?: number }) {
  if (slots.length === 0) return <EmptyState icon="event_busy">Tidak ada slot pada tanggal ini. Bengkel mungkin tutup.</EmptyState>;
  const sessions = [
    { key: 'pagi', title: 'Sesi Pagi', icon: 'wb_sunny', items: slots.filter((s) => Number(s.time_slot.slice(0, 2)) < 12) },
    { key: 'siang', title: 'Sesi Siang & Sore', icon: 'wb_twilight', items: slots.filter((s) => Number(s.time_slot.slice(0, 2)) >= 12) },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-5" role="radiogroup" aria-label="Pilih jam">
      {sessions.map((sess) => (
        <div key={sess.key}>
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-navy">
            <Icon name={sess.icon} className="text-warning" />
            {sess.title} ({sess.items[0].time_slot} – {slotRange(sess.items[sess.items.length - 1].time_slot).split(' – ')[1]} WIB)
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sess.items.map((s) => {
              const full = s.remaining === 0;
              const selected = value === s.time_slot;
              return (
                <div key={s.time_slot} className="relative">
                  {selected && (
                    <span className="absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-label text-[10px] font-bold whitespace-nowrap text-white">
                      <Icon name="check_circle" className="text-[12px]" /> Jam Terpilih
                    </span>
                  )}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!s.bookable}
                    onClick={() => onChange(s.time_slot)}
                    data-testid={`slot-${s.time_slot}`}
                    className={cx(
                      'flex w-full flex-col gap-1.5 rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:bg-surface-low disabled:opacity-60',
                      selected ? 'border-2 border-primary bg-sky shadow-sm' : 'border-line bg-white hover:border-primary/50',
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-base font-bold text-navy">{slotRange(s.time_slot)}</span>
                      <span
                        className={cx(
                          'shrink-0 rounded-md px-1.5 py-0.5 font-label text-[10px] font-bold',
                          !s.bookable ? 'bg-surface text-ink-3' : full ? 'bg-emergency-soft text-emergency-ink' : s.remaining <= 1 ? 'bg-warning-soft text-warning-ink' : 'bg-success-soft text-success',
                        )}
                      >
                        {!s.bookable ? 'Tutup' : full ? 'Penuh' : s.remaining <= 1 ? `Sisa ${s.remaining} tempat` : `${s.remaining} tempat`}
                      </span>
                    </span>
                    <span className="font-label text-[11px] text-ink-3">
                      WIB{durationMinutes ? ` · selesai ±${addMinutes(s.time_slot, durationMinutes)}` : ''}
                    </span>
                    {full && s.bookable && (
                      <span className="mt-1 border-t border-line pt-1.5 font-label text-[11px] font-bold text-emergency-ink">
                        + Waiting List{s.waitlisted > 0 ? ` (${s.waitlisted} antre)` : ''}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MechanicList({ mechanics }: { mechanics: Mechanic[] }) {
  if (mechanics.length === 0) return <p className="text-sm text-ink-3">Belum ada mekanik terdaftar.</p>;
  return (
    <div className="grid gap-3">
      {mechanics.map((m) => (
        <div key={m.id} className="flex items-start gap-3 rounded-lg bg-surface-low p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-navy font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="font-semibold text-navy">{m.name}</p>
            <Stars value={m.avg_rating} count={m.total_reviews} />
            {m.specializations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.specializations.map((s) => (
                  <span key={s} className="rounded-md bg-white px-1.5 py-0.5 font-label text-[11px] font-semibold text-ink-2">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return <EmptyState icon="reviews">Belum ada ulasan untuk bengkel ini.</EmptyState>;
  return (
    <ul className="divide-y divide-line">
      {reviews.map((r) => (
        <li key={r.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sky font-semibold text-primary">{r.customer_name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-navy">{r.customer_name}</span>
              <StarRow rating={r.rating} />
              <span className="ml-auto font-label text-xs text-ink-3">{dateTime(r.created_at)}</span>
            </div>
            {r.mechanic_name && <p className="font-label text-xs text-ink-3">Mekanik: {r.mechanic_name}</p>}
            {r.comment && <p className="mt-1 text-sm text-ink-2">{r.comment}</p>}
            {r.owner_reply && (
              <div className="mt-2 rounded-lg border-l-2 border-primary bg-sky/60 px-3 py-2 text-sm" data-testid="review-reply">
                <p className="font-label text-[11px] font-bold text-primary">Balasan bengkel</p>
                <p className="text-navy">{r.owner_reply}</p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cx('flex text-warning', className)} role="img" aria-label={`${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Icon key={i} name="star" filled={i < rating} className={cx('text-[16px]', i >= rating && 'text-line-strong')} />
      ))}
    </span>
  );
}
