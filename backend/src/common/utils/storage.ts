import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import type { AllowedImageMime } from '../middlewares/upload';

const EXT: Record<AllowedImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME_BY_EXT: Record<string, AllowedImageMime> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ROOT = path.resolve(env.UPLOAD_DIR);

export type Bucket = 'qris' | 'proofs' | 'photos';

/**
 * Object storage for uploaded images. Files get random server-side names (no user-controlled paths) and
 * are stored under keys like `proofs/<uuid>.jpg`. Two drivers, chosen by STORAGE_DRIVER:
 * - `local`: a folder on disk (development, or a server with a persistent volume);
 * - `supabase`: a PRIVATE Supabase Storage bucket, for hosts without a persistent disk (e.g. Render Free).
 * Files are always served through the API (`sendStored`), so access checks stay in the routes.
 */
export async function saveImage(bucket: Bucket, buffer: Buffer, mime: AllowedImageMime): Promise<string> {
  const key = `${bucket}/${crypto.randomUUID()}.${EXT[mime]}`;
  if (env.STORAGE_DRIVER === 'supabase') {
    await supabase.upload(key, buffer, mime);
  } else {
    await fs.mkdir(path.join(ROOT, bucket), { recursive: true });
    await fs.writeFile(resolveStoredPath(key), buffer, { flag: 'wx' });
  }
  return key;
}

/** Resolves a stored key to an absolute path, refusing anything that escapes the upload root. */
export function resolveStoredPath(key: string): string {
  const abs = path.resolve(ROOT, key);
  if (!abs.startsWith(ROOT + path.sep)) throw new Error('Invalid storage key');
  return abs;
}

/** Writes a stored image to the response (headers such as Cache-Control are set by the caller). */
export async function sendStored(res: Response, key: string): Promise<void> {
  if (env.STORAGE_DRIVER !== 'supabase') {
    res.sendFile(resolveStoredPath(key));
    return;
  }
  const body = await supabase.download(key);
  res.type(MIME_BY_EXT[path.extname(key).slice(1)] ?? 'application/octet-stream');
  res.send(body);
}

export async function deleteStored(key: string | null | undefined): Promise<void> {
  if (!key) return;
  if (env.STORAGE_DRIVER === 'supabase') await supabase.remove(key).catch(() => undefined);
  else await fs.unlink(resolveStoredPath(key)).catch(() => undefined);
}

export const uploadRoot = ROOT;

// ---------- Supabase Storage (REST API, service-role key; never exposed to browsers) ----------

/** Keys come only from saveImage, but are still checked before being put into a URL. */
const SAFE_KEY = /^(qris|proofs|photos)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const supabase = {
  url(key = '') {
    if (key && !SAFE_KEY.test(key)) throw new Error('Invalid storage key');
    return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${env.SUPABASE_BUCKET}${key ? `/${key}` : ''}`;
  },
  headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, ...extra };
  },
  bucketReady: false,

  /** Creates the private bucket on first use (no-op when it already exists). */
  async ensureBucket() {
    if (this.bucketReady) return;
    const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/bucket`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id: env.SUPABASE_BUCKET, name: env.SUPABASE_BUCKET, public: false }),
    });
    if (!res.ok && !/already exists|Duplicate/i.test(await res.text())) throw new Error(`Supabase bucket setup failed (${res.status})`);
    this.bucketReady = true;
  },

  async upload(key: string, buffer: Buffer, mime: string) {
    await this.ensureBucket();
    const res = await fetch(this.url(key), {
      method: 'POST',
      headers: this.headers({ 'Content-Type': mime, 'x-upsert': 'false' }),
      body: new Uint8Array(buffer),
    });
    if (!res.ok) throw new Error(`Supabase upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  },

  async download(key: string): Promise<Buffer> {
    const res = await fetch(this.url(key), { headers: this.headers() });
    if (res.status === 400 || res.status === 404) throw AppError.notFound('File not found');
    if (!res.ok) throw new Error(`Supabase download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  },

  async remove(key: string) {
    const res = await fetch(this.url(key), { method: 'DELETE', headers: this.headers() });
    if (!res.ok && res.status !== 404 && res.status !== 400) throw new Error(`Supabase delete failed (${res.status})`);
  },
};
