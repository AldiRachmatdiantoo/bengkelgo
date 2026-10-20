import { useCallback, useState } from 'react';
import type { LatLng } from '@/components/map/Maps';

/** Browser GPS with explicit user trigger (permission prompt only when the user asks). */
export function useGeolocation() {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError('Browser tidak mendukung GPS. Pilih lokasi di peta.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      (e) => {
        setError(e.code === e.PERMISSION_DENIED ? 'Izin lokasi ditolak. Pilih lokasi di peta.' : 'Lokasi tidak ditemukan. Pilih lokasi di peta.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return { position, setPosition, error, locating, locate };
}
