// Customer's budget range for an SOS request. The API has no field for it, so it travels as the
// last line of `problem_description` ("Kisaran biaya: Rp100.000 – Rp250.000") and is split off for display.
import { rupiah } from './format';

const MARK = 'Kisaran biaya:';
export const NEGOTIABLE = 'Bisa dibicarakan';

export type PriceRange = { min?: number; max?: number };

export const PRICE_PRESETS: { label: string; range: PriceRange }[] = [
  { label: NEGOTIABLE, range: {} },
  { label: '< Rp100rb', range: { max: 100_000 } },
  { label: 'Rp100–250rb', range: { min: 100_000, max: 250_000 } },
  { label: 'Rp250–500rb', range: { min: 250_000, max: 500_000 } },
  { label: '> Rp500rb', range: { min: 500_000 } },
];

export function rangeLabel(r: PriceRange): string {
  const { min, max } = r;
  if (min && max) return `${rupiah(min)} – ${rupiah(max)}`;
  if (max) return `Maks. ${rupiah(max)}`;
  if (min) return `Mulai ${rupiah(min)}`;
  return NEGOTIABLE;
}

/** Appends the range line to the problem text (nothing when negotiable). */
export function withPriceRange(problem: string, r: PriceRange): string {
  const text = problem.trim();
  return r.min || r.max ? `${text}\n${MARK} ${rangeLabel(r)}` : text;
}

/** Splits a stored problem description into the problem itself and the customer's range label. */
export function splitPriceRange(description: string | null | undefined): { text: string; range: string | null } {
  const d = description ?? '';
  const i = d.lastIndexOf(`\n${MARK}`);
  if (i < 0) return { text: d, range: null };
  return { text: d.slice(0, i).trim(), range: d.slice(i + MARK.length + 1).trim() || null };
}

/**
 * The customer's range for an SOS: the API's price_min/price_max columns, or for SOS sent before those
 * existed, the "Kisaran biaya:" line inside the problem text. null = negotiable.
 */
export function customerRange(e: { problem_description?: string | null; price_min?: number | null; price_max?: number | null } | null | undefined): string | null {
  if (!e) return null;
  if (e.price_min != null || e.price_max != null) return rangeLabel({ min: e.price_min ?? undefined, max: e.price_max ?? undefined });
  return splitPriceRange(e.problem_description).range;
}

/** What to show for an emergency's cost: the price set by the workshop, else "Bisa dibicarakan". */
export function emergencyPrice(amount: number): string {
  return amount > 0 ? rupiah(amount) : NEGOTIABLE;
}
