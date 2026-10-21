// Checks and shrinks a photo in the browser before it is uploaded (QRIS image, payment proof, workshop photos).
// The API stores JPEG/PNG/WEBP images under 2 MB, so we catch the common problems here (videos, PDFs, renamed
// files, 4 MB phone photos, iPhone HEIC photos) with a clear Indonesian message instead of a failed upload.

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
/** iPhone HEIC photos the browser can't convert are sent as-is up to this size (the server converts them). */
export const MAX_HEIC_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPT_IMAGES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

type RealType = 'image/jpeg' | 'image/png' | 'image/webp' | 'heic' | null;

export class ImageCheckError extends Error {}

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
export const fileSize = kb;

/** Reads the real file type from its first bytes (the extension and browser-reported type can lie). */
export function sniffType(head: Uint8Array): RealType {
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => head[i] === b)) return 'image/png';
  if (head.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (head.length >= 12 && ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(ascii(8, 12))) return 'heic';
  return null;
}

async function readHead(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 16).arrayBuffer());
}

/** Why a file can't be used, judged by what the user picked (before decoding). */
export function rejectReason(file: { type: string; name: string }): string | null {
  const t = file.type.toLowerCase();
  if (t.startsWith('video/')) return 'Video tidak bisa diunggah. Pilih foto (JPG, PNG, atau WEBP).';
  if (t === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'File PDF tidak bisa diunggah. Ambil screenshot lalu unggah sebagai foto.';
  if (t && !t.startsWith('image/')) return 'Hanya foto JPG, PNG, atau WEBP yang bisa diunggah.';
  return null;
}

function loadBitmap(file: Blob, timeoutMs = 15_000): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok: boolean) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (ok) resolve(img);
      else reject(new Error('decode failed'));
    };
    const timer = setTimeout(() => done(false), timeoutMs);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/**
 * Opens an iPhone HEIC photo in browsers without built-in HEIC support (Chrome, Android, Windows). The decoder
 * (WebAssembly, ~2 MB) is downloaded only when someone actually picks a HEIC photo. Null when it can't.
 */
async function decodeHeic(file: Blob): Promise<ImageBitmap | null> {
  try {
    const { heicTo } = await import('heic-to');
    return await heicTo({ blob: file, type: 'bitmap' });
  } catch {
    return null;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Largest side after scaling down to `maxSide` (never scales up). */
export function fitSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const renamed = (name: string, ext: string) => `${name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`;

export interface PreparedImage {
  file: File;
  /** True when the photo was converted or shrunk in the browser. */
  changed: boolean;
  originalSize: number;
}

/**
 * Returns a file the API will accept, or throws ImageCheckError with an Indonesian message.
 * Small JPEG/PNG/WEBP files are sent untouched (keeps QR codes pixel-sharp); large or HEIC photos are
 * redrawn on a canvas at most `maxSide` px and re-encoded as JPEG until they fit under 2 MB.
 */
export async function prepareImage(file: File, opts: { maxSide?: number } = {}): Promise<PreparedImage> {
  const maxSide = opts.maxSide ?? 1600;
  const early = rejectReason(file);
  if (early) throw new ImageCheckError(early);

  const real = sniffType(await readHead(file));
  if (!real) throw new ImageCheckError('File ini bukan foto yang valid. Pilih foto JPG, PNG, atau WEBP.');
  if (real !== 'heic' && file.size <= MAX_UPLOAD_BYTES) return { file, changed: false, originalSize: file.size };

  let img: ImageBitmap | HTMLImageElement;
  try {
    img = await loadBitmap(file);
  } catch {
    const heic = real === 'heic' ? await decodeHeic(file) : null;
    if (heic) img = heic;
    // Last resort for iPhone photos: let the server convert it.
    else if (real === 'heic' && file.size <= MAX_HEIC_UPLOAD_BYTES) return { file, changed: false, originalSize: file.size };
    else {
      throw new ImageCheckError(
        real === 'heic'
          ? 'Foto iPhone ini belum bisa dibuka. Unggah screenshot, atau atur kamera iPhone ke "Paling Kompatibel" (Pengaturan > Kamera > Format).'
          : `Foto terlalu besar (${kb(file.size)}) dan tidak bisa diperkecil otomatis. Pilih foto di bawah 2 MB.`,
      );
    }
  }

  let side = maxSide;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { width, height } = fitSize(img.width, img.height, side);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#ffffff'; // transparent PNG areas would turn black in JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    for (const quality of [0.9, 0.8, 0.7]) {
      const blob = await toBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        if ('close' in img) img.close();
        return { file: new File([blob], renamed(file.name, 'jpg'), { type: 'image/jpeg' }), changed: true, originalSize: file.size };
      }
    }
    side = Math.round(side * 0.75);
  }
  if ('close' in img) img.close();
  throw new ImageCheckError(`Foto terlalu besar (${kb(file.size)}) dan tidak bisa diperkecil otomatis. Pilih foto di bawah 2 MB.`);
}
