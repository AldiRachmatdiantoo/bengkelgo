// Step-by-step flows (rencana_alur_bertahap.md): one question per screen, "Langkah n dari m", Kembali/Lanjut in
// the bottom bar, the active step in the URL (?langkah=) so the phone's back button goes one step back, and a
// per-tab draft so a refresh or a detour to /login keeps what was typed.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { cx } from './index';

export type StepDef<T extends string> = { id: T; label: string; skip?: boolean };

/**
 * Active step from `?langkah=<id>`. Skipped steps are left out of the count and of Kembali/Lanjut. An unknown or
 * skipped id falls back to the first step.
 */
export function useStepFlow<T extends string>(all: StepDef<T>[]) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const steps = all.filter((s) => !s.skip);
  const raw = params.get('langkah');
  const index = Math.max(
    0,
    steps.findIndex((s) => s.id === raw),
  );
  const active = steps[index];

  const go = useCallback(
    (id: T, replace = false) => {
      // The flow already left this page (e.g. sent, then navigated away): never write ?langkah= onto the next page.
      if (window.location.pathname !== pathname) return;
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.set('langkah', id);
          return next;
        },
        { replace },
      );
    },
    [setParams, pathname],
  );

  return {
    steps,
    active,
    index,
    total: steps.length,
    isFirst: index === 0,
    isLast: index === steps.length - 1,
    go,
    next: () => steps[index + 1] && go(steps[index + 1].id),
    back: () => steps[index - 1] && go(steps[index - 1].id),
  };
}

/** State kept in sessionStorage under `key`; `clear()` after a successful send. */
export function useStepDraft<D extends object>(key: string, initial: D) {
  const [draft, setDraft] = useState<D>(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? { ...initial, ...(JSON.parse(saved) as Partial<D>) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // storage blocked: the flow still works, it just does not survive a refresh
    }
  }, [key, draft]);
  const update = useCallback((patch: Partial<D>) => setDraft((d) => ({ ...d, ...patch })), []);
  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // nothing to clear
    }
  }, [key]);
  return [draft, update, clear] as const;
}

/** "Langkah n dari m" with a segmented bar. */
export function StepProgress({ index, total, label, tone = 'primary' }: { index: number; total: number; label: string; tone?: 'primary' | 'emergency' }) {
  return (
    <div className="mb-5" data-testid="step-progress">
      <p className="text-sm text-ink-2">
        Langkah {index + 1} dari {total} <span className="text-ink-3">·</span> <span className="font-semibold text-ink">{label}</span>
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full', i <= index ? (tone === 'emergency' ? 'bg-emergency' : 'bg-primary') : 'bg-surface-high')} />
        ))}
      </div>
    </div>
  );
}

/**
 * Step heading. When the step changes (not on first load) focus moves here, so keyboard and screen reader users
 * start at the new question; the polite live region announces "Langkah n dari m: judul".
 */
export function StepHeading({ stepKey, index, total, title, description }: { stepKey: string; index: number; total: number; title: ReactNode; description?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [stepKey]);
  return (
    <div className="mb-5">
      <h2 ref={ref} tabIndex={-1} className="text-2xl font-bold text-ink outline-none" data-testid="step-title">
        {title}
      </h2>
      {description && <div className="mt-1.5 text-sm text-ink-2">{description}</div>}
      <p className="sr-only" aria-live="polite">
        Langkah {index + 1} dari {total}: {typeof title === 'string' ? title : ''}
      </p>
    </div>
  );
}

/** One row of the review step: label, value, and "Ubah" that jumps back to the step. */
export function ReviewRow({ label, children, onEdit, testId }: { label: string; children: ReactNode; onEdit?: () => void; testId?: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-line py-3.5 last:border-0" data-testid={testId}>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-2">{label}</p>
        <div className="mt-0.5 text-sm font-semibold break-words text-ink">{children}</div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Ubah ${label.toLowerCase()}`}
          className="-my-1 inline-flex h-11 shrink-0 items-center rounded-lg px-3 text-sm font-bold text-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
        >
          Ubah
        </button>
      )}
    </div>
  );
}
