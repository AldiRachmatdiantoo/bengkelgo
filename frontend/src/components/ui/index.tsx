// Design-system primitives (Stitch "Azure Fleet & Roadside System"). Pages only use these props.
import { forwardRef, useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Tone } from '@/utils/format';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Icon (Material Symbols Outlined, loaded in index.html) ----------
/**
 * Material Symbols glyph. Its font stylesheet sets `display: inline-block` outside Tailwind's layers, which
 * beats `hidden` / `lg:block` on the icon itself: wrap the icon in a span to show/hide it responsively.
 */
export function Icon({ name, filled, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cx('material-symbols-outlined shrink-0 text-[1.25em]', filled && 'filled', className)}>
      {name}
    </span>
  );
}

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'navy';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-white shadow-soft hover:bg-primary-dark',
  secondary: 'border-[1.5px] border-primary bg-white text-primary hover:bg-sky',
  danger: 'bg-emergency text-white shadow-soft hover:bg-emergency-dark',
  success: 'bg-success text-white shadow-soft hover:brightness-95',
  ghost: 'text-navy hover:bg-sky',
  navy: 'bg-navy text-white shadow-soft hover:bg-navy/90',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: string }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-label font-semibold tracking-[0.01em] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        size === 'sm' ? 'h-9 px-4 text-xs' : size === 'lg' ? 'h-14 px-7 text-base' : 'h-12 px-5 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner small /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

// ---------- Form fields ----------
function FieldShell({ label, hint, error, id, icon, children }: { label?: string; hint?: string; error?: string; id: string; icon?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="font-label text-xs font-semibold text-navy">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <Icon name={icon} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-primary" />}
        {children}
      </div>
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
      {error && <p className="text-xs text-emergency-ink">{error}</p>}
    </div>
  );
}

const fieldClass =
  'w-full rounded-lg border border-line-strong bg-white px-3.5 text-xs text-navy placeholder:text-ink-3 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:bg-canvas';

type FieldProps = { label?: string; hint?: string; error?: string; icon?: string };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(function Input({ label, hint, error, icon, id, className, ...rest }, ref) {
  const auto = useId();
  const isFile = rest.type === 'file';
  return (
    <FieldShell label={label} hint={hint} error={error} icon={icon} id={id ?? auto}>
      <input
        ref={ref}
        id={id ?? auto}
        {...rest}
        className={cx(
          fieldClass,
          isFile ? 'py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-sky file:px-4 file:py-1.5 file:font-label file:text-sm file:font-semibold file:text-primary' : 'h-12',
          icon && 'pl-11',
          className,
        )}
      />
    </FieldShell>
  );
});

export function Select({ label, hint, error, icon, id, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const auto = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} icon={icon} id={id ?? auto}>
      <select id={id ?? auto} {...rest} className={cx(fieldClass, 'h-12 appearance-none pr-10', icon && 'pl-11', className)}>
        {children}
      </select>
      <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3" />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, id, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const auto = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id ?? auto}>
      <textarea id={id ?? auto} rows={3} {...rest} className={cx(fieldClass, 'py-3', className)} />
    </FieldShell>
  );
}

/** Pill toggle group (vehicle type, filters, tabs). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  nowrap,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  /** Keep one row (put it in an overflow-x-auto wrapper) instead of wrapping on narrow screens. */
  nowrap?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex gap-1 rounded-lg border border-line bg-canvas p-1', nowrap ? 'flex-nowrap' : 'flex-wrap')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-md font-label font-semibold whitespace-nowrap transition',
            size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
            value === o.value ? 'bg-white text-primary shadow-soft' : 'text-ink-2 hover:text-navy',
          )}
        >
          {o.icon && <Icon name={o.icon} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Surfaces & feedback ----------
export function Card({
  title,
  icon,
  subtitle,
  actions,
  children,
  className,
  accent,
}: {
  title?: ReactNode;
  icon?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 3px top accent bar (recommended / emergency surfaces). */
  accent?: 'primary' | 'emergency' | 'success';
}) {
  return (
    <section className={cx('relative overflow-hidden rounded-xl border border-line bg-card p-5 shadow-sm sm:p-6', className)}>
      {accent && <span className={cx('absolute inset-x-0 top-0 h-[3px]', accent === 'primary' ? 'bg-primary' : accent === 'emergency' ? 'bg-emergency' : 'bg-success')} />}
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sky text-primary">
                <Icon name={icon} />
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-lg leading-snug font-bold text-navy">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-subtitle text-ink-2">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const TONES: Record<Tone, { chip: string; dot: string; alert: string; icon: string }> = {
  neutral: { chip: 'bg-canvas text-ink-2 border border-line', dot: 'bg-ink-3', alert: 'bg-canvas text-ink-2 border-line', icon: 'info' },
  info: { chip: 'bg-sky text-primary-dark', dot: 'bg-primary', alert: 'bg-sky text-navy border-primary/20', icon: 'info' },
  success: { chip: 'bg-success-soft text-success', dot: 'bg-success', alert: 'bg-success-soft text-[#006b35] border-success/20', icon: 'check_circle' },
  warning: { chip: 'bg-warning-soft text-warning-ink', dot: 'bg-warning', alert: 'bg-warning-soft text-warning-ink border-warning/30', icon: 'schedule' },
  danger: { chip: 'bg-emergency-soft text-emergency-ink', dot: 'bg-emergency', alert: 'bg-emergency-soft text-emergency-ink border-emergency/20', icon: 'error' },
};

/** Status chip: uppercase Inter label with a dot indicator. */
export function Badge({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 rounded-md px-2 font-label text-[11px] font-bold tracking-[0.04em] whitespace-nowrap uppercase', TONES[tone].chip)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', TONES[tone].dot)} />}
      {children}
    </span>
  );
}

export function Alert({ tone = 'info', children, icon }: { tone?: Tone; children: ReactNode; icon?: string }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', TONES[tone].alert)}>
      <Icon name={icon ?? TONES[tone].icon} className="mt-px" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Memuat"
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', small ? 'h-4 w-4' : 'h-6 w-6 text-primary')}
    />
  );
}

export function Loading({ text = 'Memuat…' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-ink-2">
      <Spinner /> {text}
    </div>
  );
}

export function EmptyState({ children, icon = 'inbox', action }: { children: ReactNode; icon?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong bg-white/60 px-6 py-10 text-center text-ink-2">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sky text-primary">
        <Icon name={icon} />
      </span>
      <div className="max-w-md text-sm">{children}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 font-label text-xs font-bold tracking-[0.06em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-navy sm:text-[24px]">{title}</h1>
        {subtitle && <div className="mt-1.5 text-subtitle text-ink-2">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-label text-sm font-semibold text-navy" role="img" aria-label={value > 0 ? `Rating ${value.toFixed(1)} dari 5` : 'Belum ada rating'}>
      <Icon name="star" filled className="text-[18px] text-warning" />
      {value > 0 ? value.toFixed(1) : 'Baru'}
      {count != null && <span className="font-normal text-ink-3">({count})</span>}
    </span>
  );
}

/** KPI tile (Stitch owner/admin KPIs). */
export function StatCard({
  label,
  value,
  icon,
  tone = 'info',
  hint,
  aside,
  progress,
}: {
  label: string;
  value: ReactNode;
  icon: string;
  tone?: Tone;
  hint?: ReactNode;
  /** Small inline note next to the value (e.g. "Selesai", "Sisa 4 slot"). */
  aside?: ReactNode;
  /** 0–100: thin bar at the bottom. */
  progress?: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-label text-xs font-semibold tracking-[0.02em] text-ink-2 uppercase">{label}</p>
        <span className={cx('grid h-9 w-9 place-items-center rounded-lg', TONES[tone].chip)}>
          <Icon name={icon} />
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-[22px] leading-none font-extrabold tracking-[-0.02em] text-navy">
        {value}
        {aside && <span className="font-label text-xs font-semibold tracking-normal text-ink-2">{aside}</span>}
      </p>
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
      {progress != null && <ProgressBar value={progress} tone={tone} label={label} />}
    </div>
  );
}

const BAR: Record<Tone, string> = { neutral: 'bg-ink-3', info: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-emergency' };
export function ProgressBar({ value, tone = 'info', label }: { value: number; tone?: Tone; /** what the bar measures, for screen readers */ label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-low" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span className={cx('block h-full rounded-full transition-all', BAR[tone])} style={{ width: `${v}%` }} />
    </span>
  );
}

/** Key/value line used in summaries and receipts. */
export function InfoRow({ icon, label, children }: { icon?: string; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-canvas text-primary">
          <Icon name={icon} />
        </span>
      )}
      <div className="min-w-0">
        <p className="font-label text-[11px] font-bold tracking-[0.04em] text-ink-3 uppercase">{label}</p>
        <div className="mt-0.5 font-semibold break-words text-navy">{children}</div>
      </div>
    </div>
  );
}

/** Horizontal step bar with connectors (Stitch booking header). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto sm:gap-3">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className={cx('flex min-w-0 items-center gap-2 sm:gap-3', i < steps.length - 1 && 'flex-1')}>
            <span
              className={cx(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full font-label text-sm font-bold',
                done ? 'bg-success text-white' : active ? 'bg-primary text-white ring-4 ring-primary-fixed' : 'border border-line-strong bg-white text-ink-3',
              )}
            >
              {done ? <Icon name="check" /> : i + 1}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className={cx('block font-label text-[10px] font-bold tracking-[0.06em] uppercase', active ? 'text-primary' : 'text-ink-3')}>
                Langkah {i + 1}
                {active && ' • Aktif'}
              </span>
              <span className={cx('block truncate text-sm font-semibold', done || active ? 'text-navy' : 'text-ink-3')}>{s}</span>
            </span>
            {i < steps.length - 1 && <span className={cx('h-0.5 min-w-4 flex-1 rounded-full', done ? 'bg-success' : 'bg-line')} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Responsive table. */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-canvas">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-label text-[11px] font-bold tracking-[0.04em] whitespace-nowrap text-ink-2 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cx('px-4 py-3 align-middle', className)}>{children}</td>;

/** Section title used on the landing page (eyebrow + headline + optional action). */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  center,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={cx('mb-6 flex gap-4', center ? 'flex-col items-center text-center' : 'flex-wrap items-end justify-between')}>
      <div className={cx('min-w-0', center && 'mx-auto max-w-2xl')}>
        {eyebrow && <p className="mb-1 font-label text-label-sm text-primary uppercase">{eyebrow}</p>}
        <h2 className="text-[20px] leading-tight font-bold tracking-[-0.015em] text-navy sm:text-headline-lg">{title}</h2>
        {subtitle && <p className="mt-1 text-subtitle text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  icon,
  tone = 'info',
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: string;
  tone?: Tone;
  children: ReactNode;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
    <m.div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-navy/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <m.div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-float"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="flex items-start gap-3">
          {icon && (
            <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', TONES[tone].chip)}>
              <Icon name={icon} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-headline-sm text-navy">{title}</h3>
            <div className="mt-1 text-sm text-ink-2">{children}</div>
          </div>
        </div>
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>}
      </m.div>
    </m.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Toast (fire-and-forget success/error notices) ----------
type ToastItem = { id: number; tone: Tone; title: string; text?: string };
let toastSeq = 0;
let toasts: ToastItem[] = [];
const toastListeners = new Set<(t: ToastItem[]) => void>();
const emitToasts = () => toastListeners.forEach((l) => l(toasts));

export function toast(title: string, opts: { tone?: Tone; text?: string } = {}) {
  const item: ToastItem = { id: ++toastSeq, tone: opts.tone ?? 'success', title, text: opts.text };
  toasts = [...toasts, item];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== item.id);
    emitToasts();
  }, 4000);
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts);
  useEffect(() => {
    toastListeners.add(setItems);
    return () => {
      toastListeners.delete(setItems);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[3000] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={cx('pointer-events-auto flex animate-toast items-start gap-3 rounded-xl border bg-white p-4 shadow-lift', t.tone === 'danger' ? 'border-emergency/30' : 'border-success/30')}
        >
          <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full', TONES[t.tone].chip)}>
            <Icon name={TONES[t.tone].icon} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-navy">{t.title}</p>
            {t.text && <p className="text-xs text-ink-2">{t.text}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Copy to clipboard ----------
export function CopyButton({ text, label = 'Salin', className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className={cx('inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 font-label text-xs font-semibold text-navy hover:bg-sky', className)}
      aria-label={`${label}: ${text}`}
    >
      <Icon name={done ? 'check' : 'content_copy'} className="text-[16px]" /> {done ? 'Tersalin' : label}
    </button>
  );
}

// ---------- QR code (rendered locally from a string, e.g. the order number) ----------
export function QrCode({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    // The QR library is only needed on order pages, so it is downloaded the first time a code is shown.
    import('qrcode')
      .then((QRCode) => QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#192557', light: '#FFFFFF' } }))
      .then((out) => {
        if (alive) setSvg(out);
      })
      .catch(() => {
        if (alive) setSvg('');
      });
    return () => {
      alive = false;
    };
  }, [value]);
  return <div role="img" aria-label={`Kode QR ${value}`} className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
