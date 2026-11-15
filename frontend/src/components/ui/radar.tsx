import type { CSSProperties } from 'react';
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
/** In `sos` mode the workshop at this pin drives to the broken-down vehicle in the middle. */
const RESPONDER = PINS[0];

const SWEEP_SECONDS = 4;

function point(angle: number, r: number, size: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: size / 2 + r * (size / 2) * Math.sin(rad), y: size / 2 - r * (size / 2) * Math.cos(rad) };
}

/** Street-like route (right angles, as a map app draws it) from the responder pin to the edge of the centre badge. */
function routePath(size: number) {
  const c = size / 2;
  const s = point(RESPONDER.angle, RESPONDER.r, size);
  const turnY = s.y + (c - s.y) * 0.45;
  const laneX = c + size * 0.12;
  const stop = c + 24; // centre badge is 44 px wide
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} L ${s.x.toFixed(1)} ${turnY.toFixed(1)} L ${laneX.toFixed(1)} ${turnY.toFixed(1)} L ${laneX.toFixed(1)} ${c} L ${stop} ${c}`;
}

/**
 * Radar of nearby workshops, drawn in the map's dark green: rings, a rotating sweep and pins that light up as the
 * sweep passes them, around a broken-down motorbike/car. `workshops` turns the pins into workshop badges; `sos` paints
 * the sweep red, marks the 5 km ring and shows one workshop driving to the vehicle along a route, like a map app.
 * CSS only; everything holds still under reduced motion.
 */
export default function Radar({ mode = 'scan', size = 280, className }: { mode?: RadarMode; size?: number; className?: string }) {
  const sos = mode === 'sos';
  const accent = sos ? 'var(--color-emergency)' : 'var(--color-primary)';
  const route = routePath(size);
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

      {/* SOS: the route is drawn in when the mode starts, dark casing under a bright line like a map app */}
      {sos && (
        <svg className="absolute inset-0" width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
          <path d={route} stroke="#0b120c" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="radar-route" />
          <path d={route} stroke="var(--color-primary)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="radar-route" />
        </svg>
      )}

      {PINS.map((p) => {
        if (sos && p === RESPONDER) return null;
        const at = point(p.angle, p.r, size);
        const style = {
          left: at.x,
          top: at.y,
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

      {/* SOS: the responding workshop drives along the route to the vehicle */}
      {sos && (
        <span
          className="radar-drive absolute top-0 left-0 grid h-8 w-8 place-items-center rounded-lg border-2 border-[#0b120c] bg-primary text-on-primary shadow-float"
          style={{ offsetPath: `path('${route}')` } as CSSProperties}
        >
          <Icon name="home_repair_service" filled className="text-[18px]" />
        </span>
      )}

      {/* the broken-down vehicle: motorbike and car take turns, with a warning badge */}
      <span
        className={cx(
          'absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 transition-colors duration-700',
          sos ? 'border-emergency-ink bg-emergency text-white' : 'border-emergency/70 bg-surface-high text-ink',
        )}
      >
        <Icon name="two_wheeler" className="radar-swap absolute text-[22px]" />
        <Icon name="directions_car" className="radar-swap radar-swap-b absolute text-[22px]" />
        <span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#172219]">
          <Icon name="warning" filled className="text-[16px] text-[#ffb547]" />
        </span>
      </span>

      {sos && <span className="absolute top-[3%] left-1/2 -translate-x-1/2 rounded-md bg-emergency px-1.5 py-0.5 text-[11px] font-bold text-white">5 km</span>}
    </div>
  );
}
