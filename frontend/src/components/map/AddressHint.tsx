import { useQuery } from '@tanstack/react-query';
import { geocodeApi } from '@/services/api/endpoints';
import type { Place } from '@/services/api/types';
import { Icon, Spinner, cx } from '@/components/ui';
import type { LatLng } from './Maps';

export const placeText = (p: Place) => (p.detail ? `${p.name}, ${p.detail}` : p.name);

/** Approximate address of a map point (OpenStreetMap via the API). Points ~10 m apart share one lookup. */
export function useReverseAddress(point: LatLng | null | undefined) {
  const lat = point ? Math.round(point.lat * 1e4) / 1e4 : null;
  const lng = point ? Math.round(point.lng * 1e4) / 1e4 : null;
  return useQuery({
    queryKey: ['geocode-reverse', lat, lng],
    queryFn: () => geocodeApi.reverse({ lat: lat!, lng: lng! }),
    enabled: lat !== null && lng !== null,
    staleTime: 15 * 60_000,
    retry: false,
  });
}

/**
 * "Perkiraan alamat: …" under a map picker, so people can check the pin landed on the right street.
 * With `onUse`, offers a button that copies the address into a form field (workshop address, SOS landmark).
 */
export function AddressHint({
  point,
  onUse,
  useLabel = 'Pakai alamat ini',
  className,
}: {
  point: LatLng | null | undefined;
  onUse?: (address: string) => void;
  useLabel?: string;
  className?: string;
}) {
  const q = useReverseAddress(point);
  if (!point) return null;
  const address = q.data ? placeText(q.data) : null;

  return (
    <div className={cx('flex flex-wrap items-start gap-x-2 gap-y-1 font-label text-xs text-ink-2', className)} aria-live="polite" data-testid="address-hint">
      <Icon name="home_pin" className="text-[16px] text-primary" />
      {q.isFetching ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner small /> Mencari alamat titik ini…
        </span>
      ) : q.error ? (
        <span>Alamat titik ini belum bisa dimuat. Titik di peta tetap terkirim.</span>
      ) : address ? (
        <>
          <span className="min-w-0 flex-1">
            Perkiraan alamat: <b className="text-navy">{address}</b>
          </span>
          {onUse && (
            <button type="button" onClick={() => onUse(address)} className="font-semibold text-primary hover:underline" data-testid="address-hint-use">
              {useLabel}
            </button>
          )}
        </>
      ) : (
        <span>Alamat titik ini tidak ditemukan. Pastikan titik berada di daratan.</span>
      )}
    </div>
  );
}
