import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { geocodeApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Place } from '@/services/api/types';
import { Icon, Spinner, cx } from '@/components/ui';
import type { LatLng } from './Maps';

/**
 * Location search box ("Margonda Depok", "Stasiun Bogor"): searches when the user presses Enter or the search
 * button (the free OpenStreetMap service forbids type-ahead), then offers up to 6 places. Safe inside other
 * forms: Enter here never submits the surrounding form.
 */
export function PlaceSearch({
  onPick,
  near,
  placeholder = 'Ketik daerah, jalan, atau patokan',
  className,
  inputClassName,
  id,
}: {
  onPick: (p: LatLng & { label: string }) => void;
  /** Biases results toward this point (e.g. the current map pin). */
  near?: LatLng | null;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
}) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bias = near ? { lat: Math.round(near.lat * 10) / 10, lng: Math.round(near.lng * 10) / 10 } : undefined;

  const result = useQuery({
    queryKey: ['geocode', query, bias?.lat, bias?.lng],
    queryFn: () => geocodeApi.search(query, bias),
    enabled: query.length >= 3,
    staleTime: 15 * 60_000,
    retry: false,
  });
  const places = result.data ?? [];

  const search = () => {
    const q = text.trim();
    if (q.length < 3) return;
    setQuery(q);
    setActive(0);
    setOpen(true);
  };
  const pick = (p: Place) => {
    setText(p.name);
    setOpen(false);
    onPick({ lat: p.lat, lng: p.lng, label: p.detail ? `${p.name}, ${p.detail}` : p.name });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // never submit the surrounding form
      if (open && places[active]) pick(places[active]);
      else search();
    } else if (e.key === 'ArrowDown' && open && places.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % places.length);
    } else if (e.key === 'ArrowUp' && open && places.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + places.length) % places.length);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const tooShort = text.trim().length > 0 && text.trim().length < 3;

  return (
    <div className={cx('relative', className)}>
      <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-white pr-1 pl-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
        <Icon name="travel_explore" className="text-primary" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && places[active] ? `${listId}-${active}` : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(false);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          aria-label="Cari lokasi"
          className={cx('h-11 min-w-0 flex-1 bg-transparent text-sm text-navy placeholder:text-ink-3 focus:outline-none', inputClassName)}
          data-testid="place-search-input"
        />
        <button
          type="button"
          onClick={search}
          disabled={text.trim().length < 3}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-3 font-label text-xs font-semibold text-white hover:bg-primary-dark disabled:opacity-45"
          data-testid="place-search-button"
        >
          {result.isFetching ? <Spinner small /> : <Icon name="search" className="text-[18px]" />} Cari
        </button>
      </div>
      {tooShort && <p className="mt-1 text-xs text-ink-3">Ketik minimal 3 huruf, lalu tekan Enter atau Cari.</p>}

      {open && query && (
        <div className="absolute inset-x-0 top-full z-[1000] mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-float">
          {result.isFetching ? (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-ink-2">
              <Spinner small /> Mencari “{query}”…
            </p>
          ) : result.error ? (
            <p className="px-4 py-3 text-sm text-emergency-ink" role="alert">
              {errorMessage(result.error)}
            </p>
          ) : places.length ? (
            <ul id={listId} role="listbox" aria-label="Hasil pencarian lokasi" className="max-h-72 overflow-y-auto py-1" data-testid="place-search-results">
              {places.map((p, i) => (
                <li
                  key={`${p.lat},${p.lng},${p.name}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the input until the click lands
                  onClick={() => pick(p)}
                  className={cx('flex cursor-pointer items-start gap-2.5 px-4 py-2.5', i === active ? 'bg-sky' : 'hover:bg-surface-low')}
                >
                  <Icon name="location_on" className="mt-0.5 text-primary" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy">{p.name}</span>
                    {p.detail && <span className="block truncate text-xs text-ink-3">{p.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-2">Lokasi “{query}” tidak ditemukan. Coba nama jalan, kelurahan, atau kota, atau tandai langsung di peta.</p>
          )}
          <p className="border-t border-line bg-surface-low px-4 py-1.5 text-[11px] text-ink-3">Data peta © OpenStreetMap contributors</p>
        </div>
      )}
    </div>
  );
}
