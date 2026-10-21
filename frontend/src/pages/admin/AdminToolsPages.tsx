// Admin tools on top of the backlog-B endpoints: live numbers, global search, audit trail, system health.
import { Fragment, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { AdminUser, AuditLog, Role } from '@/services/api/types';
import { useAuth } from '@/services/auth/AuthProvider';
import { Alert, Badge, Button, Card, EmptyState, Input, Loading, MissingFields, Modal, PageHeader, Select, StatCard, Table, Td, TextArea, toast } from '@/components/ui';
import { ORDER_STATUS, PAYMENT_STATUS, WORKSHOP_STATUS, dateTime, jakartaDate, rupiah } from '@/utils/format';
import { isEmail, isIdPhone, isStrongPassword } from '@/utils/formChecks';

const ROLE: Record<string, string> = { CUSTOMER: 'Pelanggan', GUEST: 'Tamu', WORKSHOP_OWNER: 'Pemilik bengkel', ADMIN: 'Admin', SYSTEM: 'Sistem' };

/** Live platform counters (GET /admin/stats), shown on the admin dashboard. */
export function AdminLiveStats() {
  const { data: s, error } = useQuery({ queryKey: ['admin-stats'], queryFn: adminApi.stats, refetchInterval: 30_000 });
  if (error) return <Alert tone="danger">{errorMessage(error)}</Alert>;
  const users = s ? Object.values(s.users_by_role).reduce((a, b) => a + (b ?? 0), 0) : null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="admin-live-stats">
      <StatCard label="SOS berjalan" icon="e911_emergency" tone={s?.live_emergencies ? 'danger' : 'neutral'} value={s?.live_emergencies ?? '–'} hint={s ? `${s.orders_today} pesanan hari ini` : undefined} />
      <StatCard label="Bukti bayar menunggu" icon="hourglass_top" tone={s?.payments_to_verify ? 'warning' : 'neutral'} value={s?.payments_to_verify ?? '–'} hint="Diverifikasi oleh masing-masing bengkel" />
      <StatCard label="Pendapatan 30 hari" icon="payments" tone="success" value={s ? rupiah(s.verified_revenue_30d) : '–'} hint={s ? `${rupiah(s.refunded_30d)} dikembalikan` : undefined} />
      <StatCard label="Pengguna aktif" icon="group" value={users ?? '–'} hint={s ? `${s.users_by_role.CUSTOMER ?? 0} pelanggan · ${s.users_by_role.WORKSHOP_OWNER ?? 0} mitra` : undefined} />
    </div>
  );
}

function Group({ title, icon, count, children }: { title: string; icon: string; count: number; children: ReactNode }) {
  return (
    <Card title={`${title} (${count})`} icon={icon}>
      {count ? children : <p className="text-sm text-ink-3">Tidak ada yang cocok.</p>}
    </Card>
  );
}

export function AdminSearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const { data, isLoading, error } = useQuery({ queryKey: ['admin-search', q], queryFn: () => adminApi.search(q), enabled: q.trim().length >= 2 });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Pencarian" title="Cari di seluruh platform" subtitle="Nama/telepon bengkel, nomor pesanan, nomor invoice, nomor referensi transfer, nama pengirim, atau pengguna." />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim().length >= 2) setParams({ q: text.trim() });
        }}
      >
        <div className="min-w-64 flex-1">
          <Input label="Kata kunci" icon="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="mis. BK-20261020, INV-, Jaya Motor" data-testid="admin-search-page-input" />
        </div>
        <Button type="submit" icon="search" disabled={text.trim().length < 2}>
          Cari
        </Button>
      </form>
      {q.trim().length < 2 ? (
        <EmptyState icon="search">Ketik minimal 2 huruf.</EmptyState>
      ) : isLoading ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger">{errorMessage(error)}</Alert>
      ) : (
        data && (
          <div className="grid gap-6 xl:grid-cols-2" data-testid="admin-search-results">
            <Group title="Bengkel" icon="storefront" count={data.workshops.length}>
              <ul className="divide-y divide-line">
                {data.workshops.map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold text-navy">{w.name}</span> <span className="text-xs text-ink-3">{w.phone}</span>
                    </span>
                    <Badge tone={WORKSHOP_STATUS[w.status].tone}>{WORKSHOP_STATUS[w.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </Group>
            <Group title="Pesanan" icon="receipt_long" count={data.orders.length}>
              <ul className="divide-y divide-line">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2">
                    <Link to={`/orders/${o.id}`} className="font-mono text-sm font-bold text-primary hover:underline">
                      {o.order_number}
                    </Link>
                    <span className="text-right text-xs text-ink-2">
                      {o.workshop_name ?? '–'} · {ORDER_STATUS[o.status]?.label ?? o.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
            <Group title="Pembayaran" icon="payments" count={data.payments.length}>
              <ul className="divide-y divide-line">
                {data.payments.map((p) => (
                  <li key={p.order_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link to={`/orders/${p.order_id}`} className="font-mono font-bold text-primary hover:underline">
                      {p.invoice_number ?? p.order_number}
                    </Link>
                    <span className="text-xs text-ink-2">{[p.payer_name, p.payer_reference && `Ref ${p.payer_reference}`].filter(Boolean).join(' · ')}</span>
                    <span className="font-semibold text-navy">
                      {rupiah(p.amount)} · {PAYMENT_STATUS[p.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
            <Group title="Pengguna" icon="group" count={data.users.length}>
              <ul className="divide-y divide-line">
                {data.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold text-navy">{u.name}</span> <span className="text-xs text-ink-3">{u.email}</span>
                    </span>
                    <span className="text-xs text-ink-2">
                      {ROLE[u.role]}
                      {!u.is_active && ' · nonaktif'}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
          </div>
        )
      )}
    </div>
  );
}

const ACTION: Record<string, string> = {
  WORKSHOP_APPROVE: 'Menyetujui mitra',
  WORKSHOP_REJECT: 'Menolak mitra',
  WORKSHOP_SUSPEND: 'Menonaktifkan mitra',
  PAYMENT_VERIFIED: 'Memverifikasi pembayaran',
  PAYMENT_REJECTED: 'Menolak bukti bayar',
  PAYMENT_REFUNDED: 'Mencatat pengembalian dana',
  ORDER_CANCELLED: 'Membatalkan pesanan',
  EMERGENCY_PRICE_CHANGED: 'Mengubah estimasi biaya SOS',
  QRIS_UPLOADED: 'Mengunggah QRIS',
  QRIS_REPLACED: 'Mengganti QRIS',
  SERVICE_DELETED: 'Menghapus layanan',
  USER_DEACTIVATED: 'Menonaktifkan pengguna',
  USER_ACTIVATED: 'Mengaktifkan pengguna',
  ADMIN_CREATED: 'Menambah admin',
};

function detailsText(l: AuditLog) {
  const d = l.details as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.amount === 'number') parts.push(rupiah(d.amount));
  if (d.from !== undefined && d.to !== undefined) parts.push(`${typeof d.from === 'number' ? rupiah(d.from) : d.from} → ${typeof d.to === 'number' ? rupiah(d.to) : d.to}`);
  if (d.invoice_number) parts.push(String(d.invoice_number));
  if (d.reason) parts.push(`Alasan: ${d.reason}`);
  if (d.note) parts.push(`Catatan: ${d.note}`);
  return parts.join(' · ');
}

export function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState(jakartaDate(-30));
  const { data, isLoading, error } = useQuery({ queryKey: ['audit-logs', action, from], queryFn: () => adminApi.auditLogs({ action: action || undefined, from, limit: 100 }) });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Kepatuhan" title="Audit Log" subtitle="Jejak tindakan penting. Catatan ini tidak bisa diubah atau dihapus, termasuk oleh admin." />
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Tindakan" value={action} onChange={(e) => setAction(e.target.value)} data-testid="audit-action">
          <option value="">Semua tindakan</option>
          {Object.entries(ACTION).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Input label="Sejak" type="date" value={from} max={jakartaDate(0)} onChange={(e) => e.target.value && setFrom(e.target.value)} />
      </div>
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger">{errorMessage(error)}</Alert>
      ) : data?.length ? (
        <div data-testid="audit-table">
          <Table head={['Waktu', 'Pelaku', 'Tindakan', 'Rincian', '']}>
            {data.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{dateTime(l.created_at)}</Td>
                <Td>
                  <p className="font-semibold">{l.actor_name ?? '–'}</p>
                  <p className="text-xs text-ink-3">{l.actor_role ? ROLE[l.actor_role] ?? l.actor_role : ''}</p>
                </Td>
                <Td>{ACTION[l.action] ?? l.action}</Td>
                <Td className="text-xs text-ink-2">{detailsText(l)}</Td>
                <Td>
                  {l.entity === 'order' && l.entity_id && (
                    <Link to={`/orders/${l.entity_id}`} className="font-label text-xs font-semibold text-primary hover:underline">
                      Lihat pesanan
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <EmptyState icon="policy">Belum ada catatan pada periode ini.</EmptyState>
      )}
    </div>
  );
}

function HealthRow({ label, ok, children }: { label: string; ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="flex items-center gap-2 font-semibold text-navy">
        <span className={ok ? 'h-2.5 w-2.5 rounded-full bg-success' : 'h-2.5 w-2.5 rounded-full bg-emergency'} />
        {label}
      </span>
      <span className="text-right text-sm text-ink-2">{children}</span>
    </li>
  );
}

export function AdminHealthPage() {
  const { data: h, isLoading, error, dataUpdatedAt, refetch, isFetching } = useQuery({ queryKey: ['admin-health'], queryFn: adminApi.health, refetchInterval: 30_000 });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operasional"
        title="Kesehatan Sistem"
        subtitle="Kondisi database, PostGIS, Redis, dan penjadwal. Diperbarui setiap 30 detik."
        actions={
          <Button variant="secondary" icon="refresh" loading={isFetching} onClick={() => void refetch()}>
            Periksa sekarang
          </Button>
        }
      />
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Alert tone="danger">{errorMessage(error)}</Alert>
      ) : (
        h && (
          <>
            <Alert tone={h.status === 'ok' ? 'success' : 'danger'}>
              {h.status === 'ok' ? 'Semua layanan berjalan normal.' : 'Ada layanan yang bermasalah. Periksa baris berwarna merah.'} Diperiksa {dateTime(new Date(dataUpdatedAt).toISOString())}.
            </Alert>
            <div className="grid gap-6 xl:grid-cols-2">
              <Card title="Layanan" icon="monitor_heart">
                <ul className="divide-y divide-line" data-testid="health-list">
                  <HealthRow label="Database" ok={h.database.ok}>
                    {h.database.ok ? `${h.database.latency_ms} ms` : h.database.error}
                  </HealthRow>
                  <HealthRow label="PostGIS" ok={h.postgis.ok}>
                    {h.postgis.ok ? `versi ${h.postgis.version}` : h.postgis.error}
                  </HealthRow>
                  <HealthRow label="Redis (rate limiter)" ok={h.redis.ok}>
                    {h.redis.ok ? `${h.redis.detail} · ${h.redis.latency_ms} ms` : h.redis.error}
                  </HealthRow>
                  <HealthRow label="Penjadwal (cron)" ok={h.scheduler.enabled}>
                    {h.scheduler.enabled ? `Pengingat berikutnya ${h.scheduler.next_reminder_run ? dateTime(h.scheduler.next_reminder_run) : '–'}` : 'Nonaktif di server ini'}
                  </HealthRow>
                  {h.email_queue && (
                    <HealthRow label="Antrean email" ok={h.email_queue.failed_7d === 0}>
                      {h.email_queue.pending ? `${h.email_queue.pending} menunggu dikirim${h.email_queue.retrying ? ` (${h.email_queue.retrying} sedang dicoba ulang)` : ''}` : 'Tidak ada yang menunggu'}
                      {h.email_queue.failed_7d > 0 && ` · ${h.email_queue.failed_7d} gagal dikirim dalam 7 hari terakhir (cek log server)`}
                    </HealthRow>
                  )}
                </ul>
              </Card>
              <Card title="Versi" icon="info">
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                  <dt className="text-ink-3">API</dt>
                  <dd className="font-mono text-navy">{h.version}</dd>
                  <dt className="text-ink-3">Node.js</dt>
                  <dd className="font-mono text-navy">{h.node}</dd>
                  <dt className="text-ink-3">Berjalan</dt>
                  <dd className="text-navy">{Math.floor(h.uptime_seconds / 3600)} jam {Math.floor((h.uptime_seconds % 3600) / 60)} menit</dd>
                  <dt className="text-ink-3">Migrasi</dt>
                  <dd className="font-mono text-xs text-navy">{h.migrations.join(', ')}</dd>
                  {h.client_ip && (
                    <>
                      <dt className="text-ink-3">IP Anda menurut server</dt>
                      <dd className="font-mono text-navy" data-testid="health-client-ip">{h.client_ip}</dd>
                    </>
                  )}
                  {h.proxy_headers &&
                    Object.entries(h.proxy_headers)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <Fragment key={k}>
                          <dt className="text-ink-3 font-mono text-xs">{k}</dt>
                          <dd className="font-mono text-xs text-navy break-all">{v}</dd>
                        </Fragment>
                      ))}
                </dl>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}

// ================================================================ access management (BE-15)
const ROLE_FILTERS: { value: '' | Role; label: string }[] = [
  { value: '', label: 'Semua peran' },
  { value: 'CUSTOMER', label: 'Pelanggan' },
  { value: 'GUEST', label: 'Tamu' },
  { value: 'WORKSHOP_OWNER', label: 'Pemilik bengkel' },
  { value: 'ADMIN', label: 'Admin' },
];

export function AdminUsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [role, setRole] = useState<'' | Role>('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');
  const [adding, setAdding] = useState(false);
  const active = status === 'all' ? undefined : status === 'active';
  const list = useQuery({ queryKey: ['admin-users', role, status, query], queryFn: () => adminApi.users({ role: role || undefined, q: query || undefined, active, limit: 100 }) });
  const toggle = useMutation({
    mutationFn: (u: AdminUser) => adminApi.setUserActive(u.id, !u.is_active, reason.trim() || undefined),
    onSuccess: (r, u) => {
      setToggling(null);
      setReason('');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast(r.is_active ? 'Akun diaktifkan' : 'Akun dinonaktifkan', { text: u.name });
    },
  });
  const users = list.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Akses"
        title="Pengguna"
        subtitle="Nonaktifkan akun yang disalahgunakan dan tambah admin. Akun nonaktif langsung tidak bisa masuk; sesi yang terbuka berakhir paling lama 15 menit."
        actions={
          <Button icon="person_add" onClick={() => setAdding(true)} data-testid="admin-add">
            Tambah admin
          </Button>
        }
      />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(text.trim());
        }}
      >
        <div className="min-w-56 flex-1">
          <Input label="Cari nama, email, atau telepon" icon="search" value={text} onChange={(e) => setText(e.target.value)} data-testid="users-search" />
        </div>
        <Select label="Peran" value={role} onChange={(e) => setRole(e.target.value as '' | Role)}>
          {ROLE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </Select>
        <Button type="submit" variant="secondary" icon="search">
          Cari
        </Button>
      </form>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : users.length ? (
        <div data-testid="users-table">
          <Table head={['Nama', 'Peran', 'Bergabung', 'Status', '']}>
            {/* Inactive rows get a tinted background (not opacity, which drops text below WCAG contrast). */}
            {users.map((u) => (
              <tr key={u.id} className={u.is_active ? '' : 'bg-surface-low'}>
                <Td>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-xs text-ink-3">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                </Td>
                <Td>
                  {ROLE[u.role]}
                  {u.workshop_name && <p className="text-xs text-ink-3">{u.workshop_name}</p>}
                  {u.orders > 0 && <p className="text-xs text-ink-3">{u.orders} pesanan</p>}
                </Td>
                <Td className="whitespace-nowrap">{dateTime(u.created_at)}</Td>
                <Td>{u.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="danger">Nonaktif</Badge>}</Td>
                <Td className="text-right">
                  {u.id !== me?.id && (
                    <Button size="sm" variant={u.is_active ? 'ghost' : 'secondary'} className={u.is_active ? 'text-emergency-ink hover:bg-emergency-soft' : ''} onClick={() => setToggling(u)} data-testid="user-toggle">
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <EmptyState icon="person_search">Tidak ada pengguna yang cocok.</EmptyState>
      )}

      <Modal
        open={!!toggling}
        onClose={() => {
          setToggling(null);
          toggle.reset();
        }}
        icon={toggling?.is_active ? 'block' : 'check_circle'}
        tone={toggling?.is_active ? 'danger' : undefined}
        title={toggling?.is_active ? `Nonaktifkan ${toggling.name}?` : `Aktifkan ${toggling?.name ?? ''}?`}
        actions={
          <>
            <Button variant="ghost" className="bg-surface-low" onClick={() => setToggling(null)}>
              Batal
            </Button>
            <Button variant={toggling?.is_active ? 'danger' : 'primary'} loading={toggle.isPending} onClick={() => toggling && toggle.mutate(toggling)} data-testid="user-toggle-confirm">
              {toggling?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
          </>
        }
      >
        <div className="mt-2 flex flex-col gap-3">
          <p>
            {toggling?.is_active
              ? 'Akun ini tidak bisa masuk lagi dan semua sesinya dicabut. Data dan riwayat pesanannya tetap tersimpan.'
              : 'Akun ini bisa masuk kembali seperti biasa.'}
            {toggling?.role === 'WORKSHOP_OWNER' && toggling.is_active && ' Bengkelnya tidak ikut nonaktif; nonaktifkan lewat Persetujuan Mitra bila perlu.'}
          </p>
          <TextArea label="Alasan (tercatat di audit log)" maxLength={300} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          {toggle.error && <Alert tone="danger">{errorMessage(toggle.error)}</Alert>}
        </div>
      </Modal>

      {adding && <AddAdminModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddAdminModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const issues = [
    f.name.trim().length < 2 && { label: 'Nama', target: 'adm-name' },
    !isEmail(f.email) && { label: f.email.trim() ? 'Format email belum benar' : 'Email', target: 'adm-email' },
    !!f.phone.trim() && !isIdPhone(f.phone) && { label: 'WhatsApp belum benar (mis. 0812…)', target: 'adm-phone' },
    !isStrongPassword(f.password) && { label: f.password ? 'Password belum memenuhi syarat' : 'Password awal', target: 'adm-password' },
  ];
  const ready = !issues.some(Boolean);
  const save = useMutation({
    mutationFn: () => adminApi.createAdmin({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, password: f.password }),
    onSuccess: (u) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
      toast('Admin ditambahkan', { text: `${u.name} bisa masuk dengan email dan password tadi.` });
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      icon="person_add"
      title="Tambah admin"
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button icon="save" disabled={!ready} loading={save.isPending} onClick={() => save.mutate()} data-testid="admin-save">
            Tambah admin
          </Button>
        </>
      }
    >
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate();
        }}
      >
        <Input id="adm-name" label="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="admin-name" />
        <Input id="adm-email" label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="admin-email" />
        <Input id="adm-phone" label="Nomor WhatsApp (opsional)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Input
          id="adm-password"
          label="Password awal"
          type="password"
          autoComplete="new-password"
          required
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          hint="Min. 8 karakter, ada huruf besar, huruf kecil, dan angka. Sampaikan ke admin baru lewat jalur yang aman."
          data-testid="admin-password"
        />
        <MissingFields items={issues} />
        {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
        <button type="submit" className="sr-only">
          Tambah admin
        </button>
      </form>
    </Modal>
  );
}
