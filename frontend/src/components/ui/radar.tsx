import { cx, Icon } from './index';

export type RadarMode = 'scan' | 'workshops' | 'sos' | 'dim';

/** Workshop pins: angle clockwise from 12 o'clock, distance as a share of the radius. */
const PINS = [
  { angle: 38, r: 0.62 },
  { angle: 105, r: 0.38 },
  { angle: 150, r: 0.78 },
  { angle: 212, r: 0.55 },
  { angle: 268, r: 0.3 },
  { angle: 318, r: 0.72 },
];

const SWEEP_SECONDS = 4;

/**
 * Radar of nearby workshops, drawn in the map's dark green: rings, a rotating sweep and pins that
 * light up as the sweep passes them. `workshops` turns the pins into workshop badges, `sos` paints
 * the sweep orange and marks the 5 km ring. CSS only; the sweep stops under reduced motion.
 */
export default function Radar({ mode = 'scan', size = 280, className }: { mode?: RadarMode; size?: number; className?: string }) {
  const sos = mode === 'sos';
  const accent = sos ? 'var(--color-emergency)' : 'var(--color-primary)';
  return (
    <div
      aria-hidden
      className={cx('relative rounded-full border bg-[#172219] transition-colors duration-700', sos ? 'border-emergency/50' : 'border-primary/30', className)}
      style={{ width: size, height: size }}
    >
      {/* rings and cross hairs */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <span
            key={f}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20"
            style={{ width: `${f * 100}%`, height: `${f * 100}%` }}
          />
        ))}
        <span className="absolute inset-x-0 top-1/2 h-px bg-primary/15" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-primary/15" />
        {/* sweep: leading edge at the top of the cone, fading trail behind it */}
        <span
          className="radar-sweep absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(from 0deg, transparent 0deg 290deg, color-mix(in srgb, ${accent} 45%, transparent) 360deg)` }}
        />
        <span className="absolute inset-0 rounded-full shadow-[inset_0_0_40px_rgb(0_0_0/0.6)]" />
      </div>

      {PINS.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const style = {
          left: `${50 + p.r * 50 * Math.sin(rad)}%`,
          top: `${50 - p.r * 50 * Math.cos(rad)}%`,
          // negative delay: each pin is already in phase with the sweep on first paint
          animationDelay: `${(p.angle / 360) * SWEEP_SECONDS - SWEEP_SECONDS}s`,
        };
        return mode === 'workshops' ? (
          <span key={p.angle} className="radar-ping absolute grid h-7 w-7 place-items-center rounded-lg border border-primary/60 bg-surface-high text-primary" style={style}>
            <Icon name="home_repair_service" className="text-[16px]" />
          </span>
        ) : (
          <span key={p.angle} className={cx('radar-ping absolute h-2.5 w-2.5 rounded-full', sos ? 'bg-emergency-ink' : 'bg-primary')} style={style} />
        );
      })}

      {/* you are here */}
      <span className={cx('absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4', sos ? 'bg-emergency ring-emergency/30' : 'bg-ink ring-primary/30')} />

      {sos && <span className="absolute top-[3%] left-1/2 -translate-x-1/2 rounded-md bg-emergency px-1.5 py-0.5 text-[11px] font-bold text-white">5 km</span>}
    </div>
  );
}
