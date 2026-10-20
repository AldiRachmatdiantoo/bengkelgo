import { useCallback, useState, type ReactNode } from 'react';
import type { LatLng } from '@/components/map/Maps';
import { Button, Icon, Modal } from '@/components/ui';

type Dialog = 'explain' | 'denied' | 'inapp' | null;
type Platform = 'ios' | 'android' | 'desktop';

const EXPLAINED_KEY = 'bengkelgo:geo-explained';

/** Browsers inside chat/social apps often block or never show the location prompt. */
export function isInAppBrowser(ua: string) {
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|musical_ly|Snapchat|Twitter|; wv\)/i.test(ua);
}

export function platformOf(ua: string, touchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Steps to re-allow location once the browser remembers a "Block" (it never asks again by itself). */
export const UNBLOCK_STEPS: Record<Platform, string[]> = {
  ios: [
    'Di Safari, ketuk ikon "aA" (atau ikon di kiri kolom alamat) → Pengaturan Situs Web → Lokasi → Izinkan.',
    'Masih gagal? Buka Pengaturan iPhone → Privasi & Keamanan → Layanan Lokasi: nyalakan, lalu Situs Web Safari → "Saat Digunakan".',
    'Kembali ke sini dan ketuk "Coba lagi".',
  ],
  android: [
    'Pastikan Lokasi HP menyala (tarik panel notifikasi → ikon Lokasi).',
    'Di Chrome, ketuk ikon pengaturan/gembok di kiri kolom alamat → Izin → Lokasi → Izinkan.',
    'Kembali ke sini dan ketuk "Coba lagi".',
  ],
  desktop: ['Klik ikon gembok/pengaturan di kiri kolom alamat → Lokasi → Izinkan.', 'Klik "Coba lagi" (atau muat ulang halaman bila diminta).'],
};

function wasExplained() {
  try {
    return localStorage.getItem(EXPLAINED_KEY) === '1';
  } catch {
    return false;
  }
}
function markExplained() {
  try {
    localStorage.setItem(EXPLAINED_KEY, '1');
  } catch {
    // storage blocked: the explanation simply shows again next time
  }
}

async function permissionState(): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'unknown'; // older Safari / in-app browsers
  }
}

/**
 * Browser GPS with explicit user trigger. Before the browser's own prompt it explains why (once per browser), so
 * fewer people tap "Block" by accident; once blocked it shows device-specific steps to re-allow, since a website
 * can never re-open that prompt itself. Weak GPS indoors falls back to a faster, less precise reading.
 * Render `geo.dialog` once in the page.
 */
export function useGeolocation() {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const request = useCallback(() => {
    setDialog(null);
    setLocating(true);
    setError(null);
    const ok = (p: GeolocationPosition) => {
      setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
      setLocating(false);
    };
    const fail = (e: GeolocationPositionError) => {
      setLocating(false);
      if (e.code === e.PERMISSION_DENIED) {
        setError('Izin lokasi ditolak. Izinkan lokasi atau pilih lokasi di peta.');
        setDialog('denied');
      } else {
        setError('Lokasi tidak ditemukan. Coba lagi di tempat terbuka, atau pilih lokasi di peta.');
      }
    };
    navigator.geolocation.getCurrentPosition(ok, (e) => {
      // Precise GPS often times out indoors: retry once with network/Wi-Fi accuracy or a recent reading.
      if (e.code === e.PERMISSION_DENIED) return fail(e);
      navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 });
    }, { enableHighAccuracy: true, timeout: 10_000 });
  }, []);

  const locate = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setError('Browser tidak mendukung GPS. Pilih lokasi di peta.');
      return;
    }
    if (isInAppBrowser(navigator.userAgent)) return setDialog('inapp');
    const state = await permissionState();
    if (state === 'granted') return request();
    if (state === 'denied') {
      setError('Izin lokasi ditolak. Izinkan lokasi atau pilih lokasi di peta.');
      return setDialog('denied');
    }
    if (!wasExplained()) return setDialog('explain');
    request();
  }, [request]);

  const close = () => setDialog(null);
  const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints);

  let modal: ReactNode = null;
  if (dialog === 'explain') {
    modal = (
      <Modal
        open
        onClose={close}
        icon="my_location"
        title="Izinkan BengkelGo memakai lokasi Anda"
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={close}>
              Pilih di peta saja
            </Button>
            <Button
              icon="arrow_forward"
              onClick={() => {
                markExplained();
                request();
              }}
              data-testid="geo-explain-continue"
            >
              Lanjut
            </Button>
          </>
        }
      >
        <p className="mt-2">Lokasi dipakai untuk mencari bengkel terdekat dan mengirim mekanik ke titik Anda. Lokasi hanya diambil saat Anda menekan tombol GPS.</p>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-sky p-3 text-sm text-navy">
          <Icon name="info" className="mt-px text-primary" />
          <span>
            Setelah ini browser akan bertanya. Pilih <b>Izinkan</b> (atau <b>Allow</b>).
          </span>
        </p>
      </Modal>
    );
  } else if (dialog === 'denied') {
    modal = (
      <Modal
        open
        onClose={close}
        icon="location_off"
        tone="warning"
        title="Izin lokasi sedang diblokir"
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={close}>
              Pilih di peta saja
            </Button>
            <Button icon="refresh" onClick={request} data-testid="geo-retry">
              Coba lagi
            </Button>
          </>
        }
      >
        <p className="mt-2">Browser mengingat penolakan sebelumnya, jadi tidak akan bertanya lagi. Buka izinnya dulu:</p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm" data-testid="geo-steps">
          {UNBLOCK_STEPS[platform].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Modal>
    );
  } else if (dialog === 'inapp') {
    modal = <InAppDialog onClose={close} onTryAnyway={request} />;
  }

  return { position, setPosition, error, locating, locate, dialog: modal };
}

function InAppDialog({ onClose, onTryAnyway }: { onClose: () => void; onTryAnyway: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt('Salin link ini lalu buka di Chrome/Safari:', window.location.href);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      icon="open_in_browser"
      tone="warning"
      title="Buka di Chrome atau Safari"
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onTryAnyway}>
            Tetap coba di sini
          </Button>
          <Button icon={copied ? 'check' : 'content_copy'} onClick={copy} data-testid="geo-copy-link">
            {copied ? 'Link disalin' : 'Salin link'}
          </Button>
        </>
      }
    >
      <p className="mt-2">
        Anda membuka BengkelGo dari dalam aplikasi (mis. WhatsApp atau Instagram). Browser bawaan aplikasi sering memblokir lokasi.
      </p>
      <p className="mt-3 text-sm">
        Ketuk menu <b>⋮</b> atau <b>…</b> lalu <b>Buka di browser</b>, atau salin link dan tempel di Chrome/Safari. Anda juga bisa menutup ini dan memilih lokasi di peta.
      </p>
    </Modal>
  );
}
