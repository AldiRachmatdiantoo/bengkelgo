import fs from 'fs';
import path from 'path';
import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../../src/app';
import { pool } from '../../src/config/database';
import { env } from '../../src/config/env';
import { memoryStore } from '../../src/common/middlewares/rateLimiter';
import { saveImage } from '../../src/common/utils/storage';
import { API, createWorkshop, describeDb, ORIGIN, resetDb } from './helpers';

/** Workshop photos are stored as WebP display copies + thumbnails; older photos are converted on first view. */
const app = createApp();
const meta = (buf: Buffer) => sharp(buf).metadata();
/** A "phone photo": 2400x1600 JPEG with real detail (noise), just under the 2 MB upload limit. */
const bigPhoto = () =>
  sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#808080', noise: { type: 'gaussian', mean: 128, sigma: 18 } } })
    .jpeg({ quality: 80 })
    .toBuffer();
const photoBytes = (res: request.Response) => res.body as Buffer;

describeDb('Workshop photo variants (integration)', () => {
  beforeAll(() => resetDb());
  beforeEach(() => memoryStore.reset());
  afterAll(() => pool.end());

  const get = (url: string) => request(app).get(`${API}${url}`).buffer(true).parse((res, cb) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  it('an upload is stored as a WebP display copy (max 1600 px) plus a 640 px thumbnail', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Foto Shop' });
    const original = await bigPhoto();
    const up = await request(app).post(`${API}/workshops/photos`).set(ws.owner.auth).attach('photo', original, { filename: 'kamera.jpg', contentType: 'image/jpeg' }).expect(201);

    const full = await get(up.body.data.url).expect(200);
    expect(full.headers['content-type']).toBe('image/webp');
    expect(full.headers['cache-control']).toContain('max-age=2592000');
    const fm = await meta(photoBytes(full));
    expect([fm.format, Math.max(fm.width!, fm.height!)]).toEqual(['webp', 1600]);

    const small = await get(`${up.body.data.url}?size=sm`).expect(200);
    const sm = await meta(photoBytes(small));
    expect([sm.format, Math.max(sm.width!, sm.height!)]).toEqual(['webp', 640]);
    expect(photoBytes(small).length).toBeLessThan(photoBytes(full).length);
    expect(photoBytes(full).length).toBeLessThan(original.length);

    // The list hands the cards the cover; ?size=sm is added by the web app.
    const listed = (await request(app).get(`${API}/workshops`).query({ limit: 100 })).body.data.find((w: { id: string }) => w.id === ws.workshopId);
    expect(listed.cover_photo_url).toBe(up.body.data.url);
  });

  it('a photo uploaded before display copies existed is converted the first time it is asked for', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Foto Lama Shop' });
    const legacyKey = await saveImage('photos', await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#556677' } }).png().toBuffer(), 'image/png');
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO workshop_photos (workshop_id, path, is_cover, sort_order) VALUES ($1, $2, TRUE, 0) RETURNING id`,
      [ws.workshopId, legacyKey],
    );
    const url = `/workshops/${ws.workshopId}/photos/${rows[0].id}`;

    const [a, b] = await Promise.all([get(`${url}?size=sm`), get(url)]); // two visitors at once: converted once
    expect((await meta(photoBytes(a))).width).toBe(640);
    expect((await meta(photoBytes(b))).format).toBe('webp');
    const after = (await pool.query(`SELECT path, thumb_path, optimized FROM workshop_photos WHERE id = $1`, [rows[0].id])).rows[0];
    expect(after.optimized).toBe(true);
    expect(after.path).toMatch(/\.webp$/);
    expect(fs.existsSync(path.resolve(env.UPLOAD_DIR, legacyKey))).toBe(false); // the old PNG is gone
  });

  it('the owner sees their photos while the workshop still waits for approval; the public does not', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Menunggu Shop', status: 'PENDING' });
    const up = await request(app).post(`${API}/workshops/photos`).set(ws.owner.auth).attach('photo', await bigPhoto(), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(201);
    await get(up.body.data.url).expect(404);

    const own = await get(`/workshops/photos/${up.body.data.id}/file?size=sm`).set(ws.owner.auth).expect(200);
    expect(own.headers['cache-control']).toContain('private');
    expect((await meta(photoBytes(own))).width).toBe(640);
    await get(`/workshops/photos/${up.body.data.id}/file`).expect(401);

    const mech = ws.mechanicIds[0];
    const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#335577' } }).png().toBuffer();
    await request(app).put(`${API}/workshops/mechanics/${mech}/photo`).set(ws.owner.auth).attach('photo', png, { filename: 'm.png', contentType: 'image/png' }).expect(200);
    expect((await meta(photoBytes(await get(`/workshops/mechanics/${mech}/photo`).set(ws.owner.auth).expect(200)))).format).toBe('webp');
    await get(`/workshops/${ws.workshopId}/mechanics/${mech}/photo`).expect(404);

    // Another owner cannot read it.
    const other = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Lain Shop' });
    await get(`/workshops/photos/${up.body.data.id}/file`).set(other.owner.auth).expect(404);
  });

  it('an image that cannot be read is refused with a clear message, not a server error', async () => {
    const ws = await createWorkshop({ lat: ORIGIN.lat, lng: ORIGIN.lng, name: 'Foto Rusak Shop' });
    const broken = Buffer.concat([await sharp({ create: { width: 40, height: 40, channels: 3, background: '#000' } }).jpeg().toBuffer()]).subarray(0, 200);
    const res = await request(app).post(`${API}/workshops/photos`).set(ws.owner.auth).attach('photo', broken, { filename: 'rusak.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });
});
