import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Radar, { type RadarMode } from './radar';
import { cx, Icon } from './index';

export type ScrollRadarSection = {
  id: string;
  badge: string;
  title: string;
  subtitle?: string;
  description: ReactNode;
  align?: 'left' | 'center' | 'right';
  features?: { icon: string; title: string; description: string }[];
  actions?: { label: string; to: string; variant: 'primary' | 'secondary' | 'danger'; icon?: string; testId?: string }[];
};

/** Where the radar sits and how it looks for each section: % of the block's width and of the screen height. */
export type RadarPosition = { top: number; left: number; scale: number; mode: RadarMode };

const DEFAULT_POSITIONS: RadarPosition[] = [
  { top: 50, left: 78, scale: 1.3, mode: 'scan' },
  { top: 50, left: 20, scale: 1.1, mode: 'workshops' },
  { top: 42, left: 82, scale: 1.05, mode: 'sos' },
  { top: 50, left: 50, scale: 1.9, mode: 'dim' },
];

const ACTION = {
  primary: 'bg-primary text-on-primary hover:bg-primary-dark',
  secondary: 'border border-line bg-card text-ink hover:border-primary/60 [&_.material-symbols-outlined]:text-primary',
  danger: 'bg-emergency text-white hover:brightness-110',
};

/**
 * Landing block where a radar of nearby workshops glides to a new spot as each section reaches the middle of the
 * screen, with a dot nav on the right (sm and up). The radar stays inside this block (sticky,
 * not fixed), so the sections after it scroll normally.
 */
export function ScrollRadar({ sections, positions = DEFAULT_POSITIONS, className }: { sections: ScrollRadarSection[]; positions?: RadarPosition[]; className?: string }) {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const update = useCallback(() => {
    const mid = window.innerHeight / 2;
    let best = 0;
    let bestDistance = Infinity;
    sectionRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [update]);

  // The dot nav is fixed to the screen, so hide it once the block has scrolled away.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '-40% 0px -40% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pos = positions[Math.min(active, positions.length - 1)];

  return (
    <div ref={rootRef} className={cx('relative overflow-clip', className)}>
      {/* radar layer: sticks to the screen while this block scrolls past, takes no height of its own */}
      <div aria-hidden className="pointer-events-none sticky top-0 z-0 -mb-[100svh] h-[100svh] overflow-hidden">
        <div
          className="absolute transition-all duration-[1400ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: `translate(-50%, -50%) scale(${pos.scale})` }}
        >
          <Radar mode={pos.mode} className={cx('transition-opacity duration-700 max-sm:opacity-30', pos.mode === 'dim' ? 'opacity-35' : 'opacity-90')} />
        </div>
      </div>

      <nav
        aria-label="Bagian beranda"
        className={cx('fixed top-1/2 right-2 z-40 hidden -translate-y-1/2 flex-col transition-opacity sm:flex lg:right-6', inView ? 'opacity-100' : 'pointer-events-none opacity-0')}
      >
        <span aria-hidden className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
        {sections.map((s, i) => (
          <span key={s.id} className="relative flex items-center">
            {active === i && (
              <span key={`label-${active}`} aria-hidden className="animate-label-out absolute right-11 rounded-md border border-line bg-card px-3 py-1.5 text-xs font-bold whitespace-nowrap text-ink">
                {s.badge}
              </span>
            )}
            <button
              type="button"
              aria-label={`Ke bagian ${s.badge}`}
              aria-current={active === i ? 'true' : undefined}
              onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="group relative grid h-11 w-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span
                className={cx(
                  'block h-3 w-3 rounded-full border-2 transition',
                  active === i ? 'scale-110 border-primary bg-primary' : 'border-ink-2/50 bg-canvas group-hover:border-primary',
                )}
              />
            </button>
          </span>
        ))}
      </nav>

      {sections.map((s, i) => {
        const Heading = i === 0 ? 'h1' : 'h2';
        const align = s.align ?? 'left';
        return (
          <section
            key={s.id}
            id={s.id}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            className={cx(
              'relative z-10 flex min-h-[70svh] flex-col justify-center py-10 sm:min-h-[80svh]',
              align === 'center' && 'items-center text-center',
              align === 'right' && 'items-end text-right',
            )}
          >
            <div className={cx('w-full max-w-xl', align === 'center' && 'max-w-2xl')}>
              <p className="text-sm font-bold text-primary">{s.badge}</p>
              <Heading className={cx('mt-2 font-bold tracking-tight text-ink', i === 0 ? 'text-3xl leading-[1.15] sm:text-[44px]' : 'text-2xl leading-tight sm:text-[34px]')}>
                {s.title}
                {s.subtitle && <span className="mt-1.5 block text-[0.6em] font-semibold text-ink-2">{s.subtitle}</span>}
              </Heading>
              <div className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-subtitle">{s.description}</div>

              {s.features && (
                <ul className="mt-6 grid gap-3 text-left">
                  {s.features.map((f) => (
                    <li key={f.title} className="flex items-start gap-3 rounded-2xl border border-line bg-card/80 p-4 backdrop-blur-sm">
                      <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-lg bg-surface-high text-primary">
                        <Icon name={f.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-ink">{f.title}</span>
                        <span className="mt-0.5 block text-sm text-ink-2">{f.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {s.actions && (
                <div className={cx('mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap', align === 'center' && 'sm:justify-center', align === 'right' && 'sm:justify-end')}>
                  {s.actions.map((a) => (
                    <Link
                      key={a.label}
                      to={a.to}
                      data-testid={a.testId}
                      className={cx('inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition', ACTION[a.variant])}
                    >
                      {a.icon && <Icon name={a.icon} className="text-[20px]" />}
                      {a.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
