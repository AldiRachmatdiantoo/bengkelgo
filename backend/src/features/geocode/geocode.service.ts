import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../common/errors/AppError';
import type { PlaceSearchQuery } from './geocode.schema';

/**
 * Free place search on OpenStreetMap data: Nominatim first (answers in ~0.5 s from Indonesia), Photon as the
 * fallback (~5 s, hosted in Germany). Both are public services with fair-use rules, so the API is the only
 * caller: it sends an identifying User-Agent, keeps Nominatim to at most one request per second, and caches
 * answers for 15 minutes. Nominatim forbids type-ahead, so the web app searches on Enter / "Cari" only.
 */
export interface Place {
  name: string;
  /** street / district / city / province, for telling same-named places apart */
  detail: string;
  lat: number;
  lng: number;
  source: 'photon' | 'nominatim';
}

const INDONESIA_BBOX = '94.9,-11.2,141.1,6.3'; // minLon,minLat,maxLon,maxLat
const NOMINATIM_TIMEOUT_MS = 6_000;
const PHOTON_TIMEOUT_MS = 9_000;
const CACHE_TTL_MS = 15 * 60_000;
const CACHE_MAX = 500; // bounded so the cache can never grow without limit
const userAgent = () => `BengkelGo/1.0 (+${env.APP_URL})`;

const cache = new Map<string, { at: number; places: Place[] }>();

function remember(key: string, places: Place[]) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), places });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!); // oldest first (insertion order)
}

const uniqueParts = (parts: (string | null | undefined)[], skip: string) =>
  [...new Set(parts.map((p) => p?.trim()).filter((p): p is string => !!p && p.toLowerCase() !== skip.toLowerCase()))].join(', ');

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
};

async function photon(q: PlaceSearchQuery): Promise<Place[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', q.q);
  url.searchParams.set('limit', String(q.limit));
  url.searchParams.set('bbox', INDONESIA_BBOX);
  if (q.lat !== undefined && q.lng !== undefined) {
    url.searchParams.set('lat', String(q.lat));
    url.searchParams.set('lon', String(q.lng));
  }
  const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' }, signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const body = (await res.json()) as { features?: PhotonFeature[] };
  return (body.features ?? [])
    .filter((f) => !f.properties.countrycode || f.properties.countrycode.toUpperCase() === 'ID')
    .map((f) => {
      const p = f.properties;
      const name = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.city || p.county || 'Lokasi';
      return {
        name,
        detail: uniqueParts([p.street, p.district, p.city, p.county, p.state], name),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        source: 'photon' as const,
      };
    });
}

// Nominatim usage policy: max 1 request/second. Calls are chained so they never overlap.
let nominatimQueue: Promise<unknown> = Promise.resolve();
let nominatimLast = 0;

async function nominatim(q: PlaceSearchQuery): Promise<Place[]> {
  const run = async () => {
    const wait = nominatimLast + 1_100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', q.q);
    url.searchParams.set('countrycodes', 'id');
    url.searchParams.set('limit', String(q.limit));
    url.searchParams.set('accept-language', 'id');
    const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' }, signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const rows = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[];
    return rows.map((r) => {
      const [first, ...rest] = r.display_name.split(',').map((s) => s.trim());
      const name = r.name || first;
      return { name, detail: uniqueParts(rest.filter((s) => s !== 'Indonesia').slice(0, 4), name), lat: Number(r.lat), lng: Number(r.lon), source: 'nominatim' as const };
    });
  };
  const result = nominatimQueue.then(run, run);
  nominatimQueue = result.catch(() => undefined);
  return result;
}

/** Drops near-duplicates (same name within ~100 m), which both services return for long streets. */
function dedupe(places: Place[]) {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const geocodeService = {
  async search(q: PlaceSearchQuery): Promise<Place[]> {
    const near = q.lat !== undefined && q.lng !== undefined ? `${q.lat.toFixed(1)},${q.lng.toFixed(1)}` : '';
    const key = `${q.q.toLowerCase()}|${q.limit}|${near}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.places;

    let places: Place[] = [];
    let failures = 0;
    try {
      places = await nominatim(q);
    } catch (err) {
      failures++;
      logger.warn({ err: (err as Error).message }, 'Nominatim place search failed, trying Photon');
    }
    if (!places.length) {
      try {
        places = await photon(q);
      } catch (err) {
        failures++;
        logger.warn({ err: (err as Error).message }, 'Photon place search failed');
      }
    }
    // Both services down: say so (an empty list would read as "nothing found").
    if (failures === 2) throw new AppError(503, 'GEOCODE_UNAVAILABLE', 'Place search is temporarily unavailable');
    const result = dedupe(places).slice(0, q.limit);
    remember(key, result);
    return result;
  },

  /** Test seam. */
  clearCache() {
    cache.clear();
  },
};
