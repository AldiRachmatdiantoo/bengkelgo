import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { AdminWorkshop, TransactionReport, WorkshopStatus } from '@/services/api/types';
import { PointsMap } from '@/components/map/Maps';
import { AdminLiveStats } from './AdminToolsPages';
import { regionOf, vehicleIcon, vehicleLabel } from '@/components/workshop/WorkshopComponents';
import { Alert, Badge, Button, EmptyState, Icon, InfoRow, Input, Loading, Modal, PageHeader, ProgressBar, Segmented, StatCard, Table, Td, cx, toast } from '@/components/ui';
import { ORDER_STATUS, WORKSHOP_STATUS, dateTime, jakartaDate, rupiah } from '@/utils/format';

type Action = 'APPROVE' | 'REJECT' | 'SUSPEND';
type Period = '7' | '30' | '90' | 'month';

const PERIODS: { value: Period; label: string }[] = [
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: '90', label: '90 hari terakhir' },
  { value: 'month', label: 'Bulan berjalan' },
];

/** {from,to} for a period + the equally long period right before it (for growth). */
function rangeOf(p: Period) {
  const to = jakartaDate(0);
  const days = p === 'month' ? Number(to.slice(8, 10)) - 1 : Number(p) - 1;
  const from = jakartaDate(-days);
  return { from, to, prev: { from: jakartaDate(-days * 2 - 1), to: jakartaDate(-days - 1) } };
}

const km = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function exportReport(r: TransactionReport) {
  downloadCsv(`laporan-bengkelgo-${r.period.from}_${r.period.to}.csv`, [
    ['Periode', r.period.from, r.period.to],
    [],
    ['Ringkasan'],
    ['Total pesanan', r.summary.total_orders],
    ['Pesanan selesai', r.summary.completed_orders],
    ['Pesanan batal', r.summary.cancelled_orders],
    ['Pendapatan terverifikasi (Rp)', r.summary.verified_revenue],
    ['Menunggu verifikasi (Rp)', r.summary.pending_verification_amount],
    ['Pembayaran lunas', r.summary.verified_payments],
    ['Pembayaran ditolak', r.summary.rejected_payments],
    ['Dana dikembalikan (Rp)', r.summary.refunded_amount ?? 0],
    ['Pembayaran dikembalikan', r.summary.refunded_payments ?? 0],
    [],
    ['Harian'],
    ['Tanggal', 'Pesanan', 'Pendapatan terverifikasi (Rp)'],
    ...r.daily.map((d) => [d.date, d.orders, d.verified_revenue]),
    [],
    ['Bengkel teratas'],
    ['Bengkel', 'Pesanan', 'Pendapatan terverifikasi (Rp)'],
    ...r.top_workshops.map((w) => [w.name, w.orders, w.verified_revenue]),
  ]);
  toast('Laporan CSV diunduh');
}

/** Printable report in a new window; the browser's print dialog saves it as PDF (no PDF library needed). */
function exportReportPdf(r: TransactionReport) {
  const esc = (v: string | number) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const rows = (cells: (string | number)[][]) => cells.map((c) => `<tr>${c.map((v, i) => `<td${i ? ' class="n"' : ''}>${esc(v)}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan BengkelGo ${esc(r.period.from)} – ${esc(r.period.to)}</title>
<style>
  *{box-sizing:border-box} body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#192557;margin:32px;font-size:12px}
  h1{font-size:20px;margin:0} h2{font-size:14px;margin:24px 0 8px} .muted{color:#7a829f}
  .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px} .kpi div{border:1px solid #e4e7f1;border-radius:8px;padding:10px}
  .kpi b{display:block;font-size:15px;margin-top:4px} table{width:100%;border-collapse:collapse}
  th,td{border-bottom:1px solid #e4e7f1;padding:6px 8px;text-align:left} th{background:#f3f3f7;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
  td.n{text-align:right;font-variant-numeric:tabular-nums} th.n{text-align:right}
  @page{margin:16mm} @media print{body{margin:0}}
</style></head><body>
<h1>Laporan Transaksi BengkelGo</h1>
<p class="muted">Periode ${esc(r.period.from)} s/d ${esc(r.period.to)} · dicetak ${esc(new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB</p>
<div class="kpi">
  <div>Pendapatan terverifikasi<b>${esc(rupiah(r.summary.verified_revenue))}</b></div>
  <div>Menunggu verifikasi<b>${esc(rupiah(r.summary.pending_verification_amount))}</b></div>
  <div>Total pesanan<b>${esc(r.summary.total_orders)}</b></div>
  <div>Selesai / batal<b>${esc(r.summary.completed_orders)} / ${esc(r.summary.cancelled_orders)}</b></div>
  <div>Dana dikembalikan<b>${esc(rupiah(r.summary.refunded_amount ?? 0))}</b></div>
</div>
<h2>Per tipe layanan</h2>
<table><thead><tr><th>Tipe</th><th class="n">Pesanan</th><th class="n">Pendapatan terverifikasi</th></tr></thead><tbody>
${rows(r.by_type.map((t) => [t.type === 'EMERGENCY' ? 'SOS Darurat' : 'Booking Servis', t.orders, rupiah(t.verified_revenue)]))}</tbody></table>
<h2>Bengkel teratas</h2>
<table><thead><tr><th>Bengkel</th><th class="n">Pesanan</th><th class="n">Pendapatan terverifikasi</th></tr></thead><tbody>
${rows(r.top_workshops.map((w) => [w.name, w.orders, rupiah(w.verified_revenue)])) || '<tr><td colspan="3" class="muted">Belum ada data.</td></tr>'}</tbody></table>
<h2>Harian</h2>
<table><thead><tr><th>Tanggal</th><th class="n">Pesanan</th><th class="n">Pendapatan terverifikasi</th></tr></thead><tbody>
${rows(r.daily.map((d) => [d.date, d.orders, rupiah(d.verified_revenue)])) || '<tr><td colspan="3" class="muted">Belum ada transaksi.</td></tr>'}</tbody></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return toast('Pop-up diblokir browser', { tone: 'danger', text: 'Izinkan pop-up untuk situs ini, lalu coba lagi.' });
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function useApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { id: string; name: string; action: Action; reason?: string }) => adminApi.setApproval(p.id, { action: p.action, reason: p.reason }),
    onSuccess: (_d, p) => {
      void qc.invalidateQueries({ queryKey: ['admin-workshops'] });
      toast('Aksi berhasil', { text: `${p.name}: ${p.action === 'APPROVE' ? 'disetujui & tampil ke pelanggan' : p.action === 'REJECT' ? 'ditolak' : 'dinonaktifkan'}.` });
    },
    onError: (e) => toast('Aksi gagal', { tone: 'danger', text: errorMessage(e) }),
  });
}

/** Reason dialog for reject/suspend (replaces window.prompt). */
function ReasonModal({ target, onClose, onSubmit, loading }: { target: { w: AdminWorkshop; action: 'REJECT' | 'SUSPEND' } | null; onClose: () => void; onSubmit: (reason: string) => void; loading: boolean }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      icon={target?.action === 'REJECT' ? 'close' : 'pause_circle'}
      tone="danger"
      title={target?.action === 'REJECT' ? `Tolak ${target?.w.name}?` : `Nonaktifkan ${target?.w.name}?`}
      actions={
        <>
          <Button variant="ghost" className="bg-surface-low" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={loading}
            onClick={() => {
              onSubmit(reason.trim());
              setReason('');
            }}
          >
            {target?.action === 'REJECT' ? 'Tolak & minta perbaikan' : 'Nonaktifkan mitra'}
          </Button>
        </>
      }
    >
      <p className="mb-3">Alasan ditampilkan kepada pemilik bengkel di portal mitra.</p>
      <Input label="Alasan" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Alamat belum lengkap, mohon diperbaiki" />
    </Modal>
  );
}

// ================================================================ dashboard overview (Stitch "Platform Governance")
export function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>('month');
  const r = rangeOf(period);
  const report = useQuery({ queryKey: ['admin-report', r.from, r.to], queryFn: () => adminApi.report({ from: r.from, to: r.to }) });
  const prev = useQuery({ queryKey: ['admin-report', r.prev.from, r.prev.to], queryFn: () => adminApi.report({ from: r.prev.from, to: r.prev.to }) });
  const pending = useQuery({ queryKey: ['admin-workshops', 'PENDING'], queryFn: () => adminApi.workshops({ status: 'PENDING', limit: 100 }) });
  const approved = useQuery({ queryKey: ['admin-workshops', 'APPROVED'], queryFn: () => adminApi.workshops({ status: 'APPROVED', limit: 100 }) });
  const act = useApproval();
  const [reasonFor, setReasonFor] = useState<{ w: AdminWorkshop; action: 'REJECT' | 'SUSPEND' } | null>(null);

  const s = report.data?.summary;
  const growth = s && prev.data && prev.data.summary.verified_revenue > 0 ? ((s.verified_revenue - prev.data.summary.verified_revenue) / prev.data.summary.verified_revenue) * 100 : null;
  const emergencyOrders = report.data?.by_type.find((t) => t.type === 'EMERGENCY')?.orders ?? 0;
  const approvedList = approved.data ?? [];
  const live = approvedList.filter((w) => w.is_open).length;
  const queue = pending.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <AdminLiveStats />
      <section className="flex flex-col gap-5 rounded-xl border border-line bg-card p-6 shadow-sm lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-label text-xs font-semibold text-ink-2">
            <span className="rounded-full bg-sky px-2.5 py-1 font-bold text-primary">Pusat kendali admin</span>
          </p>
          <h1 className="mt-2 text-[21px] leading-tight font-bold tracking-[-0.02em] text-navy sm:text-headline-lg">Admin Platform &amp; Analitik Operasional</h1>
          <p className="mt-1 max-w-2xl text-subtitle text-ink-2">Pusat verifikasi mitra bengkel UMKM, ringkasan transaksi QRIS, dan aktivitas panggilan darurat.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative inline-flex h-11 items-center gap-2 rounded-full border border-line bg-card pr-9 pl-4 font-label text-sm font-semibold text-navy">
            <Icon name="calendar_month" className="text-primary" />
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="appearance-none bg-transparent focus:outline-none" aria-label="Periode">
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Icon name="arrow_drop_down" className="pointer-events-none absolute right-3" />
          </label>
          <Button variant="ghost" icon="download" className="border border-line bg-card" disabled={!report.data} onClick={() => report.data && exportReport(report.data)}>
            Export CSV
          </Button>
          <Button variant="ghost" icon="picture_as_pdf" className="border border-line bg-card" disabled={!report.data} onClick={() => report.data && exportReportPdf(report.data)}>
            Export PDF
          </Button>
          <Link to="/admin/reports" className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-5 font-label text-sm font-semibold text-white hover:bg-primary-dark">
            <Icon name="account_balance_wallet" /> Audit Transaksi
          </Link>
        </div>
      </section>

      {report.error && <Alert tone="danger">{errorMessage(report.error)}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Volume transaksi terverifikasi"
          icon="payments"
          tone="success"
          value={s ? rupiah(s.verified_revenue) : '–'}
          aside={growth != null && <span className={growth >= 0 ? 'text-success' : 'text-emergency-ink'}>{`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`}</span>}
          hint={s ? `${s.verified_payments} pembayaran QRIS lunas · vs periode sebelumnya` : undefined}
        />
        <StatCard
          label="Mitra bengkel aktif"
          icon="storefront"
          tone="info"
          value={`${approvedList.length}${approvedList.length === 100 ? '+' : ''}`}
          aside={`${live} buka`}
          hint={
            queue.length ? (
              <span className="font-semibold text-emergency-ink">{queue.length} bengkel baru butuh persetujuan</span>
            ) : (
              'Tidak ada antrean persetujuan'
            )
          }
        />
        <StatCard label="Pesanan darurat SOS" icon="e911_emergency" tone="danger" value={emergencyOrders} hint={s ? `${s.completed_orders} pesanan selesai di periode ini` : undefined} />
        <StatCard
          label="Menunggu verifikasi"
          icon="hourglass_top"
          tone="warning"
          value={s ? rupiah(s.pending_verification_amount) : '–'}
          hint={s ? `${s.rejected_payments} bukti ditolak · ${s.refunded_payments ?? 0} dana dikembalikan · ${s.total_orders} total pesanan` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0 rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky text-primary">
                <Icon name="how_to_reg" />
              </span>
              <div className="min-w-0">
                <h2 className="text-headline-sm text-navy">Pipeline Persetujuan Kemitraan Bengkel Baru</h2>
                <p className="text-xs text-ink-3">Bengkel baru yang menunggu diperiksa dan disetujui.</p>
              </div>
            </div>
            {queue.length > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 font-label text-xs font-bold text-warning-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" /> {queue.length} menunggu verifikasi manual
              </span>
            )}
          </div>
          {pending.isLoading ? (
            <Loading />
          ) : queue.length ? (
            <>
              <WorkshopApprovalCard
                w={queue[0]}
                others={approvedList}
                busy={act.isPending && act.variables?.id === queue[0].id}
                onApprove={() => act.mutate({ id: queue[0].id, name: queue[0].name, action: 'APPROVE' })}
                onReject={() => setReasonFor({ w: queue[0], action: 'REJECT' })}
              />
              {queue.length > 1 && (
                <div className="mt-5">
                  <p className="mb-2 font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">Antrean persetujuan berikutnya</p>
                  <ul className="flex flex-col gap-2">
                    {queue.slice(1, 6).map((w) => (
                      <li key={w.id} className="flex items-center gap-3 rounded-lg bg-surface-low p-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card font-label text-sm font-bold text-navy">
                          {w.name
                            .split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-navy">{w.name}</p>
                          <p className="truncate font-label text-xs text-ink-2">
                            {regionOf(w.address)} • daftar {dateTime(w.created_at)}
                          </p>
                        </div>
                        <Link to="/admin/workshops" className="rounded-lg bg-card px-3 py-1.5 font-label text-xs font-bold text-primary shadow-sm hover:bg-sky">
                          Periksa
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon="task_alt">Semua pendaftaran bengkel sudah diproses.</EmptyState>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-navy">
              <Icon name="donut_small" className="text-primary" /> Status Pesanan
            </h2>
            {report.data ? <StatusBars r={report.data} /> : <Loading />}
          </section>
          <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-headline-sm text-navy">
                <Icon name="leaderboard" className="text-primary" /> Bengkel Teratas
              </h2>
              <Link to="/admin/reports" className="font-label text-xs font-bold text-primary hover:underline">
                Audit lengkap →
              </Link>
            </div>
            {report.data?.top_workshops.length ? (
              <ol className="flex flex-col gap-2">
                {report.data.top_workshops.slice(0, 5).map((w, i) => (
                  <li key={w.id} className="flex items-center gap-3 text-sm">
                    <span className="w-5 font-label font-bold text-ink-3">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-navy">{w.name}</span>
                    <span className="font-label text-xs text-ink-2">{w.orders} pesanan</span>
                    <span className="font-bold text-navy">{rupiah(w.verified_revenue)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-3">Belum ada transaksi pada periode ini.</p>
            )}
          </section>
        </div>
      </div>
      <ReasonModal
        target={reasonFor}
        onClose={() => setReasonFor(null)}
        loading={act.isPending}
        onSubmit={(reason) => {
          if (reasonFor) act.mutate({ id: reasonFor.w.id, name: reasonFor.w.name, action: reasonFor.action, reason }, { onSuccess: () => setReasonFor(null) });
        }}
      />
    </div>
  );
}

function StatusBars({ r }: { r: TransactionReport }) {
  if (r.by_status.length === 0) return <p className="text-sm text-ink-3">Tidak ada data.</p>;
  return (
    <div className="flex flex-col gap-3">
      {r.by_status.map((s) => (
        <div key={s.status}>
          <div className="mb-1 flex justify-between text-sm">
            <Badge tone={ORDER_STATUS[s.status].tone}>{ORDER_STATUS[s.status].label}</Badge>
            <span className="font-bold text-navy">{s.orders}</span>
          </div>
          <ProgressBar value={r.summary.total_orders ? (s.orders / r.summary.total_orders) * 100 : 0} tone={ORDER_STATUS[s.status].tone} label={`Porsi pesanan ${ORDER_STATUS[s.status].label}`} />
        </div>
      ))}
    </div>
  );
}

// ================================================================ partner approval
export function AdminWorkshopsPage() {
  const [status, setStatus] = useState<WorkshopStatus | ''>('PENDING');
  const list = useQuery({ queryKey: ['admin-workshops', status || 'ALL'], queryFn: () => adminApi.workshops({ status: status || undefined, limit: 100 }) });
  const approved = useQuery({ queryKey: ['admin-workshops', 'APPROVED'], queryFn: () => adminApi.workshops({ status: 'APPROVED', limit: 100 }) });
  const act = useApproval();
  const [reasonFor, setReasonFor] = useState<{ w: AdminWorkshop; action: 'REJECT' | 'SUSPEND' } | null>(null);

  return (
    <>
      <PageHeader eyebrow="Tata kelola mitra" title="Persetujuan Mitra" subtitle="Verifikasi bengkel baru sebelum tampil ke pelanggan, atau nonaktifkan mitra yang bermasalah." />
      <div className="no-scrollbar mb-5 overflow-x-auto">
        <Segmented
          label="Filter status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'PENDING', label: WORKSHOP_STATUS.PENDING.label, icon: 'pending_actions' },
            { value: 'APPROVED', label: WORKSHOP_STATUS.APPROVED.label, icon: 'verified' },
            { value: 'REJECTED', label: WORKSHOP_STATUS.REJECTED.label, icon: 'block' },
            { value: 'SUSPENDED', label: WORKSHOP_STATUS.SUSPENDED.label, icon: 'pause_circle' },
            { value: '', label: 'Semua' },
          ]}
        />
      </div>
      {list.isLoading ? (
        <Loading />
      ) : list.error ? (
        <Alert tone="danger">{errorMessage(list.error)}</Alert>
      ) : list.data?.length ? (
        <div className="flex flex-col gap-4">
          {list.data.map((w) => (
            <WorkshopApprovalCard
              key={w.id}
              w={w}
              others={approved.data ?? []}
              busy={act.isPending && act.variables?.id === w.id}
              onApprove={() => act.mutate({ id: w.id, name: w.name, action: 'APPROVE' })}
              onReject={() => setReasonFor({ w, action: 'REJECT' })}
              onSuspend={() => setReasonFor({ w, action: 'SUSPEND' })}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon="task_alt">Tidak ada bengkel dengan status ini.</EmptyState>
      )}
      <ReasonModal
        target={reasonFor}
        onClose={() => setReasonFor(null)}
        loading={act.isPending}
        onSubmit={(reason) => {
          if (reasonFor) act.mutate({ id: reasonFor.w.id, name: reasonFor.w.name, action: reasonFor.action, reason }, { onSuccess: () => setReasonFor(null) });
        }}
      />
    </>
  );
}

function WorkshopApprovalCard({
  w,
  others,
  busy,
  onApprove,
  onReject,
  onSuspend,
}: {
  w: AdminWorkshop;
  others: AdminWorkshop[];
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onSuspend?: () => void;
}) {
  const s = WORKSHOP_STATUS[w.status];
  const nearby = others.filter((o) => o.id !== w.id && km(o, w) <= 5);
  return (
    <section className={cx('overflow-hidden rounded-xl border bg-card shadow-sm', w.status === 'PENDING' ? 'border-warning/40' : 'border-line')} data-testid="admin-workshop">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-navy text-white">
            <Icon name="storefront" className="text-[24px]" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-headline-sm text-navy">{w.name}</h3>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-2">
              <Icon name="pin_drop" className="text-primary" /> {w.address}
            </p>
            <p className="mt-1 font-label text-xs text-ink-2">
              Pemilik: <b className="text-navy">{w.owner_name}</b> • daftar {dateTime(w.created_at)}
            </p>
            {w.status_reason && (
              <p className="mt-2 rounded-lg bg-surface-low px-3 py-2 text-sm text-ink-2">
                <b>Catatan:</b> {w.status_reason}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2 lg:w-56 lg:flex-col lg:items-stretch">
          {w.status !== 'APPROVED' && (
            <Button variant="success" icon="verified" loading={busy} onClick={onApprove} data-testid="admin-approve">
              Setujui &amp; Terbitkan Akses
            </Button>
          )}
          {w.status === 'PENDING' && (
            <Button variant="ghost" icon="close" className="bg-emergency-soft text-emergency-ink hover:bg-emergency-soft/70" disabled={busy} onClick={onReject}>
              Tolak &amp; Minta Perbaikan
            </Button>
          )}
          {w.status === 'APPROVED' && onSuspend && (
            <Button variant="danger" icon="pause_circle" disabled={busy} onClick={onSuspend}>
              Nonaktifkan
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 border-t border-line bg-surface-low/60 p-5 sm:p-6 lg:grid-cols-[1fr_1fr_260px]">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <InfoRow icon="person" label="Kontak pemilik">
            {w.owner_name}
            <span className="block text-sm font-normal text-ink-2">{w.owner_email}</span>
            <span className="block text-sm font-normal text-ink-2">{w.owner_phone}</span>
          </InfoRow>
          <InfoRow icon="schedule" label="Kapasitas servis">
            {w.max_slot_per_hour} booking / jam
            <span className="block text-sm font-normal text-ink-2">
              Buka {w.open_time}–{w.close_time}
            </span>
          </InfoRow>
          <InfoRow icon="directions_car" label="Kendaraan & SOS">
            <span className="flex flex-wrap gap-2">
              {w.vehicle_types.map((v) => (
                <span key={v} className="inline-flex items-center gap-1">
                  <Icon name={vehicleIcon(v)} className="text-[18px] text-ink-2" /> {vehicleLabel(v)}
                </span>
              ))}
            </span>
            <span className="block text-sm font-normal text-ink-2">{w.accepts_emergency ? 'Siaga panggilan darurat' : 'Tidak menerima SOS'}</span>
          </InfoRow>
          <InfoRow icon="satellite_alt" label="Titik lokasi">
            <span className="font-mono text-sm">
              {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
            </span>
            <span className={cx('mt-1 flex items-center gap-1 text-xs font-semibold', nearby.length ? 'text-warning-ink' : 'text-success')}>
              <Icon name={nearby.length ? 'info' : 'check'} className="text-[16px]" />
              {nearby.length ? `${nearby.length} mitra aktif lain dalam radius 5 km` : 'Tidak ada mitra aktif lain dalam radius 5 km'}
            </span>
          </InfoRow>
        </div>
        <div className="relative">
          <PointsMap
            origin={{ lat: w.latitude, lng: w.longitude }}
            originTone="primary"
            originLabel={w.name}
            radiusMeters={5000}
            zoom={11}
            points={nearby.map((o) => ({ id: o.id, lat: o.latitude, lng: o.longitude, label: o.name }))}
            height={150}
          />
          <a
            href={`https://www.openstreetmap.org/?mlat=${w.latitude}&mlon=${w.longitude}#map=16/${w.latitude}/${w.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="absolute right-2 bottom-2 z-[500] inline-flex items-center gap-1 rounded-md bg-card/95 px-2 py-1 font-label text-[11px] font-bold text-navy shadow-sm"
          >
            Coverage 5 km <Icon name="open_in_new" className="text-[14px]" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ================================================================ transaction audit
export function AdminReportsPage() {
  const [period, setPeriod] = useState<Period | 'custom'>('30');
  const [custom, setCustom] = useState({ from: jakartaDate(-30), to: jakartaDate(0) });
  const range = period === 'custom' ? custom : rangeOf(period);
  const report = useQuery({ queryKey: ['admin-report', range.from, range.to], queryFn: () => adminApi.report({ from: range.from, to: range.to }) });
  const r = report.data;
  const maxDaily = Math.max(1, ...(r?.daily.map((d) => d.verified_revenue) ?? []));
  const maxDailyOrders = Math.max(1, ...(r?.daily.map((d) => d.orders) ?? []));

  return (
    <>
      <PageHeader
        eyebrow="Analitik platform"
        title="Audit Transaksi"
        subtitle={
          <span>
            Ringkasan pesanan dan pembayaran terverifikasi seluruh mitra.
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button icon="download" disabled={!r} onClick={() => r && exportReport(r)}>
              Export CSV
            </Button>
            <Button variant="secondary" icon="picture_as_pdf" disabled={!r} onClick={() => r && exportReportPdf(r)} data-testid="report-pdf">
              Export PDF
            </Button>
          </div>
        }
      />
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4 shadow-sm">
        <Segmented
          label="Periode"
          value={period}
          onChange={setPeriod}
          options={[...PERIODS.map((p) => ({ value: p.value as Period | 'custom', label: p.label })), { value: 'custom', label: 'Pilih tanggal' }]}
          size="sm"
        />
        {period === 'custom' && (
          <div className="flex flex-wrap gap-3">
            <div className="w-44">
              <Input label="Dari" type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </div>
            <div className="w-44">
              <Input label="Sampai" type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </div>
          </div>
        )}
      </div>
      {report.isLoading ? (
        <Loading />
      ) : report.error || !r ? (
        <Alert tone="danger">{errorMessage(report.error)}</Alert>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Pendapatan terverifikasi" icon="payments" tone="success" value={rupiah(r.summary.verified_revenue)} hint={`${r.summary.verified_payments} pembayaran lunas${r.summary.refunded_payments ? ` · ${rupiah(r.summary.refunded_amount)} dikembalikan` : ''}`} />
            <StatCard label="Menunggu verifikasi" icon="hourglass_top" tone="warning" value={rupiah(r.summary.pending_verification_amount)} hint={`${r.summary.rejected_payments} bukti ditolak`} />
            <StatCard label="Total pesanan" icon="receipt_long" value={r.summary.total_orders} hint={`${r.period.from} s/d ${r.period.to}`} />
            <StatCard
              label="Selesai / batal"
              icon="task_alt"
              tone="neutral"
              value={`${r.summary.completed_orders} / ${r.summary.cancelled_orders}`}
              progress={r.summary.total_orders ? (r.summary.completed_orders / r.summary.total_orders) * 100 : 0}
            />
          </div>

          <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-headline-sm text-navy">Tren Harian</h2>
                <p className="text-sm text-ink-2">Tinggi batang: jumlah pesanan · isi gelap: pendapatan terverifikasi</p>
              </div>
            </div>
            {r.daily.length ? (
              <div className="no-scrollbar overflow-x-auto">
                <div className="flex h-56 min-w-full items-end gap-1.5" style={{ width: Math.max(r.daily.length * 28, 0) }}>
                  {r.daily.map((d) => (
                    <div key={d.date} className="group flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.orders} pesanan · ${rupiah(d.verified_revenue)}`}>
                      <span className="font-label text-[10px] text-ink-3">{d.orders}</span>
                      <span className="relative w-full overflow-hidden rounded-t-md bg-primary-fixed" style={{ height: `${Math.max(4, (d.orders / maxDailyOrders) * 100)}%` }}>
                        <span className="absolute inset-x-0 bottom-0 rounded-t-md bg-primary transition group-hover:bg-navy" style={{ height: `${(d.verified_revenue / maxDaily) * 100}%` }} />
                      </span>
                      <span className="font-label text-[10px] text-ink-3">{d.date.slice(8)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-3">Belum ada transaksi pada periode ini.</p>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-navy">
                <Icon name="category" className="text-primary" /> Per Tipe Layanan
              </h2>
              <div className="flex flex-col gap-3">
                {r.by_type.map((t) => (
                  <div key={t.type} className="flex items-center gap-3 rounded-lg border border-line p-3">
                    <span className={cx('grid h-10 w-10 place-items-center rounded-lg', t.type === 'EMERGENCY' ? 'bg-emergency-soft text-emergency-ink' : 'bg-sky text-primary')}>
                      <Icon name={t.type === 'EMERGENCY' ? 'e911_emergency' : 'event_available'} />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold">{t.type === 'EMERGENCY' ? 'SOS Darurat' : 'Booking Servis'}</p>
                      <p className="font-label text-xs text-ink-3">{t.orders} pesanan</p>
                    </div>
                    <span className="font-bold">{rupiah(t.verified_revenue)}</span>
                  </div>
                ))}
                {r.by_type.length === 0 && <p className="text-sm text-ink-3">Tidak ada data.</p>}
              </div>
            </section>
            <section className="rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-navy">
                <Icon name="donut_small" className="text-primary" /> Per Status
              </h2>
              <StatusBars r={r} />
            </section>
          </div>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-headline-sm text-navy">
              <Icon name="leaderboard" className="text-primary" /> Bengkel Teratas
            </h2>
            {r.top_workshops.length ? (
              <Table head={['#', 'Mitra bengkel', 'Pesanan', 'Pendapatan terverifikasi']}>
                {r.top_workshops.map((w, i) => (
                  <tr key={w.id}>
                    <Td className="w-12 font-label font-bold text-ink-3">{i + 1}</Td>
                    <Td className="font-semibold">{w.name}</Td>
                    <Td>{w.orders}</Td>
                    <Td className="font-semibold text-success">{rupiah(w.verified_revenue)}</Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState icon="leaderboard">Belum ada data.</EmptyState>
            )}
          </section>
        </div>
      )}
    </>
  );
}
