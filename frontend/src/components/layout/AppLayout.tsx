import { AdminSearchBox } from './AdminSearchBox';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'framer-motion';
import { useAuth } from '@/services/auth/AuthProvider';
import { adminApi, orderApi, ownerApi } from '@/services/api/endpoints';
import { errorMessage } from '@/services/api/client';
import type { Role, User } from '@/services/api/types';
import { Icon, Loading, Toaster, cx, toast } from '@/components/ui';
import { PageFade } from '@/components/ui/motion';
import { NotificationProvider, useOptionalNotifications } from '@/services/notifications/NotificationCenter';
import { NotificationRow } from '@/pages/shared/NotificationsPage';

type NavItem = { to: string; label: string; icon: string; end?: boolean; search?: string; /** Shorter label for the desktop bar. */ short?: string };

const ROLE_LABEL: Record<Role, string> = { CUSTOMER: 'Pelanggan', GUEST: 'Tamu', WORKSHOP_OWNER: 'Pemilik Bengkel', ADMIN: 'Admin Platform' };

/** Where each portal starts. */
const PORTAL_HOME: Partial<Record<Role, { to: string; title: string }>> = {
  WORKSHOP_OWNER: { to: '/owner', title: 'Portal Mitra' },
  ADMIN: { to: '/admin', title: 'Admin Platform' },
};

export function Brand({ suffix, sub, light, compact }: { suffix?: string; sub?: string; light?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" role={compact ? 'img' : undefined} aria-label={compact ? `BengkelGo${suffix ?? ''}` : undefined}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-sm">
        <Icon name="car_repair" filled />
      </span>
      {/* compact: very narrow phones keep only the logo mark so the portal top bar fits in 375px */}
      <span className={cx('leading-none', compact && 'max-[400px]:hidden')}>
        <span className={cx('text-[18px] font-bold tracking-tight', light ? 'text-white' : 'text-navy')}>
          Bengkel<span className={light ? 'text-sky' : 'text-primary'}>Go</span>
          {suffix && <span className={light ? 'text-sky' : 'text-primary'}>{suffix}</span>}
        </span>
        {sub && <span className="mt-1 block font-label text-[10px] font-semibold tracking-[0.04em] text-ink-3 uppercase">{sub}</span>}
      </span>
    </span>
  );
}

function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return () => {
    // Leave protected pages first so the route guard doesn't bounce to /login.
    navigate('/');
    void logout();
  };
}

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' }) {
  return (
    <m.span
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-navy font-label font-bold text-white ring-0 ring-primary/25 transition-shadow hover:ring-4',
        size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm',
      )}
    >
      {user.name.trim().charAt(0).toUpperCase() || '?'}
    </m.span>
  );
}

/** Click-outside dropdown used by the account menus. */
function Dropdown({ trigger, children, align = 'right', label, width = 'w-60' }: { trigger: (open: boolean) => ReactNode; children: ReactNode; align?: 'left' | 'right'; label?: string; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} className="flex items-center rounded-full">
        {trigger(open)}
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={cx('absolute top-full z-[1100] mt-2 overflow-hidden rounded-xl border border-line bg-white py-2 shadow-lift', width, align === 'right' ? 'right-0' : 'left-0')}
          >
            {children}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ to, icon, children, onClick, danger }: { to?: string; icon: string; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  const cls = cx('flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-surface-low', danger ? 'text-emergency-ink' : 'text-navy');
  return to ? (
    <Link to={to} className={cls}>
      <Icon name={icon} /> {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      <Icon name={icon} /> {children}
    </button>
  );
}

/** Pages that belong to the owner/admin portal (order detail is shared with customers). */
const isPortalPath = (p: string) => p.startsWith('/owner') || p.startsWith('/admin') || p.startsWith('/orders/');

function UnreadBadge() {
  const n = useOptionalNotifications();
  return n && n.unread > 0 ? <span className="rounded-full bg-emergency-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{n.unread}</span> : null;
}

/** Where each role's notification history lives (inside its own shell). */
const NOTIF_PAGE: Record<Role, string> = { CUSTOMER: '/notifications', GUEST: '/notifications', WORKSHOP_OWNER: '/owner/notifications', ADMIN: '/admin/notifications' };

/** Bell with unread count; opens the latest notifications, with a link to the full history. */
function NotificationBell({ role }: { role: Role }) {
  const n = useOptionalNotifications();
  if (!n) return null;
  const latest = n.items.slice(0, 6);
  return (
    <Dropdown
      label={`${n.unread} notifikasi belum dibaca`}
      width="w-[min(92vw,22rem)]"
      trigger={() => (
        <span className="relative grid h-10 w-10 place-items-center rounded-lg bg-surface-low text-navy hover:bg-surface" data-testid="notif-bell">
          <Icon name={n.unread ? 'notifications_active' : 'notifications'} />
          {n.unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-emergency-ink px-1 font-label text-[10px] font-bold text-white">{n.unread > 99 ? '99+' : n.unread}</span>
          )}
        </span>
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 pt-1 pb-2.5">
        <p className="text-sm font-bold text-navy">Notifikasi</p>
        {n.unread > 0 && (
          <button type="button" onClick={n.markAllRead} className="font-label text-xs font-semibold text-primary hover:underline">
            Tandai semua dibaca
          </button>
        )}
      </div>
      {latest.length ? (
        <ul className="max-h-[60vh] overflow-y-auto">
          {latest.map((x) => (
            <li key={x.id} className="border-b border-line last:border-0">
              <NotificationRow n={x} compact onOpen={() => n.markRead(x.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-ink-3">Belum ada notifikasi.</p>
      )}
      <Link to={NOTIF_PAGE[role]} className="block border-t border-line px-4 pt-2.5 pb-1 text-center font-label text-sm font-bold text-primary hover:underline" data-testid="notif-all">
        Lihat semua notifikasi
      </Link>
    </Dropdown>
  );
}

/** Picks the shell by page: owner/admin portal on their pages, customer-facing site everywhere else. */
export function AppLayout() {
  const { user, loading } = useAuth();
  const { pathname, hash } = useLocation();
  useEffect(() => {
    // Links with an #anchor scroll to their section themselves.
    if (!hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loading text="Menyiapkan BengkelGo…" />
      </div>
    );
  }
  const inPortal = !!user && isPortalPath(pathname);
  return (
    <>
      <NotificationProvider user={user}>
        {inPortal && user.role === 'WORKSHOP_OWNER' ? <OwnerShell user={user} /> : inPortal && user.role === 'ADMIN' ? <AdminShell user={user} /> : <PublicShell />}
      </NotificationProvider>
      <Toaster />
    </>
  );
}

// ---------------------------------------------------------------- public / customer
const PUBLIC_NAV: NavItem[] = [
  { to: '/', label: 'Beranda', icon: 'home', end: true },
  { to: '/emergency', label: 'Bantuan Darurat SOS', icon: 'e911_emergency' },
  { to: '/workshops', search: '?tab=booking', label: 'Booking Jadwal Servis', short: 'Booking Servis', icon: 'calendar_month' },
  { to: '/workshops', search: '?tab=cari', label: 'Cari Bengkel Terdekat', short: 'Cari Bengkel', icon: 'storefront' },
  { to: '/register/workshop', label: 'Gabung Mitra', icon: 'handshake' },
];

function PublicShell() {
  const { user } = useAuth();
  const doLogout = useLogout();
  const [open, setOpen] = useState(false);
  const { pathname, hash, search } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname, hash, search]);
  const portal = user ? PORTAL_HOME[user.role] : undefined;
  const isActive = (l: NavItem) => (l.search ? pathname === l.to && search === l.search : l.end ? pathname === l.to && !hash : pathname.startsWith(l.to));

  return (
    // overflow-x-clip: full-bleed landing bands use 100vw; clip (not hidden) keeps the sticky header working.
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="sticky top-0 z-[1000] bg-white/95 shadow-header backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:h-20 sm:px-8 lg:px-20">
          <Link to="/" aria-label="BengkelGo beranda" className="shrink-0">
            <Brand />
          </Link>
          {/* Menu sits on the right, next to the account actions. */}
          <nav className="ml-auto hidden items-center gap-1 xl:flex">
            {/* SOS is already the red button on the right, so the desktop bar skips it. */}
            {PUBLIC_NAV.filter((l) => l.to !== '/emergency').map((l) => (
              <Link
                key={l.label}
                to={{ pathname: l.to, search: l.search }}
                className={cx(
                  'rounded-md px-2.5 py-1.5 font-label text-xs font-semibold whitespace-nowrap transition',
                  isActive(l) ? 'bg-primary-fixed/30 font-bold text-primary' : 'text-ink-2 hover:text-primary',
                )}
              >
                {l.short ?? l.label}
              </Link>
            ))}
            {!user && (
              <Link to="/login" className="px-3 py-1.5 font-label text-sm font-bold text-primary hover:underline">
                Masuk
              </Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 xl:ml-2">
            {portal && (
              <Link to={portal.to} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-navy px-3 font-label text-sm font-semibold whitespace-nowrap text-white shadow-sm hover:bg-navy/90 sm:px-4">
                <Icon name="space_dashboard" />
                <span className="hidden sm:inline">Ke {portal.title}</span>
                <span className="sm:hidden">Portal</span>
              </Link>
            )}
            {user && !portal && <NotificationBell role={user.role} />}
            {user ? (
              <div className="hidden sm:block">
              <Dropdown trigger={() => <Avatar user={user} />}>
                <div className="border-b border-line px-4 pt-1 pb-3">
                  <p className="truncate text-sm font-bold text-navy">{user.name}</p>
                  <p className="font-label text-xs text-ink-3">{ROLE_LABEL[user.role]}</p>
                </div>
                {portal ? (
                  <MenuItem to={portal.to} icon="space_dashboard">
                    {portal.title}
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem to="/orders" icon="receipt_long">
                      Pesanan saya
                    </MenuItem>
                    <MenuItem to="/vehicles" icon="garage">
                      Kendaraan saya
                    </MenuItem>
                    <MenuItem to="/notifications" icon="notifications">
                      Notifikasi
                    </MenuItem>
                  </>
                )}
                <MenuItem icon="logout" onClick={doLogout} danger>
                  Keluar
                </MenuItem>
              </Dropdown>
              </div>
            ) : (
              <Link to="/login" aria-label="Masuk" className="hidden h-9 w-9 place-items-center rounded-full bg-navy text-white hover:bg-navy/90 sm:grid">
                <Icon name="person" />
              </Link>
            )}
            <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-sky xl:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
              <Icon name={open ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-line bg-white px-4 py-3 xl:hidden">
            {PUBLIC_NAV.map((l) => (
              <Link
                key={l.label}
                to={{ pathname: l.to, search: l.search }}
                className={cx('flex items-center gap-3 rounded-lg px-3 py-3 font-semibold', isActive(l) ? 'bg-sky text-primary' : 'text-navy')}
              >
                <Icon name={l.icon} /> {l.label}
              </Link>
            ))}
            {user ? (
              <>
                {!portal && (
                  <>
                    <Link to="/orders" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold text-navy">
                      <Icon name="receipt_long" /> Pesanan saya
                    </Link>
                    <Link to="/vehicles" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold text-navy">
                      <Icon name="garage" /> Kendaraan saya
                    </Link>
                    <Link to="/notifications" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold text-navy">
                      <Icon name="notifications" /> Notifikasi
                    </Link>
                  </>
                )}
                <button onClick={doLogout} className="flex items-center gap-3 rounded-lg px-3 py-3 text-left font-semibold text-emergency-ink">
                  <Icon name="logout" /> Keluar ({user.name})
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold text-navy">
                  <Icon name="login" /> Masuk
                </Link>
                <Link to="/register" className="flex items-center gap-3 rounded-lg px-3 py-3 font-semibold text-navy">
                  <Icon name="person_add" /> Daftar akun
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <VerifyEmailStrip />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-12 lg:px-20">
        <PageFade key={pathname}>
          <Outlet />
        </PageFade>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-20">
          <div className="max-w-sm">
            <Brand />
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              Platform servis kendaraan dan pertolongan darurat di jalan. Menghubungkan pengendara dengan bengkel UMKM terverifikasi di sekitarnya.
            </p>
            {/* No public hotline number yet (KONTEN), so this points to the in-app SOS instead of a made-up number. */}
            <Link to="/emergency" className="mt-5 flex items-center gap-3 rounded-xl border border-emergency/25 bg-emergency-soft p-3 transition hover:border-emergency/50" data-testid="footer-hotline">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emergency text-white shadow-sm">
                <Icon name="call" filled />
              </span>
              <span className="min-w-0">
                <span className="block font-label text-label-sm text-emergency-ink uppercase">Hotline Darurat 24/7 Nasional</span>
                <span className="block text-sm font-bold text-navy">Kirim SOS dari BengkelGo</span>
              </span>
            </Link>
          </div>
          <FooterCol
            title="Layanan Otomotif"
            links={[
              ['Cara kerja BengkelGo', '/#cara-kerja'],
              ['Booking servis terjadwal', '/workshops?tab=booking'],
              ['Cari bengkel terdekat', '/workshops?tab=cari'],
              ['Bantuan darurat (radius 5 km)', '/emergency'],
            ]}
          />
          <FooterCol
            title="Akun"
            links={[
              ['Pesanan saya', '/orders'],
              ['Masuk', '/login'],
              ['Daftar akun', '/register'],
            ]}
          />
          <FooterCol
            title="Kemitraan UMKM"
            links={[
              ['Daftar mitra bengkel', '/register/workshop'],
              ['Portal pemilik bengkel', '/login'],
            ]}
          />
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-24 font-label text-xs text-ink-3 sm:px-8 lg:px-20">
            <span className="flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="qr_code_2" className="text-success" /> Bayar langsung ke QRIS bengkel
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="verified_user" className="text-primary" /> Bengkel diverifikasi admin
              </span>
            </span>
            <span className="flex items-center gap-4">
              <Link to="/privasi" className="font-semibold text-ink-2 hover:text-primary hover:underline">
                Kebijakan Privasi
              </Link>
              <span>© {new Date().getFullYear()} BengkelGo.</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Floating SOS button (FAB): always bottom-right while scrolling. Hidden on the SOS form itself, which has its own send bar. */}
      {!portal && pathname !== '/emergency' && (
        <Link
          to="/emergency"
          data-testid="nav-sos"
          data-print-hide
          // White on #F05A28 is 3.4:1: the colour was chosen by the team, so the a11y test lists this as an accepted exception.
          data-a11y-exception="sos-brand-orange"
          aria-label="Bantuan Darurat 24 Jam"
          title="Bantuan Darurat 24 Jam"
          // Small on phones so it never covers much of the page; full size from tablet up.
          className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[950] flex h-12 w-12 animate-beacon flex-col items-center justify-center rounded-full bg-emergency font-label text-white shadow-float transition hover:-translate-y-0.5 hover:bg-emergency-dark sm:right-6 sm:bottom-6 sm:h-16 sm:w-16"
        >
          <Icon name="e911_emergency" filled className="text-[20px] sm:text-[24px]" />
          <span className="text-[9px] leading-none font-extrabold tracking-[0.06em] sm:text-[10px]">SOS</span>
        </Link>
      )}
    </div>
  );
}

/** Thin reminder under the header (scrolls away, never pinned) until the sign-up email is confirmed. */
function VerifyEmailStrip({ wide }: { wide?: boolean }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (!user?.email || user.email_verified !== false || pathname === '/verifikasi-email') return null;
  return (
    <div className="border-b border-warning/30 bg-warning-soft" data-testid="verify-email-strip">
      <div className={cx('mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 font-label text-xs text-warning-ink sm:px-8', wide ? 'lg:px-12' : 'lg:px-20')}>
        <Icon name="mark_email_unread" className="text-[18px]" />
        <span className="min-w-0 flex-1">Email Anda belum diverifikasi. Verifikasi dulu untuk bisa booking.</span>
        <Link to="/verifikasi-email" state={{ from: pathname }} className="shrink-0 font-bold underline">
          Verifikasi
        </Link>
      </div>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-4 font-label text-sm font-bold text-navy uppercase">{title}</h4>
      <ul className="space-y-2.5 text-sm text-ink-2">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- owner portal: sidebar + top bar (same pattern as admin)
const OWNER_NAV: NavItem[] = [
  { to: '/owner', label: 'Ringkasan', icon: 'space_dashboard', end: true },
  { to: '/owner/emergency', label: 'Panggilan Darurat', icon: 'e911_emergency' },
  { to: '/owner/orders', label: 'Semua Pesanan', icon: 'receipt_long' },
  { to: '/owner/quotas', label: 'Kalender & Kuota Slot', icon: 'calendar_month' },
  { to: '/owner/mechanics', label: 'Kelola Teknisi', icon: 'engineering' },
  { to: '/owner/payments', label: 'Verifikasi Pembayaran', icon: 'qr_code_scanner' },
  { to: '/owner/reviews', label: 'Ulasan', icon: 'reviews' },
  { to: '/owner/profile', label: 'Pengaturan Bengkel', icon: 'settings' },
  { to: '/owner/notifications', label: 'Notifikasi', icon: 'notifications' },
];

function OwnerShell({ user }: { user: User }) {
  const doLogout = useLogout();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const qc = useQueryClient();
  const ws = useQuery({ queryKey: ['my-workshop'], queryFn: ownerApi.me });
  // Same keys as the dashboard, so the polling is shared rather than doubled.
  const sos = useQuery({
    queryKey: ['owner-orders', 'pending-emergency'],
    queryFn: () => orderApi.workshop({ type: 'EMERGENCY', status: 'PENDING' }),
    refetchInterval: 5000,
  });
  const recent = useQuery({ queryKey: ['owner-orders', 'recent'], queryFn: () => orderApi.workshop({ limit: 100 }), refetchInterval: 30_000 });
  const sosCount = sos.data?.length ?? 0;
  const payCount = (recent.data ?? []).filter((o) => o.payment.status === 'PENDING_VERIFICATION').length;

  const w = ws.data;
  const live = !!w && w.is_open && w.accepts_emergency;
  const toggle = useMutation({
    mutationFn: (on: boolean) => ownerApi.updateProfile({ is_open: on, accepts_emergency: on }),
    onSuccess: (_d, on) => {
      void qc.invalidateQueries({ queryKey: ['my-workshop'] });
      toast(on ? 'Bengkel buka & siaga SOS' : 'Bengkel ditutup sementara', { text: on ? 'Pelanggan bisa booking dan panggilan darurat akan masuk.' : 'Booking baru dan panggilan darurat tidak akan masuk.' });
    },
    onError: (e) => toast('Gagal mengubah status', { tone: 'danger', text: errorMessage(e) }),
  });

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Menu portal mitra">
      {OWNER_NAV.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 font-label text-sm font-semibold transition',
              isActive ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:bg-surface-low hover:text-navy',
            )
          }
        >
          <Icon name={l.icon} /> <span className="flex-1">{l.label}</span>
          {l.to === '/owner/emergency' && sosCount > 0 && <span className="rounded-full bg-emergency-ink px-1.5 py-0.5 text-[10px] font-bold text-white">{sosCount} Baru</span>}
          {l.to === '/owner/payments' && payCount > 0 && <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">{payCount}</span>}
          {l.to === '/owner/notifications' && <UnreadBadge />}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r border-line bg-white p-5 lg:flex">
        <Link to="/owner">
          <Brand suffix="Mitra" sub="Owner Operational Portal" />
        </Link>
        {w && (
          <div className="rounded-lg bg-surface-low p-3">
            {w.status === 'APPROVED' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky px-1.5 py-0.5 font-label text-[10px] font-bold text-primary uppercase">
                <Icon name="verified" className="text-[14px]" /> Mitra Resmi
              </span>
            )}
            <p className="mt-1.5 truncate text-sm font-bold text-navy">{w.name}</p>
            <p className="mt-0.5 flex items-center gap-1 font-label text-xs text-ink-2">
              <Icon name="radar" className="text-[16px] text-primary" /> Radar 5 KM {w.accepts_emergency ? 'aktif' : 'nonaktif'}
            </p>
          </div>
        )}
        {nav}
        <div className="mt-auto rounded-lg bg-surface-low p-3 font-label text-xs text-ink-2">
          <p className="flex items-center gap-1.5 font-semibold text-navy">
            <span className={cx('h-2 w-2 rounded-full', sos.isError ? 'bg-emergency' : 'bg-success')} />
            {sos.isError ? 'Koneksi ke server terputus' : 'Terhubung ke server'}
          </p>
          <p className="mt-1">Panggilan darurat dicek setiap 5 detik.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[1000] flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur-xl sm:h-16 sm:px-8 lg:px-12">
          <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-sky lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? 'close' : 'menu'} />
          </button>
          <Link to="/owner" className="lg:hidden">
            <Brand suffix="Mitra" compact />
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {w && (
              <button
                type="button"
                onClick={() => toggle.mutate(!live)}
                disabled={toggle.isPending}
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-lg border px-3 font-label text-xs font-bold uppercase transition disabled:opacity-60',
                  live ? 'border-success/30 bg-success-soft text-success' : 'border-line bg-surface-low text-ink-2',
                )}
                aria-pressed={live}
                title="Ubah status buka & siaga SOS"
              >
                <span className={cx('h-2 w-2 rounded-full', live ? 'bg-success' : 'bg-ink-3')} />
                <span className="hidden sm:inline">{live ? 'Buka & Siaga SOS' : w.is_open ? 'Buka · SOS nonaktif' : 'Tutup'}</span>
                <Icon name={live ? 'toggle_on' : 'toggle_off'} className="text-[23px]" />
              </button>
            )}
            <NotificationBell role={user.role} />
            <Dropdown
              trigger={(isOpen) => (
                <span className="flex items-center gap-2">
                  <Avatar user={user} />
                  <span className="hidden text-left leading-tight lg:block">
                    <span className="block max-w-36 truncate text-sm font-bold text-navy">{user.name}</span>
                    <span className="block font-label text-[11px] text-ink-3">{ROLE_LABEL[user.role]}</span>
                  </span>
                  <span className="hidden text-ink-3 lg:block">
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
                  </span>
                </span>
              )}
            >
              <MenuItem to="/" icon="public">
                Lihat situs pelanggan
              </MenuItem>
              <MenuItem icon="logout" onClick={doLogout} danger>
                Keluar
              </MenuItem>
            </Dropdown>
          </div>
        </header>
        {open && <div className="sticky top-14 z-[999] border-b border-line bg-white p-4 shadow-lift sm:top-16 lg:hidden">{nav}</div>}
        <VerifyEmailStrip wide />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <PageFade key={pathname}>
            <Outlet />
          </PageFade>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- admin portal: sidebar + top bar
const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard Overview', icon: 'grid_view', end: true },
  { to: '/admin/workshops', label: 'Persetujuan Mitra', icon: 'verified' },
  { to: '/admin/reports', label: 'Audit Transaksi', icon: 'account_balance_wallet' },
  { to: '/admin/users', label: 'Pengguna', icon: 'manage_accounts' },
  { to: '/admin/search', label: 'Cari', icon: 'search' },
  { to: '/admin/audit', label: 'Audit Log', icon: 'policy' },
  { to: '/admin/health', label: 'Kesehatan Sistem', icon: 'monitor_heart' },
  { to: '/admin/notifications', label: 'Notifikasi', icon: 'notifications' },
];

function AdminShell({ user }: { user: User }) {
  const doLogout = useLogout();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const pending = useQuery({ queryKey: ['admin-workshops', 'PENDING'], queryFn: () => adminApi.workshops({ status: 'PENDING', limit: 100 }), refetchInterval: 60_000 });
  const pendingCount = pending.data?.length ?? 0;

  const nav = (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 font-label text-sm font-semibold transition',
              isActive ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:bg-surface-low hover:text-navy',
            )
          }
        >
          <Icon name={l.icon} /> <span className="flex-1">{l.label}</span>
          {l.to === '/admin/workshops' && pendingCount > 0 && <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>}
          {l.to === '/admin/notifications' && <UnreadBadge />}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-white p-5 lg:flex">
        <Link to="/admin">
          <Brand sub="Platform Core" />
        </Link>
        <span className="inline-flex items-center gap-1.5 self-start rounded-md bg-sky px-2 py-1 font-label text-[10px] font-bold tracking-[0.06em] text-primary uppercase">
          <Icon name="admin_panel_settings" className="text-[14px]" /> Governance HQ
        </span>
        {nav}
        <div className="mt-auto rounded-lg bg-surface-low p-3 font-label text-xs text-ink-2">
          <p className="flex items-center gap-1.5 font-semibold text-navy">
            <Icon name="shield" className="text-[16px] text-primary" /> Akses admin
          </p>
          <p className="mt-1">Semua aksi persetujuan tercatat di sisi server.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[1000] flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur-xl sm:h-16 sm:px-8 lg:px-12">
          <button className="grid h-10 w-10 place-items-center rounded-lg hover:bg-sky lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            <Icon name={open ? 'close' : 'menu'} />
          </button>
          <Link to="/admin" className="lg:hidden">
            <Brand />
          </Link>
          <span className="hidden items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 font-label text-xs font-semibold text-success md:inline-flex">
            <span className={cx('h-2 w-2 rounded-full', pending.isError ? 'bg-emergency' : 'bg-success')} />
            {pending.isError ? 'Koneksi API terputus' : 'API terhubung'}
          </span>
          <AdminSearchBox />
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell role={user.role} />
            <Dropdown
              trigger={() => (
                <span className="flex items-center gap-2">
                  <Avatar user={user} />
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-36 truncate text-sm font-bold text-navy">{user.name}</span>
                    <span className="block font-label text-[11px] text-ink-3">{ROLE_LABEL[user.role]}</span>
                  </span>
                </span>
              )}
            >
              <MenuItem to="/" icon="public">
                Lihat situs pelanggan
              </MenuItem>
              <MenuItem icon="logout" onClick={doLogout} danger>
                Keluar
              </MenuItem>
            </Dropdown>
          </div>
        </header>
        {open && <div className="sticky top-14 z-[999] border-b border-line bg-white p-4 shadow-lift sm:top-16 lg:hidden">{nav}</div>}
        <VerifyEmailStrip wide />
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <PageFade key={pathname}>
            <Outlet />
          </PageFade>
        </main>
      </div>
    </div>
  );
}

/** Route guard: requires login with one of `roles`; otherwise redirects to /login and comes back afterwards. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
