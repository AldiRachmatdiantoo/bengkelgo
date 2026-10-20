// In-app notifications from the server (GET /notifications). The API creates them in the same transaction as
// the action they describe, so they are complete, shared across devices and survive the app being closed.
// This provider polls the list, maps each server type to a tone/icon, and rings for urgent ones.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/api/endpoints';
import type { AppNotification as ServerNotification, User } from '@/services/api/types';
import { toast } from '@/components/ui';
import type { Tone } from '@/utils/format';

export type AppNotification = {
  id: string;
  at: string;
  tone: Tone;
  icon: string;
  title: string;
  text?: string;
  to?: string;
  read: boolean;
  /** Urgent ones (new SOS, payment proof, refund) also ring and use a browser notification. */
  urgent?: boolean;
};

/** Look of each server notification type; unknown types fall back to a neutral bell. */
const LOOK: Record<string, { tone: Tone; icon: string; urgent?: boolean }> = {
  SOS_INCOMING: { tone: 'danger', icon: 'e911_emergency', urgent: true },
  SOS_ACCEPTED: { tone: 'success', icon: 'two_wheeler', urgent: true },
  SOS_REROUTED: { tone: 'warning', icon: 'alt_route' },
  SOS_UNASSIGNED: { tone: 'danger', icon: 'error' },
  PRICE_UPDATED: { tone: 'info', icon: 'sell' },
  BOOKING_NEW: { tone: 'info', icon: 'event_available' },
  BOOKING_PROMOTED: { tone: 'success', icon: 'upgrade' },
  BOOKING_RESCHEDULED: { tone: 'info', icon: 'event_repeat' },
  ORDER_IN_PROGRESS: { tone: 'info', icon: 'build' },
  ORDER_COMPLETED: { tone: 'success', icon: 'task_alt' },
  ORDER_CANCELLED: { tone: 'neutral', icon: 'event_busy' },
  PAYMENT_PROOF: { tone: 'warning', icon: 'receipt_long', urgent: true },
  PAYMENT_VERIFIED: { tone: 'success', icon: 'verified' },
  PAYMENT_REJECTED: { tone: 'danger', icon: 'replay', urgent: true },
  PAYMENT_REFUNDED: { tone: 'info', icon: 'currency_exchange', urgent: true },
  REVIEW_NEW: { tone: 'info', icon: 'reviews' },
  REVIEW_REPLY: { tone: 'info', icon: 'forum' },
  WORKSHOP_REGISTERED: { tone: 'warning', icon: 'storefront' },
  WORKSHOP_APPROVED: { tone: 'success', icon: 'verified' },
  WORKSHOP_REJECTED: { tone: 'danger', icon: 'block' },
  WORKSHOP_SUSPENDED: { tone: 'danger', icon: 'block' },
};

export function fromServer(n: ServerNotification): AppNotification {
  const look = LOOK[n.type] ?? { tone: 'neutral' as Tone, icon: 'notifications' };
  return { id: n.id, at: n.created_at, tone: look.tone, icon: look.icon, urgent: look.urgent, title: n.title, text: n.body ?? undefined, to: n.link ?? undefined, read: !!n.read_at };
}

/** Short two-tone beep (no audio file). Browsers may block it until the user has interacted with the page. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 660].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    // no audio available
  }
}

type Ctx = {
  items: AppNotification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<void>;
};
const NotificationContext = createContext<Ctx | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
/** Same as useNotifications, but null when nobody is logged in. */
export const useOptionalNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) return <>{children}</>;
  return (
    <UserNotifications key={user.id} user={user}>
      {children}
    </UserNotifications>
  );
}

const QUERY_KEY = ['notifications'] as const;

function UserNotifications({ user, children }: { user: User; children: ReactNode }) {
  const qc = useQueryClient();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  // Owners must answer an SOS within 2 minutes, so they poll faster.
  const list = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => notificationApi.list({ limit: 100 }),
    refetchInterval: user.role === 'WORKSHOP_OWNER' ? 5000 : 15_000,
  });

  // Announce notifications that appeared since the previous poll (the first load is silent).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!list.data) return;
    const items = list.data.items.map(fromServer);
    if (!seen.current) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !seen.current!.has(n.id) && !n.read);
    for (const n of items) seen.current.add(n.id);
    for (const n of fresh.reverse()) {
      if (document.visibilityState === 'visible') toast(n.title, { tone: n.tone === 'neutral' || n.tone === 'info' ? 'success' : n.tone, text: n.text });
      if (!n.urgent) continue;
      if (user.role === 'WORKSHOP_OWNER') beep();
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        try {
          new Notification(n.title, { body: n.text, tag: n.id });
        } catch {
          // some mobile browsers only allow notifications from a service worker
        }
      }
    }
  }, [list.data, user.role]);

  const read = useMutation({
    mutationFn: (ids?: string[]) => notificationApi.markRead(ids),
    // Optimistic: the bell clears at once; the next poll confirms.
    onMutate: (ids) => {
      qc.setQueryData<{ items: ServerNotification[]; unread: number }>(QUERY_KEY, (old) => {
        if (!old) return old;
        const now = new Date().toISOString();
        const items = old.items.map((n) => (!n.read_at && (!ids || ids.includes(n.id)) ? { ...n, read_at: now } : n));
        return { items, unread: ids ? Math.max(0, old.unread - old.items.filter((n) => !n.read_at && ids.includes(n.id)).length) : 0 };
      });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const items = useMemo(() => (list.data?.items ?? []).map(fromServer), [list.data]);
  const unread = list.data?.unread ?? 0;

  // Unread count in the tab title, so it is visible from other tabs.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s/, '');
    document.title = unread ? `(${unread}) ${base}` : base;
  }, [unread]);

  const { mutate } = read;
  const value = useMemo<Ctx>(
    () => ({
      items,
      unread,
      markRead: (id) => mutate([id]),
      markAllRead: () => mutate(undefined),
      permission,
      requestPermission: async () => {
        if (!('Notification' in window)) return;
        setPermission(await Notification.requestPermission());
      },
    }),
    [items, unread, permission, mutate],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
