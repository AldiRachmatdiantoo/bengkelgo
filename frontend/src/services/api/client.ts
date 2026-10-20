import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { translateApiError } from './errorMessages';
import type { ApiErrorBody, ApiSuccess, AuthPayload } from './types';

export const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * Access token lives in memory only (never localStorage -> not stealable via XSS persistence).
 * The refresh token is an httpOnly cookie managed by the browser.
 */
let accessToken: string | null = null;
type Listener = (session: AuthPayload | null) => void;
const listeners = new Set<Listener>();

export const tokenStore = {
  get: () => accessToken,
  set(session: AuthPayload | null) {
    accessToken = session?.access_token ?? null;
    listeners.forEach((l) => l(session));
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export const http = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 20_000 });

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`);
  return config;
});

/**
 * Single in-flight refresh shared by all callers. Refresh tokens are single-use on the server
 * (reuse = whole session revoked), so two parallel refreshes must never happen.
 */
let refreshing: Promise<AuthPayload | null> | null = null;
export function refreshSession(): Promise<AuthPayload | null> {
  refreshing ??= axios
    .post<ApiSuccess<AuthPayload>>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
    .then((r) => {
      tokenStore.set(r.data.data);
      return r.data.data;
    })
    .catch(() => {
      tokenStore.set(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// Expired access token -> refresh once, then replay the original request.
http.interceptors.response.use(undefined, async (error: AxiosError<ApiErrorBody>) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const code = error.response?.data?.error?.code;
  if (error.response?.status === 401 && code === 'TOKEN_INVALID' && original && !original._retried) {
    original._retried = true;
    const session = await refreshSession();
    if (session) return http(original);
  }
  throw error;
});

/** Unwraps `{ success, data }`. */
export async function call<T>(p: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  return (await p).data.data;
}

/** Human-readable message for any API / network error. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error) return translateApiError(body.error.code, body.error.details?.issues) ?? body.error.message;
    if (err.response?.status === 429) return 'Terlalu banyak permintaan, coba lagi sebentar.';
    if (!err.response) return 'Tidak dapat terhubung ke server.';
  }
  return err instanceof Error ? err.message : 'Terjadi kesalahan.';
}

export function errorCode(err: unknown): string | undefined {
  return axios.isAxiosError(err) ? (err.response?.data as ApiErrorBody | undefined)?.error?.code : undefined;
}

/** Fetches a protected image (QRIS / payment proof) and returns an object URL for <img>. */
export async function fetchImageUrl(path: string): Promise<string> {
  try {
    const res = await http.get(path, { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  } catch (err) {
    // Error bodies arrive as Blob here; surface the API's JSON message.
    const data = axios.isAxiosError(err) ? err.response?.data : null;
    if (data instanceof Blob) {
      const body = JSON.parse(await data.text().catch(() => '{}')) as Partial<ApiErrorBody>;
      if (body.error?.message) throw new Error(body.error.message);
    }
    throw err;
  }
}
