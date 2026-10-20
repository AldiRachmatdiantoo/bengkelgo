import { pickNext, rankCandidates, routingScore, type Candidate } from '../../src/features/emergency/emergency.logic';

const c = (id: string, distance: number, rating: number, rated = 1, available = 1): Candidate => ({
  id,
  distance_meters: distance,
  top_mechanic_rating: rating,
  rated_mechanics: rated,
  available_mechanics: available,
});

describe('Smart auto-routing (PBI-202)', () => {
  const R = 5000;

  it('scores proximity and rating', () => {
    expect(routingScore(c('a', 0, 5), R)).toBeCloseTo(1);
    expect(routingScore(c('a', 5000, 0), R)).toBeCloseTo(0);
    // unrated mechanics get the neutral 3.0 prior
    expect(routingScore(c('a', 0, 0, 0), R)).toBeCloseTo(0.6 + 0.4 * 0.6);
  });

  it('prefers a slightly farther workshop with much better mechanics', () => {
    const ranked = rankCandidates([c('near-bad', 500, 2), c('farther-good', 1500, 5)], R);
    expect(ranked[0].id).toBe('farther-good');
  });

  it('prefers the nearest workshop when ratings are equal', () => {
    const ranked = rankCandidates([c('far', 4000, 4.5), c('near', 1000, 4.5)], R);
    expect(ranked.map((r) => r.id)).toEqual(['near', 'far']);
  });

  it('skips already-attempted workshops and those without a free mechanic', () => {
    const list = [c('best', 100, 5), c('busy', 200, 5, 1, 0), c('ok', 3000, 4)];
    expect(pickNext(list, R, ['best'])?.id).toBe('ok');
    expect(pickNext(list, R, ['best', 'ok'])).toBeNull();
  });
});
