import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Mechanic, Review, Service, SlotAvailability, VehicleType, Workshop } from '@/services/api/types';
import { EmptyState, Icon, Stars, cx } from '@/components/ui';
import { dateTime, distance, jakartaDate, rupiah } from '@/utils/format';
import { apiAsset } from '@/services/api/endpoints';
import { ChoiceChip, OptionCard, WorkshopArt } from '@/components/ui/screen';

export const vehicleLabel = (v: VehicleType) => (v === 'MOTOR' ? 'Motor' : 'Mobil');
export const vehicleIcon = (v: VehicleType) => (v === 'MOTOR' ? 'two_wheeler' : 'directions_car');

/** "09:00" -> "09:00 – 10:00" (slots are hourly). */
export const slotRange = (slot: string) => {
  const h = Number(slot.slice(0, 2));
  return `${slot}-${String((h + 1) % 24).padStart(2, '0')}:${slot.slice(3, 5)}`;
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
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dmyFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "15 November 2026" */
export const dayMonthYear = (isoDate: string) => dmyFmt.format(new Date(`${isoDate}T00:00:00Z`));
const dmFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
/** "24 Mei" */
export const shortDate = (isoDate: string) => dmFmt.format(new Date(`${isoDate}T00:00:00Z`));
/** "Mei 2026" */
export const monthYear = (isoDate: string) => monthFmt.format(new Date(`${isoDate}T00:00:00Z`));

/** "Besok, Senin Wage" */
export function friendlyDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const rel = isoDate === jakartaDate(0) ? 'Hari ini' : isoDate === jakartaDate(1) ? 'Besok' : null;
  const day = `${weekdayFmt.format(d)} ${pasaran(isoDate)}`;
  return rel ? `${rel}, ${day}` : day;
}

/** Last meaningful part of an address ("Gambir, Jakarta Pusat"). */
export const regionOf = (address: string) => address.split(',').map((p) => p.trim()).filter(Boolean).slice(-2).join(', ');

/**
 * Workshop card (Figma "Pilih bengkel"): cover photo or the line art, name with the rating on the right, address,
 * and the distance (or opening hours) in the accent. Two sit side by side on phones, so the text stays short there.
 */
export function WorkshopCard({ workshop, featured, date }: { workshop: Workshop; featured?: boolean; date?: string }) {
  const to = `/workshops/${workshop.id}${date ? `?date=${date}` : ''}`;
  const rating = workshop.avg_rating > 0 ? workshop.avg_rating.toFixed(1).replace('.', ',') : 'Baru';
  return (
    <Link
      to={to}
      data-testid="workshop-card"
      className={cx(
        'group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        featured ? 'border-primary/60' : 'border-line',
      )}
    >
      <div className="relative h-[84px] overflow-hidden bg-art sm:h-[120px]">
        {workshop.cover_photo_url ? (
          <img
            src={apiAsset(`${workshop.cover_photo_url}?size=sm`)!}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            data-testid="workshop-card-photo"
          />
        ) : (
          <WorkshopArt className="absolute inset-0 h-full w-full" />
        )}
        {featured && (
          <span className="absolute top-2 left-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-on-primary">Rekomendasi</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
          <h3 className="line-clamp-2 min-w-0 text-sm leading-snug font-bold text-ink sm:text-lg">{workshop.name}</h3>
          <span className="inline-flex shrink-0 items-center gap-0.5 self-start text-sm font-bold text-primary sm:text-subtitle" aria-label={workshop.avg_rating > 0 ? `Rating ${rating} dari 5` : 'Belum ada rating'}>
            <Icon name="star" filled className="text-[14px] text-star sm:text-[16px]" />
            {rating}
          </span>
        </div>
        <p className="line-clamp-1 text-xs text-ink-2 sm:line-clamp-2 sm:text-sm">{workshop.address}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5">
          {workshop.distance_meters != null ? (
            <span className="text-xs font-bold text-primary">
              {distance(workshop.distance_meters)}
              <span className="max-sm:hidden"> dari lokasi Anda</span>
            </span>
          ) : (
            <span className={cx('text-xs font-bold', workshop.is_open ? 'text-primary' : 'text-ink-3')}>
              {workshop.is_open ? `Buka ${workshop.open_time}-${workshop.close_time}` : 'Sedang tutup'}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-ink-2">
            {workshop.vehicle_types.map((v) => (
              <span key={v} title={vehicleLabel(v)} className="inline-flex">
                <Icon name={vehicleIcon(v)} className="text-[16px]" />
                <span className="sr-only">{vehicleLabel(v)}</span>
              </span>
            ))}
            {workshop.accepts_emergency && <span className="text-[11px] font-bold">SOS</span>}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ServicePicker({ services, value, onChange }: { services: Service[]; value: string; onChange: (id: string) => void }) {
  if (services.length === 0) return <EmptyState icon="build">Bengkel belum menambahkan layanan.</EmptyState>;
  // The vehicle type only needs saying when the workshop serves both.
  const mixed = new Set(services.map((s) => s.vehicle_type)).size > 1;
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Pilih layanan">
      {services.map((s) => (
        <OptionCard
          key={s.id}
          checked={value === s.id}
          onSelect={() => onChange(s.id)}
          title={s.name}
          description={[mixed && vehicleLabel(s.vehicle_type), `±${s.duration_minutes} menit`, s.description].filter(Boolean).join(' · ')}
          aside={rupiah(s.price)}
        />
      ))}
    </div>
  );
}

const fullDateFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "22 Jum" chip label for a YYYY-MM-DD date. */
export const chipDate = (isoDate: string) => {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  return `${dt.getUTCDate()} ${dayShortFmt.format(dt).replace('.', '')}`;
};

/** Next N days as 44px chips, four to a row on phones (dates in Asia/Jakarta). `extra` adds one more cell (a calendar picker). */
export function DateStrip({ value, onChange, days = 7, extra }: { value: string; onChange: (d: string) => void; days?: number; extra?: ReactNode }) {
  const dates = Array.from({ length: days }, (_, i) => jakartaDate(i));
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Pilih tanggal">
      {dates.map((d, i) => (
        <ChoiceChip
          key={d}
          checked={value === d}
          onSelect={() => onChange(d)}
          aria-label={`${i === 0 ? 'Hari ini, ' : i === 1 ? 'Besok, ' : ''}${fullDateFmt.format(new Date(`${d}T00:00:00Z`))}`}
        >
          {chipDate(d)}
        </ChoiceChip>
      ))}
      {extra}
    </div>
  );
}

/** "09:00" -> "09.00", the way the design writes times. */
export const dotTime = (slot: string) => slot.slice(0, 5).replace(':', '.');

/** Hourly slots as 44px chips, three to a row on phones. Full slots stay selectable (they join the waiting list). */
export function SlotPicker({ slots, value, onChange, durationMinutes }: { slots: SlotAvailability[]; value: string; onChange: (slot: string) => void; durationMinutes?: number }) {
  if (slots.length === 0) return <EmptyState icon="event_busy">Tidak ada slot pada tanggal ini. Bengkel mungkin tutup.</EmptyState>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Pilih jam">
      {slots.map((s) => {
        const full = s.remaining === 0;
        const note = !s.bookable ? 'Tutup' : full ? `Penuh, antre${s.waitlisted > 0 ? ` ${s.waitlisted}` : ''}` : `Sisa ${s.remaining}`;
        return (
          <ChoiceChip
            key={s.time_slot}
            checked={value === s.time_slot}
            onSelect={() => onChange(s.time_slot)}
            disabled={!s.bookable}
            muted={full && s.bookable}
            data-testid={`slot-${s.time_slot}`}
            aria-label={`${s.time_slot} WIB, ${!s.bookable ? 'tutup' : full ? 'penuh, masuk daftar tunggu' : `sisa ${s.remaining} tempat`}${durationMinutes ? `, selesai sekitar ${addMinutes(s.time_slot, durationMinutes)}` : ''}`}
            className="min-h-13"
          >
            <span>{dotTime(s.time_slot)}</span>
            <span className={cx('text-[11px] font-semibold', value === s.time_slot ? 'text-on-primary/80' : full ? '' : 'text-ink-2')}>{note}</span>
          </ChoiceChip>
        );
      })}
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
            <p className="font-semibold text-ink">{m.name}</p>
            <Stars value={m.avg_rating} count={m.total_reviews} />
            {m.specializations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.specializations.map((s) => (
                  <span key={s} className="rounded-md bg-card px-1.5 py-0.5 font-label text-[11px] font-semibold text-ink-2">
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
              <span className="font-semibold text-ink">{r.customer_name}</span>
              <StarRow rating={r.rating} />
              <span className="ml-auto font-label text-xs text-ink-3">{dateTime(r.created_at)}</span>
            </div>
            {r.mechanic_name && <p className="font-label text-xs text-ink-3">Mekanik: {r.mechanic_name}</p>}
            {r.comment && <p className="mt-1 text-sm text-ink-2">{r.comment}</p>}
            {r.owner_reply && (
              <div className="mt-2 rounded-lg border-l-2 border-primary bg-sky/60 px-3 py-2 text-sm" data-testid="review-reply">
                <p className="font-label text-[11px] font-bold text-primary">Balasan bengkel</p>
                <p className="text-ink">{r.owner_reply}</p>
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
