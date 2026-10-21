import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { AuthPayload, Role, VehicleType } from '@/services/api/types';
import { canReturnTo, homeFor, useAuth } from '@/services/auth/AuthProvider';
import { checkCallback, googleEnabled, startGoogleLogin, takePendingGoogleLogin } from '@/services/auth/googleOAuth';
import { MapPicker, type LatLng } from '@/components/map/Maps';
import { PlaceSearch } from '@/components/map/PlaceSearch';
import { AddressHint } from '@/components/map/AddressHint';
import { Alert, Button, Card, Icon, Input, Loading, MissingFields, Segmented, TextArea } from '@/components/ui';
import { fieldIssue, isEmail, isIdPhone, isStrongPassword } from '@/utils/formChecks';

/** After auth, go back to where the user came from (e.g. the workshop they were booking), else role home. */
function useAfterAuth() {
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const target = (role: Role) => (from && canReturnTo(role, from) ? from : homeFor(role));
  return { target, done: (s: AuthPayload) => navigate(target(s.user.role), { replace: true }) };
}

const PERKS = [
  { icon: 'event_available', text: 'Booking slot servis per jam, tanpa antre panjang' },
  { icon: 'e911_emergency', text: 'Bantuan darurat dari bengkel dalam radius 5 km' },
  { icon: 'qr_code_2', text: 'Bayar mudah via QRIS bengkel' },
  { icon: 'verified', text: 'Bengkel mitra diverifikasi admin' },
];

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-xl border border-line bg-card shadow-lift lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-navy p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <Icon name="car_repair" filled /> BengkelGo
          </span>
          <p className="mt-6 text-3xl leading-tight font-bold">Servis & bantuan darurat kendaraan, dalam satu genggaman.</p>
        </div>
        <ul className="relative mt-10 space-y-4">
          {PERKS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-sm text-white/90">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15">
                <Icon name={p.icon} />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="p-6 sm:p-10">
        <h1 className="text-[20px] font-bold tracking-[-0.015em]">{title}</h1>
        <p className="mt-1 mb-6 text-subtitle text-ink-2">{subtitle}</p>
        {children}
        <div className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-2">{footer}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user } = useAuth();
  const location = useLocation();
  const { done, target } = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useMutation({ mutationFn: () => authApi.login({ email, password }), onSuccess: done });

  if (user) return <Navigate to={target(user.role)} replace />;
  return (
    <AuthShell
      title="Masuk ke BengkelGo"
      subtitle="Pelanggan, pemilik bengkel, dan admin masuk di sini."
      footer={
        <>
          Belum punya akun?{' '}
          <Link to="/register" state={location.state} className="font-semibold text-primary hover:underline">
            Daftar
          </Link>
          <span className="mx-2 text-line-strong">|</span>
          Pemilik bengkel?{' '}
          <Link to="/register/workshop" className="font-semibold text-primary hover:underline">
            Daftarkan bengkel
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <Input label="Email" icon="mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
        <Input
          label="Password"
          icon="lock"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="login-password"
        />
        {login.error && <Alert tone="danger">{errorMessage(login.error)}</Alert>}
        <Button type="submit" size="lg" loading={login.isPending} data-testid="login-submit">
          Masuk
        </Button>
        {googleEnabled() && <GoogleButton from={(location.state as { from?: string } | null)?.from} />}
        <p className="text-center text-xs text-ink-3">
          Butuh bantuan darurat tanpa akun?{' '}
          <Link to="/emergency" className="font-semibold text-emergency-ink hover:underline">
            Kirim SOS sebagai tamu
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function GoogleButton({ from }: { from?: string }) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <div className="flex items-center gap-3 font-label text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" /> atau <span className="h-px flex-1 bg-line" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        icon="account_circle"
        loading={leaving}
        data-testid="google-login"
        onClick={() => {
          setLeaving(true);
          setError(null);
          startGoogleLogin(from).catch(() => {
            setLeaving(false);
            setError('Browser ini tidak mendukung login Google yang aman. Coba browser lain.');
          });
        }}
      >
        Masuk dengan Google
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  );
}

/** Google redirects back here with ?code&state; we finish the PKCE exchange with the API. */
export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Read the stored verifier exactly once, even under React StrictMode double effects.
  const [check] = useState(() => checkCallback(new URLSearchParams(search), takePendingGoogleLogin()));
  const exchange = useMutation({
    mutationFn: (c: { code: string; verifier: string }) => authApi.google({ code: c.code, code_verifier: c.verifier }),
    onSuccess: (s) => {
      const from = check.ok ? check.from : undefined;
      navigate(from && canReturnTo(s.user.role, from) ? from : homeFor(s.user.role), { replace: true });
    },
  });
  const { mutate } = exchange;
  const started = useRef(false); // a Google code is single-use: never exchange it twice (StrictMode re-runs effects)
  useEffect(() => {
    if (!check.ok || started.current) return;
    started.current = true;
    mutate({ code: check.code, verifier: check.verifier });
  }, [check, mutate]);

  const failure = !check.ok ? check.message : exchange.error ? errorMessage(exchange.error) : null;
  return (
    <div className="mx-auto max-w-md rounded-xl border border-line bg-card p-8 text-center shadow-lift" data-testid="google-callback">
      {failure ? (
        <>
          <Alert tone="danger">{failure}</Alert>
          <Link to="/login" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-semibold text-white hover:bg-primary-dark">
            <Icon name="arrow_back" /> Kembali ke halaman Masuk
          </Link>
        </>
      ) : (
        <Loading text="Menyelesaikan login Google…" />
      )}
    </div>
  );
}

/** "Lengkapi dulu" entry for a contact/password field: missing when empty, otherwise flags a wrong format. */
function issueOf(value: string, label: string, valid: (v: string) => boolean, wrong: string, target: string) {
  const l = fieldIssue(value, label, valid, wrong);
  return l ? { label: l, target } : null;
}

const PASSWORD_HINT ='Min. 8 karakter, ada huruf besar, huruf kecil, dan angka';

export function RegisterPage() {
  const { target } = useAfterAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  // Next stop: enter the code from the email, then on to where the user was going.
  const register = useMutation({
    mutationFn: () => authApi.registerCustomer(f),
    onSuccess: (s) => navigate('/verifikasi-email', { replace: true, state: { from: target(s.user.role), justSent: true } }),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const [tried, setTried] = useState(false);
  const issues = [
    f.name.trim().length < 2 && { label: 'Nama lengkap', target: 'reg-name' },
    issueOf(f.email, 'Email', isEmail, 'Format email belum benar', 'reg-email'),
    issueOf(f.phone, 'Nomor WhatsApp', isIdPhone, 'Nomor WhatsApp belum benar (mis. 0812…)', 'reg-phone'),
    issueOf(f.password, 'Password', isStrongPassword, 'Password belum memenuhi syarat', 'reg-password'),
  ];

  return (
    <AuthShell
      title="Buat akun pelanggan"
      subtitle="Simpan riwayat servis dan booking lebih cepat."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link to="/login" state={location.state} className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onInvalidCapture={() => setTried(true)}
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (issues.some(Boolean)) return;
          register.mutate();
        }}
      >
        <Input id="reg-name" label="Nama lengkap" icon="person" required value={f.name} onChange={set('name')} />
        <Input id="reg-email" label="Email" icon="mail" type="email" required value={f.email} onChange={set('email')} />
        <Input id="reg-phone" label="Nomor WhatsApp" icon="call" required value={f.phone} onChange={set('phone')} placeholder="08xxxxxxxxxx" />
        <Input id="reg-password" label="Password" icon="lock" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} hint={PASSWORD_HINT} />
        {tried && <MissingFields items={issues} />}
        {register.error && <Alert tone="danger">{errorMessage(register.error)}</Alert>}
        <Button type="submit" size="lg" loading={register.isPending}>
          Daftar
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterWorkshopPage() {
  const { done } = useAfterAuth();
  const [owner, setOwner] = useState({ name: '', email: '', phone: '', password: '' });
  const [ws, setWs] = useState({ name: '', description: '', address: '', phone: '', open_time: '08:00', close_time: '17:00', max_slot_per_hour: 3 });
  const [vehicles, setVehicles] = useState<VehicleType[]>(['MOTOR', 'MOBIL']);
  const [point, setPoint] = useState<LatLng | null>(null);
  const missing = [
    owner.name.trim().length < 2 && { label: 'Nama pemilik', target: 'ws-owner-name' },
    issueOf(owner.email, 'Email pemilik', isEmail, 'Format email belum benar', 'ws-owner-email'),
    issueOf(owner.phone, 'WhatsApp pemilik', isIdPhone, 'WhatsApp pemilik belum benar (mis. 0812…)', 'ws-owner-phone'),
    issueOf(owner.password, 'Password', isStrongPassword, 'Password belum memenuhi syarat', 'ws-owner-password'),
    ws.name.trim().length < 3 && { label: 'Nama bengkel (min. 3 karakter)', target: 'ws-name' },
    !ws.phone.trim() && { label: 'Telepon bengkel', target: 'ws-phone' },
    ws.address.trim().length < 5 && { label: 'Alamat bengkel (min. 5 karakter)', target: 'ws-address' },
    !!ws.open_time && !!ws.close_time && ws.open_time >= ws.close_time && { label: 'Jam tutup harus setelah jam buka', target: 'ws-close' },
    !point && { label: 'Lokasi bengkel di peta', target: 'ws-location' },
  ];

  const register = useMutation({
    mutationFn: () =>
      authApi.registerWorkshop({
        owner,
        workshop: { ...ws, description: ws.description || undefined, latitude: point!.lat, longitude: point!.lng, vehicle_types: vehicles },
      }),
    onSuccess: done,
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 rounded-xl bg-navy p-6 text-white sm:p-8">
        <p className="font-label text-xs font-bold tracking-[0.06em] text-sky uppercase">Kemitraan BengkelGo</p>
        <h1 className="mt-1 text-[20px] leading-tight font-bold sm:text-[24px]">Daftarkan bengkel Anda</h1>
        <p className="mt-2 max-w-2xl text-subtitle text-white/80">
          Kelola antrean per jam, mekanik, panggilan darurat, dan pembayaran QRIS. Bengkel tampil ke pelanggan setelah diverifikasi admin.
        </p>
      </div>
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (missing.some(Boolean)) return;
          register.mutate();
        }}
      >
        <Card title="Data pemilik" icon="badge">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ws-owner-name" label="Nama pemilik" icon="person" required value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
            <Input id="ws-owner-email" label="Email" icon="mail" type="email" required value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
            <Input id="ws-owner-phone" label="Nomor WhatsApp" icon="call" required value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} />
            <Input id="ws-owner-password" label="Password" icon="lock" type="password" required value={owner.password} onChange={(e) => setOwner({ ...owner, password: e.target.value })} hint={PASSWORD_HINT} />
          </div>
        </Card>

        <Card title="Data bengkel" icon="storefront">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="ws-name" label="Nama bengkel" required value={ws.name} onChange={(e) => setWs({ ...ws, name: e.target.value })} />
            <Input id="ws-phone" label="Telepon bengkel" icon="call" required value={ws.phone} onChange={(e) => setWs({ ...ws, phone: e.target.value })} />
            <div className="sm:col-span-2">
              <TextArea id="ws-address" label="Alamat" required value={ws.address} onChange={(e) => setWs({ ...ws, address: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <TextArea label="Deskripsi (opsional)" value={ws.description} onChange={(e) => setWs({ ...ws, description: e.target.value })} placeholder="Spesialisasi, fasilitas, dsb." />
            </div>
            <Input label="Jam buka" icon="schedule" type="time" step={3600} value={ws.open_time} onChange={(e) => setWs({ ...ws, open_time: e.target.value })} />
            <Input id="ws-close" label="Jam tutup" icon="schedule" type="time" step={3600} value={ws.close_time} onChange={(e) => setWs({ ...ws, close_time: e.target.value })} />
            <Input
              label="Kuota booking per jam"
              icon="event_seat"
              type="number"
              min={1}
              max={100}
              value={ws.max_slot_per_hour}
              onChange={(e) => setWs({ ...ws, max_slot_per_hour: Number(e.target.value) })}
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-label text-xs font-semibold">Jenis kendaraan</span>
              <Segmented
                label="Jenis kendaraan"
                value={vehicles.join(',')}
                onChange={(v) => setVehicles(v.split(',') as VehicleType[])}
                options={[
                  { value: 'MOTOR,MOBIL', label: 'Motor & Mobil' },
                  { value: 'MOTOR', label: 'Motor', icon: 'two_wheeler' },
                  { value: 'MOBIL', label: 'Mobil', icon: 'directions_car' },
                ]}
              />
            </div>
          </div>
        </Card>

        <Card id="ws-location" title="Lokasi bengkel" icon="location_on" subtitle="Klik pada peta untuk menandai titik bengkel. Dipakai untuk pencarian terdekat dan radius darurat 5 km.">
          <PlaceSearch
            className="mb-3"
            near={point}
            placeholder="Cari alamat bengkel: jalan, kelurahan, kota"
            onPick={(p) => setPoint({ lat: p.lat, lng: p.lng })}
          />
          <MapPicker value={point} onChange={setPoint} height={320} />
          <p className="mt-2 font-label text-xs text-ink-3">{point ? `Koordinat: ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}` : 'Lokasi belum dipilih'}</p>
          <AddressHint className="mt-1" point={point} useLabel="Pakai sebagai alamat" onUse={(a) => setWs((w) => ({ ...w, address: a }))} />
        </Card>

        {register.error && <Alert tone="danger">{errorMessage(register.error)}</Alert>}
        <Alert tone="info" icon="verified">
          Setelah mendaftar, bengkel akan diverifikasi admin sebelum tampil ke pelanggan.
        </Alert>
        <MissingFields items={missing} />
        <Button type="submit" size="lg" icon="how_to_reg" disabled={!point} loading={register.isPending} className="self-end">
          Daftarkan bengkel
        </Button>
      </form>
    </div>
  );
}

/** Enter the 6-digit code mailed at sign-up. Booking needs a confirmed email; everything else works without. */
export function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { from?: string; justSent?: boolean } | null) ?? {};
  const next = user && state.from && canReturnTo(user.role, state.from) ? state.from : homeFor(user?.role);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(state.justSent ? 60 : 0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useMutation({ mutationFn: () => authApi.verifyEmail(code), onSuccess: () => navigate(next, { replace: true }) });
  const resend = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setResent(true);
      setWait(60);
    },
  });

  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: '/verifikasi-email' }} />;

  return (
    <AuthShell
      title={user.email_verified ? 'Email sudah terverifikasi' : 'Cek email Anda'}
      subtitle={user.email_verified ? 'Anda bisa langsung booking servis.' : `Kami mengirim kode 6 angka ke ${user.email ?? 'email Anda'}.`}
      footer={
        !user.email_verified && (
          <Link to={next} replace className="font-semibold text-primary hover:underline" data-testid="verify-later">
            Nanti saja
          </Link>
        )
      }
    >
      {user.email_verified ? (
        <Button size="lg" onClick={() => navigate(next, { replace: true })}>
          Lanjutkan
        </Button>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) verify.mutate();
          }}
        >
          <Input
            id="verify-code"
            label="Kode verifikasi"
            icon="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 angka"
            className="tracking-[0.3em]"
            hint="Tidak ada di kotak masuk? Cek juga folder Spam atau Promosi."
            data-testid="verify-code"
          />
          {verify.error && <Alert tone="danger">{errorMessage(verify.error)}</Alert>}
          {resend.error && <Alert tone="danger">{errorMessage(resend.error)}</Alert>}
          {resent && !resend.error && <Alert tone="success">Kode baru sudah dikirim ke email Anda.</Alert>}
          <Button type="submit" size="lg" loading={verify.isPending} disabled={code.length !== 6} data-testid="verify-submit">
            Verifikasi
          </Button>
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={wait > 0 || resend.isPending}
            className="font-label text-sm font-semibold text-primary hover:underline disabled:text-ink-3 disabled:no-underline"
            data-testid="verify-resend"
          >
            {wait > 0 ? `Kirim ulang kode dalam ${wait} detik` : 'Kirim ulang kode'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
