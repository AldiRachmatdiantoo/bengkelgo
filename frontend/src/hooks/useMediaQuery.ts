import { useEffect, useState } from 'react';

/** True while the CSS media query matches (follows resizes and rotation). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Phones: below Tailwind's `sm` breakpoint (640px). */
export const PHONE_QUERY = '(max-width: 639px)';
