// Figma screen kit (design/figma/SPEC.md). Mobile booking screens: back button + brand, 32px title, 19px
// section titles, 64px radio cards, 44px chips, and a bottom bar with the amount on the left and the 52px lime
// action on the right.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cx, Icon, Spinner } from './index';

/** Chevron from the Figma back button (icons/back.svg). */
function BackChevron() {
  return (
    <svg aria-hidden width="10" height="18" viewBox="0 0 10 18" fill="none">
      <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Car outline from the Figma vehicle card (icons/car-outline.svg). */
export function CarGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} width="32" height="23" viewBox="0 0 32 23" fill="none">
      <path d="M31 9L25 1H6L1 9V17H31V9ZM1 9H31M5 18V22M27 18V22" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const backClass =
  'grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line bg-card text-primary transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Back button and, on phones (where flow screens hide the site header), the brand. */
export function ScreenTopBar({ back, onBack, backLabel = 'Kembali', action }: { back?: string; onBack?: () => void; backLabel?: string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex items-center gap-3.5" data-print-hide>
      {back ? (
        <Link to={back} aria-label={backLabel} className={backClass}>
          <BackChevron />
        </Link>
      ) : (
        <button type="button" aria-label={backLabel} className={backClass} onClick={onBack ?? (() => navigate(-1))}>
          <BackChevron />
        </button>
      )}
      <Link to="/" className="text-xl font-bold text-primary md:hidden">
        BengkelGo
      </Link>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

/** Screen title block: the top bar, then the 32px title and the 15px subtitle. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  onBack,
  backLabel,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where the back button goes. Without it (and without onBack) it goes one step back in history. */
  back?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6">
      <ScreenTopBar back={back} onBack={onBack} backLabel={backLabel} action={action} />
      <h1 className="text-display break-words text-ink">{title}</h1>
      {subtitle && <div className="mt-1.5 text-subtitle text-ink-2">{subtitle}</div>}
    </div>
  );
}

/** 19px section title with an optional note on the right (e.g. the month above the date chips). */
export function ScreenSection({
  title,
  aside,
  children,
  className,
  id,
}: {
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cx('mt-6 first:mt-0', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">{title}</h2>
        {aside && <span className="shrink-0 text-sm text-ink-2">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Bar pinned to the bottom of the screen: caption + amount on the left and the main action on the right, or the
 * action alone at full width. Pages that use it leave room at the bottom with `pb-36`.
 */
export function BottomBar({ caption, amount, children }: { caption?: ReactNode; amount?: ReactNode; children: ReactNode }) {
  return (
    <div data-print-hide className="fixed inset-x-0 bottom-0 z-[900] border-t border-line bg-surface-low pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl items-center gap-4 px-[22px] py-5">
        {amount != null && (
          <div className="min-w-0 flex-1">
            {caption && <p className="truncate text-xs text-ink-2">{caption}</p>}
            <p className="truncate text-2xl font-bold text-ink">{amount}</p>
          </div>
        )}
        <div className={cx('flex gap-2', amount != null ? 'w-[55%] max-w-[260px] shrink-0' : 'w-full')}>{children}</div>
      </div>
    </div>
  );
}

const actionBase =
  'inline-flex h-13 w-full min-w-0 items-center justify-center gap-2 rounded-lg px-4 text-subtitle font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const actionVariant = {
  primary: 'bg-primary text-on-primary hover:bg-primary-dark',
  secondary: 'border border-line bg-card text-ink hover:bg-surface',
} as const;

/** The 52px action used in the bottom bar (button). */
export function ScreenAction({
  children,
  className,
  variant = 'primary',
  loading,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof actionVariant; loading?: boolean }) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} className={cx(actionBase, actionVariant[variant], className)}>
      {loading && <Spinner small />}
      <span className="truncate">{children}</span>
    </button>
  );
}

/** The 52px action as a router link. */
export function ScreenLink({
  to,
  children,
  className,
  variant = 'primary',
  ...rest
}: {
  to: string;
  children: ReactNode;
  className?: string;
  variant?: keyof typeof actionVariant;
  'data-testid'?: string;
}) {
  return (
    <Link to={to} {...rest} className={cx(actionBase, actionVariant[variant], className)}>
      <span className="truncate">{children}</span>
    </Link>
  );
}

/** Radio dot from the option cards: 18px ring, 6px dot when chosen. */
export function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span aria-hidden className={cx('grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[3px]', checked ? 'border-primary' : 'border-ink-2')}>
      {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
    </span>
  );
}

/** Radio card (64px): title, a muted line under it, an optional value on the right (price). */
export function OptionCard({
  checked,
  onSelect,
  title,
  description,
  aside,
  disabled,
  className,
  ...rest
}: {
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      {...rest}
      className={cx(
        'flex min-h-16 w-full items-center gap-3.5 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-45',
        checked ? 'border-primary bg-surface' : 'border-line bg-card hover:border-line-strong',
        className,
      )}
    >
      <RadioDot checked={checked} />
      <span className="min-w-0 flex-1">
        <span className="block text-subtitle leading-snug font-bold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-sm leading-snug text-ink-2">{description}</span>}
      </span>
      {aside && <span className="shrink-0 text-sm font-bold text-primary">{aside}</span>}
    </button>
  );
}

/** 44px chip for dates and times; lime when chosen. */
export function ChoiceChip({
  checked,
  onSelect,
  children,
  disabled,
  muted,
  className,
  ...rest
}: {
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Still selectable but marked, e.g. a full slot that only joins the waitlist. */
  muted?: boolean;
  className?: string;
  'data-testid'?: string;
  'aria-label'?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      {...rest}
      className={cx(
        'inline-flex min-h-11 min-w-0 flex-col items-center justify-center rounded-md border px-2 py-1 text-sm leading-tight font-bold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:border-transparent disabled:bg-surface-low disabled:text-ink-3',
        checked
          ? 'border-primary bg-primary text-on-primary'
          : muted
            ? 'border-warning-line bg-warning-soft text-warning-ink'
            : 'border-line bg-card text-ink hover:border-line-strong',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Vehicle card (72px): icon tile, name, plate, and an action on the right ("Ubah"). */
export function VehicleCard({
  name,
  plate,
  action,
  icon,
  className,
}: {
  name: ReactNode;
  plate?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex min-h-[72px] items-center gap-3.5 rounded-[13px] border border-line bg-card px-3 py-3', className)}>
      <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg bg-surface-high text-primary">{icon ?? <CarGlyph />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-subtitle font-bold text-ink">{name}</span>
        {plate && <span className="block truncate text-xs text-ink-2">{plate}</span>}
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}

type Row = readonly [ReactNode, ReactNode];

/** Label/value rows in a bordered card ("Ringkasan booking", "Rincian biaya"). */
export function SummaryCard({ rows, className }: { rows: (Row | false | null | undefined)[]; className?: string }) {
  const shown = rows.filter((r): r is Row => Boolean(r));
  return (
    <dl className={cx('flex flex-col gap-3.5 rounded-xl border border-line bg-card px-4 py-4', className)}>
      {shown.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-sm text-ink-2">{k}</dt>
          <dd className="min-w-0 text-right text-sm font-bold break-words text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Tinted 12px box: info (green), success, warning (amber). */
export function NoteBox({
  tone = 'info',
  title,
  children,
  aside,
  icon,
  className,
}: {
  tone?: 'info' | 'success' | 'warning';
  title: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  icon?: string;
  className?: string;
}) {
  const tones = {
    info: 'border-transparent bg-sky text-primary',
    success: 'border-transparent bg-success-soft text-primary',
    warning: 'border-warning-line bg-warning-soft text-warning-ink',
  } as const;
  return (
    <div className={cx('flex items-start gap-3 rounded-lg border px-4 py-3.5', tones[tone], className)}>
      {icon && <Icon name={icon} filled className="mt-px text-[22px]" />}
      <div className="min-w-0 flex-1">
        <p className="text-subtitle font-bold">{title}</p>
        {children && <div className="mt-0.5 text-sm text-ink-2">{children}</div>}
      </div>
      {aside && <div className="shrink-0 text-subtitle font-bold">{aside}</div>}
    </div>
  );
}

/** Mountain + workshop line art from the Figma workshop card (icons/workshop-art.svg), used when there is no photo. */
export function WorkshopArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={cx('bg-art', className)} viewBox="0 0 394 102" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M22 94L111 25L181 80L259 33L362 89" stroke="#3E5847" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M92 70L187 22L263 57.8L289 70M263 57.8V93H114V59M147 91V61H233V91M162 70H217M162 79H217"
        stroke="#BAF48F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
