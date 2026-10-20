import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, type AppNotification } from '@/services/notifications/NotificationCenter';
import { Alert, Button, EmptyState, Icon, PageHeader, Segmented, cx } from '@/components/ui';
import { dateTime, longDate } from '@/utils/format';

const TONE_ICON: Record<AppNotification['tone'], string> = {
  danger: 'bg-emergency-soft text-emergency-ink',
  warning: 'bg-warning-soft text-warning-ink',
  success: 'bg-success-soft text-success',
  info: 'bg-sky text-primary',
  neutral: 'bg-surface-low text-ink-2',
};

const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(iso));

/** Notification history (all roles). */
export default function NotificationsPage() {
  const { items, unread, markRead, markAllRead, permission, requestPermission } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const shown = filter === 'unread' ? items.filter((n) => !n.read) : items;
  const groups = shown.reduce<Record<string, AppNotification[]>>((acc, n) => {
    (acc[dayKey(n.at)] ??= []).push(n);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Pemberitahuan"
        title="Riwayat Notifikasi"
        subtitle="Pesanan baru, panggilan darurat, pembayaran, dan perubahan status yang terkait dengan akun Anda."
        actions={
          <Button variant="secondary" size="sm" icon="done_all" disabled={!unread} onClick={markAllRead} data-testid="notif-mark-all">
            Tandai semua dibaca
          </Button>
        }
      />

      {permission !== 'unsupported' && permission !== 'granted' && (
        <div className="mb-5">
          <Alert tone="info" icon="notifications_active">
            <span className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {permission === 'denied'
                  ? 'Notifikasi browser diblokir. Izinkan lewat ikon gembok di bilah alamat browser agar pemberitahuan penting tetap muncul saat tab ini tidak dibuka.'
                  : 'Aktifkan notifikasi browser agar pemberitahuan penting (mis. SOS masuk) tetap muncul saat Anda membuka tab lain.'}
              </span>
              {permission === 'default' && (
                <Button size="sm" icon="notifications_active" onClick={() => void requestPermission()} data-testid="notif-permission">
                  Aktifkan
                </Button>
              )}
            </span>
          </Alert>
        </div>
      )}

      <div className="mb-5">
        <Segmented
          label="Filter notifikasi"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `Semua (${items.length})` },
            { value: 'unread', label: `Belum dibaca (${unread})` },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="notifications_off">{filter === 'unread' ? 'Tidak ada notifikasi yang belum dibaca.' : 'Belum ada notifikasi. Pemberitahuan baru akan muncul di sini.'}</EmptyState>
      ) : (
        <div className="flex flex-col gap-6" data-testid="notif-list">
          {Object.entries(groups).map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 font-label text-label-sm text-ink-3 uppercase">{longDate(day)}</h2>
              <ul className="overflow-hidden rounded-xl border border-line bg-card shadow-sm">
                {list.map((n) => (
                  <li key={n.id} className="border-b border-line last:border-0">
                    <NotificationRow n={n} onOpen={() => markRead(n.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 font-label text-xs text-ink-3">Riwayat tersimpan di akun Anda dan sama di semua perangkat (100 notifikasi terbaru).</p>
    </div>
  );
}

export function NotificationRow({ n, onOpen, compact }: { n: AppNotification; onOpen: () => void; compact?: boolean }) {
  const body = (
    <>
      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE_ICON[n.tone])}>
        <Icon name={n.icon} className="text-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm text-navy', n.read ? 'font-semibold' : 'font-bold')}>{n.title}</span>
        {n.text && <span className={cx('block text-xs text-ink-2', compact && 'line-clamp-1')}>{n.text}</span>}
        <span className="mt-0.5 block font-label text-[11px] text-ink-3">{dateTime(n.at)}</span>
      </span>
      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" role="img" aria-label="Belum dibaca" />}
    </>
  );
  const cls = cx('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-low', !n.read && 'bg-sky/50');
  return n.to ? (
    <Link to={n.to} onClick={onOpen} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>
      {body}
    </button>
  );
}
