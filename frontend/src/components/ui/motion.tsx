// Small, restrained motion helpers (framer-motion). Respect "reduce motion" via <MotionConfig reducedMotion="user"> in main.tsx.
import type { ReactNode } from 'react';
import { m, type Variants } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades content up a little the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, as = 'div' }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' }) {
  const M = as === 'section' ? m.section : m.div;
  return (
    <M className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.45, ease: EASE, delay }}>
      {children}
    </M>
  );
}

const group: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } };

/** Grid/list whose children (<RevealItem>) fade in one after another. */
export function RevealGroup({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ol' | 'ul' }) {
  const M = as === 'ol' ? m.ol : as === 'ul' ? m.ul : m.div;
  return (
    <M className={className} variants={group} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
      {children}
    </M>
  );
}

export function RevealItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const M = as === 'li' ? m.li : m.div;
  return (
    <M className={className} variants={item}>
      {children}
    </M>
  );
}

/** Soft fade when a page mounts (keyed by pathname in the layouts). */
export function PageFade({ children }: { children: ReactNode }) {
  return (
    // Opacity only: a transform here would break position:fixed bars inside pages (e.g. the SOS send bar).
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: EASE }}>
      {children}
    </m.div>
  );
}
