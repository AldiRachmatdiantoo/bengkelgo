import { describe, expect, it } from 'vitest';
import { NEGOTIABLE, emergencyPrice, rangeLabel, splitPriceRange, withPriceRange } from './priceRange';

// Intl puts a no-break space after "Rp"; compare on normal spaces.
const sp = (s: string | null) => s?.replace(/ /g, ' ') ?? s;

describe('priceRange', () => {
  it('labels ranges', () => {
    expect(rangeLabel({})).toBe(NEGOTIABLE);
    expect(sp(rangeLabel({ min: 100_000, max: 250_000 }))).toBe('Rp 100.000 – Rp 250.000');
    expect(sp(rangeLabel({ max: 100_000 }))).toBe('Maks. Rp 100.000');
    expect(sp(rangeLabel({ min: 500_000 }))).toBe('Mulai Rp 500.000');
  });

  it('leaves the problem text untouched when the price is negotiable', () => {
    expect(withPriceRange('  Aki mati total ', {})).toBe('Aki mati total');
    expect(splitPriceRange('Aki mati total')).toEqual({ text: 'Aki mati total', range: null });
  });

  it('round-trips a range through problem_description', () => {
    const stored = withPriceRange('Ban bocor di jalan', { min: 100_000, max: 250_000 });
    const back = splitPriceRange(stored);
    expect(back.text).toBe('Ban bocor di jalan');
    expect(sp(back.range)).toBe('Rp 100.000 – Rp 250.000');
  });

  it('handles missing descriptions', () => {
    expect(splitPriceRange(null)).toEqual({ text: '', range: null });
  });

  it('shows "Bisa dibicarakan" instead of Rp0 for unpriced emergencies', () => {
    expect(emergencyPrice(0)).toBe(NEGOTIABLE);
    expect(sp(emergencyPrice(75_000))).toBe('Rp 75.000');
  });
});
