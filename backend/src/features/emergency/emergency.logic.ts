/**
 * Smart Auto-Routing (PBI-202), pure & unit-testable.
 * Candidates (already filtered to <= radius by PostGIS ST_DWithin) are ranked by a weighted score:
 *   score = 0.6 * proximity + 0.4 * rating
 *   proximity = 1 - distance / radius          (1 = on the spot, 0 = at the radius edge)
 *   rating    = best active mechanic rating / 5 (unrated mechanics use a neutral 3.0 prior)
 * Ties fall back to the nearer workshop.
 */
export const DISTANCE_WEIGHT = 0.6;
export const RATING_WEIGHT = 0.4;
export const NEUTRAL_RATING = 3;

export interface Candidate {
  id: string;
  distance_meters: number;
  top_mechanic_rating: number;
  rated_mechanics: number;
  available_mechanics: number;
}

export function routingScore(c: Candidate, radiusMeters: number): number {
  const proximity = Math.max(0, 1 - c.distance_meters / radiusMeters);
  const rating = (c.rated_mechanics > 0 ? c.top_mechanic_rating : NEUTRAL_RATING) / 5;
  return DISTANCE_WEIGHT * proximity + RATING_WEIGHT * rating;
}

export function rankCandidates<T extends Candidate>(candidates: T[], radiusMeters: number): (T & { score: number })[] {
  return candidates
    .map((c) => ({ ...c, score: Number(routingScore(c, radiusMeters).toFixed(4)) }))
    .sort((a, b) => b.score - a.score || a.distance_meters - b.distance_meters);
}

/** Picks the best workshop that hasn't been tried yet and has a free mechanic. */
export function pickNext<T extends Candidate>(candidates: T[], radiusMeters: number, excludeIds: string[]): (T & { score: number }) | null {
  const excluded = new Set(excludeIds);
  return rankCandidates(candidates.filter((c) => !excluded.has(c.id) && c.available_mechanics > 0), radiusMeters)[0] ?? null;
}
