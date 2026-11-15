// Shown on the landing page: first "Kendaraan Anda mogok sekarang?" (a shortcut into the SOS flow with the vehicle
// type chosen), then, once that is closed, a one-time cookie notice. BengkelGo only sets the login cookie, which
// the site cannot work without, so the notice informs instead of offering a refusal that would do nothing.
// Last, a one-time pointer to the floating SOS button (bottom right) saying what it is for.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { VehicleType } from '@/services/api/types';
import { useAuth } from '@/services/auth/AuthProvider';
import { Icon, Modal } from '@/components/ui';

const SOS_ASKED_KEY = 'bengkelgo:sos-asked';
const COOKIE_KEY = 'bengkelgo:cookie-notice';
const SOS_TIP_KEY = 'bengkelgo:sos-tip';
/** The SOS question comes back after this long, so a returning visitor who breaks down later sees it again. */
const ASK_AGAIN_MS = 12 * 60 * 60 * 1000;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: the prompt shows again next visit, nothing breaks
  }
}

export function WelcomePrompts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const customer = !user || user.role === 'CUSTOMER' || user.role === 'GUEST';
  const [askSos, setAskSos] = useState(() => customer && Date.now() - Number(read(SOS_ASKED_KEY) ?? 0) > ASK_AGAIN_MS);
  const [cookie, setCookie] = useState(() => read(COOKIE_KEY) !== '1');
  const [sosTip, setSosTip] = useState(() => customer && read(SOS_TIP_KEY) !== '1');
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (askSos) firstButton.current?.focus();
  }, [askSos]);

  const closeSos = () => {
    write(SOS_ASKED_KEY, String(Date.now()));
    setAskSos(false);
  };
  const goSos = (vehicle: VehicleType) => {
    write(SOS_ASKED_KEY, String(Date.now()));
    navigate('/emergency', { state: { vehicle } });
  };
  const closeCookie = () => {
    write(COOKIE_KEY, '1');
    setCookie(false);
  };
  const closeTip = () => {
    write(SOS_TIP_KEY, '1');
    setSosTip(false);
  };

  return (
    <>
      <Modal
        open={askSos}
        onClose={closeSos}
        icon="e911_emergency"
        tone="danger"
        title="Kendaraan Anda mogok sekarang?"
        actions={
          <div className="w-full" data-testid="sos-prompt">
            <div className="grid grid-cols-2 gap-2.5">
              {(
                [
                  ['MOTOR', 'Motor mogok', 'two_wheeler'],
                  ['MOBIL', 'Mobil mogok', 'directions_car'],
                ] as const
              ).map(([vehicle, label, icon], i) => (
                <button
                  key={vehicle}
                  ref={i === 0 ? firstButton : undefined}
                  type="button"
                  onClick={() => goSos(vehicle)}
                  data-testid={`sos-prompt-${vehicle.toLowerCase()}`}
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-emergency px-3 py-4 text-base font-bold text-white transition hover:bg-emergency-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emergency-ink"
                >
                  <Icon name={icon} className="text-[32px]" />
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={closeSos}
              data-testid="sos-prompt-close"
              className="mt-2.5 h-12 w-full rounded-xl border border-line bg-surface-low text-sm font-bold text-ink transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Tidak, saya mau lihat-lihat dulu
            </button>
          </div>
        }
      >
        Pilih kendaraannya. Anda langsung masuk ke bantuan darurat, dan bengkel siaga terdekat dihubungi lebih dulu.
      </Modal>

      {!askSos && cookie && (
        <div
          role="region"
          aria-label="Pemberitahuan cookie"
          data-testid="cookie-notice"
          className="fixed right-[4.5rem] bottom-3 left-3 z-[960] rounded-xl border border-line bg-card p-4 shadow-float sm:right-auto sm:bottom-6 sm:left-6 sm:max-w-md"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon name="cookie" className="text-primary" /> Cookie di BengkelGo
          </p>
          <p className="mt-1.5 text-sm text-ink-2">
            Kami hanya memakai cookie yang dibutuhkan agar Anda tetap masuk. Tidak ada cookie iklan atau pelacak.{' '}
            <Link to="/privasi" className="font-semibold text-primary underline-offset-2 hover:underline">
              Kebijakan privasi
            </Link>
          </p>
          <button
            type="button"
            onClick={closeCookie}
            data-testid="cookie-accept"
            className="mt-3 h-11 w-full rounded-lg bg-primary px-5 text-sm font-bold text-on-primary transition hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
          >
            Mengerti
          </button>
        </div>
      )}
      {!askSos && !cookie && sosTip && (
        // Sits right above the floating SOS button (48 px at right-3 on phones, 64 px at right-6 from sm), arrow
        // pointing down at its centre.
        <div
          role="note"
          aria-label="Tentang tombol SOS"
          data-testid="sos-tip"
          className="fixed right-3 bottom-[4.5rem] z-[960] w-[min(18rem,calc(100vw-1.5rem))] rounded-xl bg-emergency p-4 text-white shadow-float sm:right-6 sm:bottom-[6.25rem]"
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            <Icon name="e911_emergency" filled className="text-[20px]" /> Ini tombol darurat
          </p>
          <p className="mt-1.5 text-sm leading-snug text-white">Kendaraan mogok di jalan? Tekan tombol SOS di bawah ini untuk minta bantuan bengkel siaga terdekat.</p>
          <button
            type="button"
            onClick={closeTip}
            data-testid="sos-tip-close"
            className="mt-3 h-11 w-full rounded-lg bg-white px-4 text-sm font-bold text-emergency-dark transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Oke, mengerti
          </button>
          <span aria-hidden className="absolute -bottom-2 right-4 h-4 w-4 rotate-45 bg-emergency sm:right-6" />
        </div>
      )}
    </>
  );
}
