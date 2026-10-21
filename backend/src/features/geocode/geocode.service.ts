import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../common/errors/AppError';
import type { PlaceSearchQuery, ReverseQuery } from './geocode.schema';

/**
 * Free place search on OpenStreetMap data: Nominatim first (answers in ~0.5 s from Indonesia), Photon as the
 * fallback (~5 s, hosted in Germany). Both are public services with fair-use rules, so the API is the only
 * caller: it sends an identifying User-Agent, keeps Nominatim to at most one request per second, and caches
 * answers for 15 minutes. It also turns a map point back into an approximate address. Nominatim forbids type-ahead, so the web app searches on Enter / "Cari" only.
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

/** Joins address parts, dropping blanks, repeats and parts the (comma-separated) place name already lists. */
const uniqueParts = (parts: (string | null | undefined)[], skip: string) => {
  const named = new Set(skip.split(',').map((s) => s.trim().toLowerCase()));
  return [...new Set(parts.map((p) => p?.trim()).filter((p): p is string => !!p && !named.has(p.toLowerCase())))].join(', ');
};

/** Some OSM names hold a whole address ("Gedung X, Jalan Y, Depok"); keep the first part as the name. */
const shortName = (name: string | undefined) => name?.split(',')[0].trim() || undefined;

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

// Nominatim usage policy: max 1 request/second. Calls (search and reverse) are chained so they never overlap.
let nominatimQueue: Promise<unknown> = Promise.resolve();
let nominatimLast = 0;

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = nominatimLast + 1_100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLast = Date.now();
    return fn();
  };
  const result = nominatimQueue.then(run, run);
  nominatimQueue = result.catch(() => undefined);
  return result;
}

async function nominatim(q: PlaceSearchQuery): Promise<Place[]> {
  return throttled(async () => {
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
  });
}

type NominatimAddress = Record<string, string | undefined>;

/** Street-level label for a point: "Jalan Margonda Raya 12" or the nearest named place. */
async function nominatimReverse(q: ReverseQuery): Promise<Place | null> {
  return throttled(async () => {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(q.lat));
    url.searchParams.set('lon', String(q.lng));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'id');
    const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' }, signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const body = (await res.json()) as { error?: string; lat?: string; lon?: string; name?: string; address?: NominatimAddress };
    if (body.error || !body.address || body.address.country_code?.toLowerCase() !== 'id') return null; // sea / abroad
    const a = body.address;
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    const name = shortName(body.name) || street || a.neighbourhood || a.village || a.suburb || a.city_district || a.city || a.county || 'Lokasi';
    const detail = uniqueParts([street, a.village || a.suburb || a.neighbourhood, a.city_district, a.city || a.town || a.county, a.state], name);
    return { name, detail, lat: Number(body.lat ?? q.lat), lng: Number(body.lon ?? q.lng), source: 'nominatim' };
  });
}

async function photonReverse(q: ReverseQuery): Promise<Place | null> {
  const url = new URL('https://photon.komoot.io/reverse');
  url.searchParams.set('lat', String(q.lat));
  url.searchParams.set('lon', String(q.lng));
  url.searchParams.set('limit', '1');
  const res = await fetch(url, { headers: { 'User-Agent': userAgent(), Accept: 'application/json' }, signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const f = ((await res.json()) as { features?: PhotonFeature[] }).features?.[0];
  if (!f || (f.properties.countrycode && f.properties.countrycode.toUpperCase() !== 'ID')) return null;
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = shortName(p.name) || street || p.district || p.city || p.county || 'Lokasi';
  return { name, detail: uniqueParts([street, p.district, p.city, p.county, p.state], name), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], source: 'photon' };
}

const reverseCache = new Map<string, { at: number; place: Place | null }>();

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

  /**
   * Approximate address of a point (the pin on the SOS / workshop maps). Null when the point has no address
   * (sea, outside Indonesia). Points ~10 m apart share a cache entry, so nudging the pin doesn't refetch.
   */
  async reverse(q: ReverseQuery): Promise<Place | null> {
    const key = `${q.lat.toFixed(4)},${q.lng.toFixed(4)}`;
    const hit = reverseCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.place;

    let place: Place | null = null;
    let failures = 0;
    try {
      place = await nominatimReverse(q);
    } catch (err) {
      failures++;
      logger.warn({ err: (err as Error).message }, 'Nominatim reverse geocoding failed, trying Photon');
    }
    if (!place) {
      try {
        place = await photonReverse(q);
      } catch (err) {
        failures++;
        logger.warn({ err: (err as Error).message }, 'Photon reverse geocoding failed');
      }
    }
    if (failures === 2) throw new AppError(503, 'GEOCODE_UNAVAILABLE', 'Place search is temporarily unavailable');
    reverseCache.delete(key);
    reverseCache.set(key, { at: Date.now(), place });
    while (reverseCache.size > CACHE_MAX) reverseCache.delete(reverseCache.keys().next().value!);
    return place;
  },

  /** Test seam. */
  clearCache() {
    cache.clear();
    reverseCache.clear();
  },
};
