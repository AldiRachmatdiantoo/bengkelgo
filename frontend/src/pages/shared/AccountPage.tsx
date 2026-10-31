import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Role, User } from '@/services/api/types';
import { useAuth } from '@/services/auth/AuthProvider';
import { UserAvatar } from '@/components/account/UserAvatar';
import { Alert, Badge, Button, Card, Icon, Input, MissingFields, Modal, PageHeader, cx, toast, SkeletonList, SkeletonPage } from '@/components/ui';
import { isEmail, isIdPhone, isStrongPassword } from '@/utils/formChecks';
import { ACCEPT_IMAGES, ImageCheckError, prepareImage } from '@/utils/imageUpload';
import { deviceLabel } from '@/utils/device';
import { dateTime } from '@/utils/format';

const ROLE_LABEL: Record<Role, string> = { CUSTOMER: 'Pelanggan', GUEST: 'Tamu', WORKSHOP_OWNER: 'Pemilik Bengkel', ADMIN: 'Admin Platform' };
const PASSWORD_HINT = 'Min. 8 karakter, ada huruf besar, huruf kecil, dan angka';

const joined = (iso?: string) => (iso ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(iso)) : null);

/** "5 menit lalu", "2 hari lalu". */
function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });
  if (s < 60) return 'baru saja';
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86_400) return rtf.format(-Math.floor(s / 3600), 'hour');
  return rtf.format(-Math.floor(s / 86_400), 'day');
}

/** "Akun saya": own details, photo, email, password, signed-in devices and (customers) deleting the account. */
export default function AccountPage() {
  const { user } = useAuth();
  if (!user) return <SkeletonPage />;
  const registered = user.role !== 'GUEST';
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader eyebrow="Akun" title="Akun Saya" subtitle="Atur data diri, email, password, dan perangkat yang sedang masuk." />
      <ProfileCard user={user} />
      <DetailsCard user={user} />
      {registered && <EmailCard user={user} />}
      {registered && <PasswordCard user={user} />}
      <SessionsCard />
      {user.role === 'CUSTOMER' && <DeleteAccountCard user={user} />}
    </div>
  );
}

// ---------------------------------------------------------------- photo + summary
function ProfileCard({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => accountApi.setPhoto((await prepareImage(file, { maxSide: 512 })).file),
    onSuccess: () => toast('Foto profil diperbarui'),
    onError: (e) => toast('Foto gagal diunggah', { tone: 'danger', text: e instanceof ImageCheckError ? e.message : errorMessage(e) }),
  });
  const remove = useMutation({ mutationFn: accountApi.removePhoto, onSuccess: () => toast('Foto profil dihapus') });
  const since = joined(user.created_at);

  return (
    <Card>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar user={user} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold text-navy" data-testid="account-name">
            {user.name}
          </p>
          <p className="font-label text-sm text-ink-2">
            {ROLE_LABEL[user.role]}
            {since && ` · Bergabung sejak ${since}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {user.email &&
              (user.email_verified ? (
                <Badge tone="success">Email terverifikasi</Badge>
              ) : (
                <Link to="/verifikasi-email" state={{ from: '/akun' }}>
                  <Badge tone="warning">Email belum diverifikasi</Badge>
                </Link>
              ))}
            {user.google_linked && <Badge tone="info">Tersambung dengan Google</Badge>}
          </div>
        </div>
        {user.role !== 'GUEST' && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={ACCEPT_IMAGES}
              className="sr-only"
              aria-label="Pilih foto profil"
              data-testid="account-photo-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = '';
              }}
            />
            <Button size="sm" variant="secondary" icon="photo_camera" loading={upload.isPending} onClick={() => input.current?.click()}>
              {user.photo_url ? 'Ganti foto' : 'Tambah foto'}
            </Button>
            {user.photo_url && (
              <Button size="sm" variant="ghost" icon="delete" className="text-emergency-ink" loading={remove.isPending} onClick={() => remove.mutate()} data-testid="account-photo-remove">
                Hapus foto
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- name + WhatsApp
function DetailsCard({ user }: { user: User }) {
  const [f, setF] = useState({ name: user.name, phone: user.phone ?? '' });
  const [tried, setTried] = useState(false);
  useEffect(() => setF({ name: user.name, phone: user.phone ?? '' }), [user.name, user.phone]);
  const changed = f.name.trim() !== user.name || f.phone.trim() !== (user.phone ?? '');
  const issues = [
    f.name.trim().length < 2 && { label: 'Nama lengkap (min. 2 huruf)', target: 'account-name-input' },
    f.phone.trim() && !isIdPhone(f.phone) && { label: 'Nomor WhatsApp belum benar (mis. 0812…)', target: 'account-phone' },
    !f.phone.trim() && !!user.phone && { label: 'Nomor WhatsApp', target: 'account-phone' },
  ];
  const save = useMutation({
    mutationFn: () =>
      accountApi.update({
        ...(f.name.trim() !== user.name ? { name: f.name.trim() } : {}),
        ...(f.phone.trim() && f.phone.trim() !== (user.phone ?? '') ? { phone: f.phone.trim() } : {}),
      }),
    onSuccess: () => {
      setTried(false);
      toast('Data diri disimpan');
    },
  });

  return (
    <Card title="Data diri" icon="badge" subtitle="Nama dan nomor WhatsApp yang dilihat bengkel saat Anda memesan.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (issues.some(Boolean) || !changed) return;
          save.mutate();
        }}
      >
        {!user.phone && (
          <Alert tone="warning" icon="call">
            {user.google_linked ? 'Akun Google tidak menyertakan nomor telepon. ' : ''}Isi nomor WhatsApp agar bengkel dan mekanik bisa menghubungi Anda saat booking atau SOS.
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="account-name-input" label="Nama lengkap" icon="person" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="account-name-input" />
          <Input
            id="account-phone"
            label="Nomor WhatsApp"
            icon="call"
            inputMode="tel"
            placeholder="08xxxxxxxxxx"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            hint={user.role === 'WORKSHOP_OWNER' ? 'Nomor pribadi Anda. Nomor bengkel diatur di Pengaturan Bengkel.' : undefined}
            data-testid="account-phone"
          />
        </div>
        {tried && <MissingFields items={issues} />}
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <div>
          <Button type="submit" icon="save" loading={save.isPending} disabled={!changed} data-testid="account-details-save">
            Simpan
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- email
function EmailCard({ user }: { user: User }) {
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ['email-change'], queryFn: accountApi.pendingEmail });
  const [form, setForm] = useState<{ email: string; password: string } | null>(null);
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  // Kept only in this page's memory, so "Kirim ulang kode" does not ask for the password again.
  const asked = useRef<{ email: string; password?: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['email-change'] });

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const request = useMutation({
    mutationFn: (b: { email: string; password?: string }) => accountApi.requestEmail(b),
    onSuccess: (_r, b) => {
      asked.current = b;
      setForm(null);
      setCode('');
      setWait(60);
      void refresh();
    },
  });
  const confirm = useMutation({
    mutationFn: () => accountApi.confirmEmail(code),
    onSuccess: (u) => {
      asked.current = null;
      setCode('');
      void refresh();
      toast('Email berhasil diganti', { text: u.email ?? undefined });
    },
  });
  const cancel = useMutation({
    mutationFn: accountApi.cancelEmail,
    onSuccess: () => {
      asked.current = null;
      void refresh();
    },
  });

  const p = pending.data;
  const issues = form
    ? [
        !isEmail(form.email) && { label: 'Email baru (format belum benar)', target: 'account-new-email' },
        user.has_password && !form.password && { label: 'Password saat ini', target: 'account-email-password' },
      ]
    : [];

  return (
    <Card title="Email" icon="mail" subtitle="Dipakai untuk masuk dan menerima pemberitahuan pesanan.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-low px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-navy" data-testid="account-email">
              {user.email}
            </p>
            <p className="font-label text-xs text-ink-2">{user.email_verified ? 'Terverifikasi' : 'Belum diverifikasi'}</p>
          </div>
          {!form && !p && (
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setForm({ email: '', password: '' })} data-testid="account-email-change">
              Ganti email
            </Button>
          )}
        </div>

        {form && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (issues.some(Boolean)) return;
              request.mutate({ email: form.email.trim(), password: user.has_password ? form.password : undefined });
            }}
          >
            <Input id="account-new-email" label="Email baru" icon="alternate_email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="account-new-email" />
            {user.has_password && (
              <Input
                id="account-email-password"
                label="Password saat ini"
                icon="lock"
                type="password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                data-testid="account-email-password"
              />
            )}
            <MissingFields items={issues} />
            {request.error && <Alert tone="danger">{errorMessage(request.error)}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" icon="send" loading={request.isPending} disabled={issues.some(Boolean)} data-testid="account-email-send">
                Kirim kode ke email baru
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                Batal
              </Button>
            </div>
          </form>
        )}

        {p && !form && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) confirm.mutate();
            }}
          >
            <Alert tone="info" icon="mark_email_unread">
              Kode 6 angka sudah dikirim ke <b>{p.new_email}</b>. Email akun baru berganti setelah kode dimasukkan.
            </Alert>
            <Input
              id="account-email-code"
              label="Kode dari email baru"
              icon="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 angka"
              className="tracking-[0.3em]"
              hint="Tidak ada di kotak masuk? Cek juga folder Spam atau Promosi."
              data-testid="account-email-code"
            />
            {confirm.error && <Alert tone="danger">{errorMessage(confirm.error)}</Alert>}
            {request.error && <Alert tone="danger">{errorMessage(request.error)}</Alert>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" icon="check" loading={confirm.isPending} disabled={code.length !== 6} data-testid="account-email-confirm">
                Konfirmasi
              </Button>
              <Button
                variant="ghost"
                disabled={wait > 0 || request.isPending}
                onClick={() => (asked.current?.email === p.new_email ? request.mutate(asked.current) : setForm({ email: p.new_email, password: '' }))}
              >
                {wait > 0 ? `Kirim ulang dalam ${wait} dtk` : 'Kirim ulang kode'}
              </Button>
              <Button variant="ghost" className="text-emergency-ink" loading={cancel.isPending} onClick={() => cancel.mutate()}>
                Batalkan
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- password
function PasswordCard({ user }: { user: User }) {
  const qc = useQueryClient();
  const has = !!user.has_password;
  const empty = { current: '', next: '', confirm: '' };
  const [f, setF] = useState(empty);
  const [tried, setTried] = useState(false);
  const issues = [
    has && !f.current && { label: 'Password saat ini', target: 'account-pw-current' },
    !isStrongPassword(f.next) && { label: f.next ? 'Password baru belum memenuhi syarat' : 'Password baru', target: 'account-pw-new' },
    (!f.confirm || f.confirm !== f.next) && { label: 'Ulangi password baru yang sama', target: 'account-pw-confirm' },
  ];
  const save = useMutation({
    mutationFn: () => accountApi.changePassword({ current_password: has ? f.current : undefined, new_password: f.next }),
    onSuccess: (r) => {
      setF(empty);
      setTried(false);
      void qc.invalidateQueries({ queryKey: ['account-sessions'] });
      toast(has ? 'Password diganti' : 'Password dibuat', {
        text: r.signed_out_devices ? `${r.signed_out_devices} perangkat lain dikeluarkan.` : 'Kini Anda juga bisa masuk dengan email dan password.',
      });
    },
  });

  return (
    <Card
      title={has ? 'Ganti password' : 'Buat password'}
      icon="lock"
      subtitle={has ? 'Perangkat lain yang sedang masuk akan dikeluarkan. Perangkat ini tetap masuk.' : 'Akun Anda masuk lewat Google. Buat password agar bisa masuk dengan email juga.'}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (issues.some(Boolean)) return;
          save.mutate();
        }}
      >
        {has && (
          <Input
            id="account-pw-current"
            label="Password saat ini"
            icon="lock"
            type="password"
            autoComplete="current-password"
            value={f.current}
            onChange={(e) => setF({ ...f, current: e.target.value })}
            data-testid="account-pw-current"
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="account-pw-new" label="Password baru" icon="key" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} hint={PASSWORD_HINT} data-testid="account-pw-new" />
          <Input id="account-pw-confirm" label="Ulangi password baru" icon="key" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} data-testid="account-pw-confirm" />
        </div>
        {tried && <MissingFields items={issues} />}
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" icon="save" loading={save.isPending} data-testid="account-pw-save">
            {has ? 'Ganti password' : 'Buat password'}
          </Button>
          {has && (
            <Link to="/lupa-password" state={{ email: user.email }} className="font-label text-sm font-semibold text-primary hover:underline">
              Lupa password saat ini?
            </Link>
          )}
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- signed-in devices
function SessionsCard() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['account-sessions'], queryFn: accountApi.sessions });
  const refresh = () => qc.invalidateQueries({ queryKey: ['account-sessions'] });
  const one = useMutation({
    mutationFn: (id: string) => accountApi.revokeSession(id),
    onSuccess: () => {
      void refresh();
      toast('Perangkat dikeluarkan');
    },
    onError: (e) => toast('Gagal mengeluarkan perangkat', { tone: 'danger', text: errorMessage(e) }),
  });
  const others = useMutation({
    mutationFn: accountApi.revokeOthers,
    onSuccess: (r) => {
      void refresh();
      toast('Perangkat lain dikeluarkan', { text: `${r.signed_out_devices} perangkat.` });
    },
    onError: (e) => toast('Gagal mengeluarkan perangkat', { tone: 'danger', text: errorMessage(e) }),
  });
  const sessions = list.data ?? [];
  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <Card
      title="Perangkat yang sedang masuk"
      icon="devices"
      subtitle="Keluarkan perangkat yang tidak Anda kenali, lalu ganti password."
      actions={
        <Button size="sm" variant="secondary" icon="logout" disabled={!otherCount} loading={others.isPending} onClick={() => others.mutate()} data-testid="account-revoke-others">
          Keluarkan perangkat lain
        </Button>
      }
    >
      {list.isLoading ? (
        <SkeletonList rows={2} />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : (
        <ul className="divide-y divide-line" data-testid="account-sessions">
          {sessions.map((s) => {
            const d = deviceLabel(s.user_agent);
            return (
              <li key={s.id} className="flex items-center gap-3 py-3" data-testid="account-session">
                <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-lg', s.current ? 'bg-sky text-primary' : 'bg-surface-low text-ink-2')}>
                  <Icon name={d.icon} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-navy">
                    {d.name}
                    {s.current && <Badge tone="success">Perangkat ini</Badge>}
                  </p>
                  <p className="font-label text-xs text-ink-2">
                    Masuk {dateTime(s.signed_in_at)} · aktif {ago(s.last_active_at)}
                  </p>
                </div>
                {!s.current && (
                  <Button size="sm" variant="ghost" className="text-emergency-ink" loading={one.isPending && one.variables === s.id} onClick={() => one.mutate(s.id)}>
                    Keluarkan
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- delete (customers)
function DeleteAccountCard({ user }: { user: User }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const has = !!user.has_password;
  const ready = has ? secret.length > 0 : secret.trim().toUpperCase() === 'HAPUS';
  const close = () => {
    setOpen(false);
    setSecret('');
    remove.reset();
  };
  const remove = useMutation({
    mutationFn: () => accountApi.deleteAccount(has ? { password: secret } : { confirm: secret.trim() }),
    onSuccess: async () => {
      setOpen(false);
      navigate('/', { replace: true });
      await logout();
      toast('Akun Anda sudah dihapus', { text: 'Terima kasih sudah memakai BengkelGo.' });
    },
  });

  return (
    <Card title="Hapus akun" icon="person_remove" accent="emergency">
      <div className="flex flex-col gap-4 text-sm text-ink-2">
        <p>Menghapus akun tidak bisa dibatalkan.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Dihapus: nama, email, nomor WhatsApp, foto, password, kendaraan tersimpan, dan notifikasi.</li>
          <li>Tetap disimpan tanpa data diri Anda: riwayat pesanan dan ulasan, untuk catatan bengkel.</li>
          <li>Pesanan yang belum selesai harus diselesaikan atau dibatalkan dulu.</li>
          <li>Anda bisa mendaftar lagi kapan saja dengan email yang sama.</li>
        </ul>
        <div>
          <Button variant="danger" icon="person_remove" onClick={() => setOpen(true)} data-testid="account-delete">
            Hapus akun saya
          </Button>
        </div>
      </div>
      <Modal
        open={open}
        onClose={close}
        title="Hapus akun secara permanen?"
        icon="warning"
        tone="danger"
        actions={
          <>
            <Button variant="ghost" onClick={close}>
              Batal
            </Button>
            <Button variant="danger" icon="person_remove" disabled={!ready} loading={remove.isPending} onClick={() => remove.mutate()} data-testid="account-delete-confirm">
              Hapus akun
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">Data diri Anda dihapus dan Anda langsung keluar dari semua perangkat.</p>
          {has ? (
            <Input
              id="account-delete-secret"
              label="Masukkan password Anda"
              icon="lock"
              type="password"
              autoComplete="current-password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              data-testid="account-delete-secret"
            />
          ) : (
            <Input id="account-delete-secret" label='Ketik "HAPUS" untuk mengonfirmasi' icon="keyboard" value={secret} onChange={(e) => setSecret(e.target.value)} data-testid="account-delete-secret" />
          )}
          {remove.error && <Alert tone="danger">{errorMessage(remove.error)}</Alert>}
        </div>
      </Modal>
    </Card>
  );
}
