import { cx } from './index';

/**
 * Wireframe globe in the BengkelGo palette: lime meridians and workshop pins drift past under a
 * fixed latitude grid, with inset shading for the sphere. Pure CSS, no remote texture; the
 * drift stops for people who ask for reduced motion.
 */
export default function Globe({ className, size = 280 }: { className?: string; size?: number }) {
  return (
    <div
      aria-hidden
      className={cx('globe relative overflow-hidden rounded-full border border-primary/30 bg-surface-low', className)}
      style={{ width: size, height: size }}
    >
      {/* meridians + pins, scrolled sideways so the sphere seems to turn */}
      <div className="globe-spin absolute inset-0" />
      {/* latitude lines stay put */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0_27px,rgb(186_244_143/0.22)_27px_28px)]" />
      {/* equator */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-primary/50" />
      {/* sphere shading: light from the upper left, night side lower right */}
      <div className="absolute inset-0 rounded-full shadow-[inset_-6px_-2px_10px_rgb(186_244_143/0.35),inset_40px_10px_60px_rgb(0_0_0/0.15),inset_-90px_-20px_70px_rgb(0_0_0/0.75)]" />
      <div className="absolute top-[14%] left-[18%] h-1/4 w-1/4 rounded-full bg-primary/10 blur-2xl" />
    </div>
  );
}
