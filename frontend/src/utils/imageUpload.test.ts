import { describe, expect, it, vi } from 'vitest';
import { ImageCheckError, MAX_UPLOAD_BYTES, fitSize, prepareImage, rejectReason, sniffType } from './imageUpload';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const WEBP = [...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')];
const HEIC = [0, 0, 0, 0x18, ...ascii('ftypheic')];
const MP4 = [0, 0, 0, 0x18, ...ascii('ftypisom')];

const file = (bytes: number[], name: string, type: string, pad = 0) => new File([new Uint8Array(bytes), new Uint8Array(pad)], name, { type });

describe('sniffType', () => {
  it('recognises the three accepted formats and HEIC by their first bytes', () => {
    expect(sniffType(new Uint8Array(PNG))).toBe('image/png');
    expect(sniffType(new Uint8Array(JPEG))).toBe('image/jpeg');
    expect(sniffType(new Uint8Array(WEBP))).toBe('image/webp');
    expect(sniffType(new Uint8Array(HEIC))).toBe('heic');
  });

  it('rejects video containers and text', () => {
    expect(sniffType(new Uint8Array(MP4))).toBeNull();
    expect(sniffType(new Uint8Array(ascii('<html><body>')))).toBeNull();
    expect(sniffType(new Uint8Array([]))).toBeNull();
  });
});

describe('rejectReason', () => {
  it('names videos and PDFs explicitly', () => {
    expect(rejectReason({ type: 'video/mp4', name: 'a.mp4' })).toMatch(/Video tidak bisa/);
    expect(rejectReason({ type: 'application/pdf', name: 'a.pdf' })).toMatch(/PDF/);
    expect(rejectReason({ type: 'text/plain', name: 'a.txt' })).toMatch(/Hanya foto/);
    expect(rejectReason({ type: 'image/png', name: 'a.png' })).toBeNull();
    expect(rejectReason({ type: '', name: 'IMG_1.HEIC' })).toBeNull(); // some browsers report no type for HEIC
  });
});

describe('fitSize', () => {
  it('scales the longest side down and never up', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('prepareImage', () => {
  it('passes small real images through untouched', async () => {
    const f = file(PNG, 'qris.png', 'image/png', 1000);
    const r = await prepareImage(f);
    expect(r.file).toBe(f);
    expect(r.changed).toBe(false);
  });

  it('rejects a video even when it was renamed to .jpg', async () => {
    await expect(prepareImage(file(MP4, 'clip.jpg', 'image/jpeg'))).rejects.toThrow(/bukan foto yang valid/);
  });

  it('rejects a video picked by drag & drop', async () => {
    await expect(prepareImage(file(MP4, 'clip.mp4', 'video/mp4'))).rejects.toBeInstanceOf(ImageCheckError);
  });

  it('tries to shrink oversized photos and explains when it cannot', async () => {
    // Simulate a browser that cannot decode the photo (the "cannot shrink" path).
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('decode failed')));
    try {
      const big = file(JPEG, 'kamera.jpg', 'image/jpeg', MAX_UPLOAD_BYTES + 10);
      await expect(prepareImage(big)).rejects.toThrow(/terlalu besar/);
      await expect(prepareImage(file(HEIC, 'IMG_1.HEIC', 'image/heic'))).rejects.toThrow(/HEIC/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
