import { describe, expect, it } from 'vitest';
import { buildGoogleAuthUrl, checkCallback, codeChallenge, randomVerifier, redirectUri } from './googleOAuth';

describe('PKCE', () => {
  it('matches the RFC 7636 example challenge', async () => {
    // RFC 7636 appendix B
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates URL-safe verifiers of a valid length', () => {
    const v = randomVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(randomVerifier()).not.toBe(v);
  });

  it('builds the Google URL with every PKCE parameter', async () => {
    const url = new URL(await buildGoogleAuthUrl({ clientId: 'cid.apps.googleusercontent.com', redirectUri: redirectUri('http://localhost:5173'), verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', state: 'st4te' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const q = url.searchParams;
    expect(q.get('client_id')).toBe('cid.apps.googleusercontent.com');
    expect(q.get('redirect_uri')).toBe('http://localhost:5173/auth/google/callback');
    expect(q.get('response_type')).toBe('code');
    expect(q.get('scope')).toBe('openid email profile');
    expect(q.get('code_challenge')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('state')).toBe('st4te');
  });
});

describe('checkCallback', () => {
  const pending = { verifier: 'v', state: 's', from: '/workshops/1' };
  it('accepts a matching state', () => {
    expect(checkCallback(new URLSearchParams('code=abc&state=s'), pending)).toEqual({ ok: true, code: 'abc', verifier: 'v', from: '/workshops/1' });
  });
  it('rejects a forged or stale state (CSRF)', () => {
    expect(checkCallback(new URLSearchParams('code=abc&state=other'), pending).ok).toBe(false);
    expect(checkCallback(new URLSearchParams('code=abc&state=s'), null).ok).toBe(false);
  });
  it('explains a cancelled login', () => {
    expect(checkCallback(new URLSearchParams('error=access_denied&state=s'), pending)).toEqual({ ok: false, message: 'Login Google dibatalkan.' });
  });
});
