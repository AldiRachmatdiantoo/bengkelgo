// Google sign-in, Authorization Code flow with PKCE (PRD 6.4 / PBI-106).
// The browser creates a one-time code_verifier, sends only its SHA-256 challenge to Google, and after the
// redirect hands `code` + `code_verifier` to POST /auth/google; the backend swaps them for Google tokens.
// The button stays hidden until VITE_GOOGLE_CLIENT_ID is set.

export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
export const googleEnabled = () => GOOGLE_CLIENT_ID.trim().length > 0;
export const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

const STORE_KEY = 'bengkel.google-pkce';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface PendingGoogleLogin {
  verifier: string;
  state: string;
  /** Page to return to after signing in (same rules as the email login). */
  from?: string;
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 64 random bytes -> 86-char verifier (RFC 7636 allows 43–128). */
export function randomVerifier(bytes = 64): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** Must equal GOOGLE_REDIRECT_URI in backend/.env and the redirect URI registered in Google Cloud. */
export const redirectUri = (origin = window.location.origin) => `${origin}${GOOGLE_CALLBACK_PATH}`;

export async function buildGoogleAuthUrl(p: { clientId: string; redirectUri: string; verifier: string; state: string }): Promise<string> {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: await codeChallenge(p.verifier),
    code_challenge_method: 'S256',
    state: p.state,
    prompt: 'select_account',
  });
  return `${AUTH_URL}?${q.toString()}`;
}

/** Saves the verifier + state for the callback page and sends the browser to Google. */
export async function startGoogleLogin(from?: string): Promise<void> {
  const pending: PendingGoogleLogin = { verifier: randomVerifier(), state: randomVerifier(24), from };
  sessionStorage.setItem(STORE_KEY, JSON.stringify(pending));
  window.location.assign(await buildGoogleAuthUrl({ clientId: GOOGLE_CLIENT_ID, redirectUri: redirectUri(), verifier: pending.verifier, state: pending.state }));
}

/** Reads and deletes the pending login (single use). */
export function takePendingGoogleLogin(): PendingGoogleLogin | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    sessionStorage.removeItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as PendingGoogleLogin) : null;
  } catch {
    return null;
  }
}

export type CallbackCheck = { ok: true; code: string; verifier: string; from?: string } | { ok: false; message: string };

/** Validates what Google sent back against what we stored before leaving. */
export function checkCallback(params: URLSearchParams, pending: PendingGoogleLogin | null): CallbackCheck {
  const error = params.get('error');
  if (error === 'access_denied') return { ok: false, message: 'Login Google dibatalkan.' };
  if (error) return { ok: false, message: 'Google menolak permintaan login. Silakan coba lagi.' };
  const code = params.get('code');
  if (!code) return { ok: false, message: 'Tautan login Google tidak lengkap. Silakan coba lagi.' };
  if (!pending || pending.state !== params.get('state')) {
    return { ok: false, message: 'Sesi login Google tidak cocok atau sudah kedaluwarsa. Silakan ulangi dari halaman Masuk.' };
  }
  return { ok: true, code, verifier: pending.verifier, from: pending.from };
}
