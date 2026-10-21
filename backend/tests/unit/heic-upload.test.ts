/**
 * iPhone HEIC photos are accepted and stored as JPEG within the normal 2MB limit; other images are unchanged.
 */
import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import sharp from 'sharp';
import { imageUpload } from '../../src/common/middlewares/upload';
import { errorHandler } from '../../src/common/middlewares/errorHandler';
import { heicDimensions, heicToJpeg, isHeic, HeicConversionError } from '../../src/common/utils/heic';
import { env } from '../../src/config/env';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, '..', 'fixtures', name));
const PHOTO = fixture('photo-12mp.heic'); // 4032x3024, like an iPhone 12 MP photo
const MB2 = 2 * 1024 * 1024;

const app = express();
app.post('/up', imageUpload('photo'), (req, res) => res.json({ mime: req.file!.mimetype, size: req.file!.buffer.length, jpeg: req.file!.buffer.subarray(0, 3).toString('hex') }));
app.post('/qris', imageUpload('qris', { maxSide: 2000 }), async (req, res) => res.json(await sharp(req.file!.buffer).metadata()));
app.use(errorHandler);

describe('HEIC conversion', () => {
  it('recognises HEIC by its content, not its name', () => {
    expect(isHeic(PHOTO)).toBe(true);
    expect(isHeic(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('turns a 12 MP HEIC into a JPEG of at most 1600 px and 2 MB', async () => {
    const jpeg = await heicToJpeg(PHOTO, 1600, MB2);
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(jpeg.length).toBeLessThanOrEqual(MB2);
  }, 60_000);

  it('reads the photo size without decoding, and refuses photos above the megapixel cap or when switched off', async () => {
    expect(heicDimensions(PHOTO)).toEqual({ width: 4032, height: 3024 });
    const cap = env.HEIC_MAX_MEGAPIXELS;
    try {
      env.HEIC_MAX_MEGAPIXELS = 10; // 12.2 MP photo
      await expect(heicToJpeg(PHOTO, 1600, MB2)).rejects.toMatchObject({ reason: 'too_many_pixels' });
      env.HEIC_MAX_MEGAPIXELS = 0;
      await expect(heicToJpeg(PHOTO, 1600, MB2)).rejects.toMatchObject({ reason: 'disabled' });
      const res = await request(app).post('/up').attach('photo', PHOTO, { filename: 'IMG.HEIC', contentType: 'image/heic' });
      expect(res.body.error.code).toBe('HEIC_NOT_SUPPORTED');
    } finally {
      env.HEIC_MAX_MEGAPIXELS = cap;
    }
  });

  it('a broken HEIC is reported as unreadable', async () => {
    const broken = Buffer.concat([PHOTO.subarray(0, 64), Buffer.alloc(2000, 7)]);
    await expect(heicToJpeg(broken, 1600, MB2)).rejects.toBeInstanceOf(HeicConversionError);
  }, 60_000);
});

describe('imageUpload middleware', () => {
  it('stores an iPhone HEIC upload as JPEG (even with no or a generic content type)', async () => {
    for (const contentType of ['image/heic', 'application/octet-stream']) {
      const res = await request(app).post('/up').attach('photo', PHOTO, { filename: 'IMG_0001.HEIC', contentType });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ mime: 'image/jpeg', jpeg: 'ffd8ff' });
      expect(res.body.size).toBeLessThanOrEqual(MB2);
    }
  }, 120_000);

  it('QRIS keeps more pixels (2000 px) so the code stays sharp', async () => {
    const res = await request(app).post('/qris').attach('qris', PHOTO, { filename: 'qris.heic', contentType: 'image/heic' });
    expect(Math.max(res.body.width, res.body.height)).toBe(2000);
  }, 60_000);

  it('still refuses non-images and JPEG/PNG over 2 MB', async () => {
    const video = await request(app).post('/up').attach('photo', Buffer.from('....ftypisom........'), { filename: 'clip.heic', contentType: 'image/heic' });
    expect(video.body.error.code).toBe('INVALID_FILE_TYPE');
    const bigJpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(MB2 + 10)]);
    const big = await request(app).post('/up').attach('photo', bigJpeg, { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');
  });
});
