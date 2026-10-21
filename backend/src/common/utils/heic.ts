import { Worker } from 'worker_threads';
import sharp from 'sharp';
import { env } from '../../config/env';

/**
 * iPhone photos (HEIC/HEIF). The web app converts them in the browser; this is the server-side fallback
 * (other browsers, API clients). heic-decode reads the pixels (sharp's prebuilt libvips has no HEVC decoder),
 * then sharp resizes and encodes a JPEG within the normal upload limit. Metadata (incl. GPS) is dropped.
 *
 * Memory: the decoder is WebAssembly and never gives its heap back (a 12 MP photo leaves ~200 MB behind), so
 * each decode runs in a short-lived worker thread that is ended afterwards, one at a time per API instance,
 * and photos above HEIC_MAX_MEGAPIXELS are refused before decoding (the free host has 512 MB).
 */
const HEIC_BRANDS = /^(heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1)$/;

export function isHeic(buf: Buffer) {
  return buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp' && HEIC_BRANDS.test(buf.toString('ascii', 8, 12));
}

/** Largest image size declared in the file's 'ispe' boxes (read without decoding), or null if none. */
export function heicDimensions(buf: Buffer): { width: number; height: number } | null {
  let best: { width: number; height: number } | null = null;
  for (let i = buf.indexOf('ispe'); i !== -1 && i + 16 <= buf.length; i = buf.indexOf('ispe', i + 4)) {
    const width = buf.readUInt32BE(i + 8);
    const height = buf.readUInt32BE(i + 12);
    if (!best || width * height > best.width * best.height) best = { width, height };
  }
  return best;
}

export class HeicConversionError extends Error {
  constructor(readonly reason: 'unreadable' | 'too_large' | 'too_many_pixels' | 'disabled') {
    super(`HEIC conversion failed: ${reason}`);
  }
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

// Runs in the worker: decode, hand the pixels back (transferred, not copied), then the worker exits.
const DECODE_WORKER = `
const { parentPort, workerData } = require('worker_threads');
require('heic-decode')({ buffer: Buffer.from(workerData) })
  .then(({ width, height, data }) => parentPort.postMessage({ width, height, data }, [data.buffer]))
  .catch((err) => parentPort.postMessage({ error: String(err && err.message || err) }));
`;

function decodeInWorker(buf: Buffer): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(DECODE_WORKER, { eval: true, workerData: buf });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new HeicConversionError('unreadable'));
    }, 30_000);
    worker.once('message', (m: { error?: string; width: number; height: number; data: Uint8ClampedArray }) => {
      clearTimeout(timer);
      void worker.terminate();
      if (m.error || !m.data) reject(new HeicConversionError('unreadable'));
      else resolve(m);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(new HeicConversionError('unreadable'));
    });
  });
}

/** HEIC → JPEG no wider/taller than `maxSide` px and at most `maxBytes`. */
export function heicToJpeg(buf: Buffer, maxSide: number, maxBytes: number): Promise<Buffer> {
  if (env.HEIC_MAX_MEGAPIXELS <= 0) return Promise.reject(new HeicConversionError('disabled'));
  const size = heicDimensions(buf);
  // Unknown size could be anything: refuse rather than risk running out of memory.
  if (!size || (size.width * size.height) / 1e6 > env.HEIC_MAX_MEGAPIXELS) return Promise.reject(new HeicConversionError('too_many_pixels'));
  return oneAtATime(async () => {
    const pixels = await decodeInWorker(buf);
    // Resize once from the raw pixels, then only re-encode smaller if needed.
    const resized = await sharp(Buffer.from(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength), {
      raw: { width: pixels.width, height: pixels.height, channels: 4 },
    })
      .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (const quality of [85, 75, 65, 55]) {
      const out = await sharp(resized.data, { raw: { width: resized.info.width, height: resized.info.height, channels: resized.info.channels } })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
      if (out.length <= maxBytes) return out;
    }
    throw new HeicConversionError('too_large');
  });
}
