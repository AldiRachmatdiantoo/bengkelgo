import { db, withTransaction } from '../../common/db/transaction';
import { audit } from '../../common/db/actor';
import { localNow, toMinutes } from '../../common/utils/time';
import { AppError } from '../../common/errors/AppError';
import type { AllowedImageMime } from '../../common/middlewares/upload';
import { deleteStored, readStored, saveImage } from '../../common/utils/storage';
import { MAX_WORKSHOP_PHOTOS, holidayRepository, mechanicRepository, photoRepository, photoUrl, serviceRepository, workshopRepository, type WorkshopRow } from './workshop.repository';
import type { ListWorkshopsQuery, MechanicInput, ServiceInput, UpdateMechanicInput, UpdateProfileInput, UpdateServiceInput } from './workshop.schema';
import { mechanicPhoto, workshopPhotoVariants } from '../../common/utils/photos';
import { logger } from '../../config/logger';

/** Public projection: hides internal/owner-only fields. */
export function publicWorkshop(w: WorkshopRow & { distance_meters?: number | null }) {
  const { owner_id: _o, qris_image_path, status_reason: _r, ...rest } = w;
  return { ...rest, has_qris: Boolean(qris_image_path) };
}

/** Converts an older photo to its display copy + thumbnail; null if it can't (the original is then served). */
async function optimizeStoredPhoto(workshopId: string, photoId: string) {
  try {
    let replaced: string | null = null;
    const row = await withTransaction(async (tx) => {
      const p = await photoRepository.find(tx, workshopId, photoId, true);
      if (!p || p.optimized) return p; // another request converted it meanwhile
      const { main, thumb } = await workshopPhotoVariants(await readStored(p.path));
      const key = await saveImage('photos', main, 'image/webp');
      const thumbKey = await saveImage('photos', thumb, 'image/webp');
      await photoRepository.setOptimized(tx, p.id, key, thumbKey);
      replaced = p.path;
      return { ...p, path: key, thumb_path: thumbKey, optimized: true };
    });
    if (replaced) await deleteStored(replaced);
    return row;
  } catch (err) {
    logger.warn({ err: (err as Error).message, photoId }, 'Could not convert workshop photo; serving the original');
    return null;
  }
}

/** Storage key of a workshop photo (thumbnail with size 'sm'); converts an older photo on first request. */
async function storedPhotoKey(workshopId: string, photoId: string, size?: 'sm') {
  let p = await photoRepository.find(db, workshopId, photoId);
  if (!p) throw AppError.notFound('Photo not found');
  if (!p.optimized) p = (await optimizeStoredPhoto(workshopId, photoId)) ?? p;
  return size === 'sm' && p.thumb_path ? p.thumb_path : p.path;
}

async function ownedWorkshop(ownerId: string) {
  const w = await workshopRepository.findByOwner(db, ownerId);
  if (!w) throw AppError.notFound('You have no registered workshop', 'WORKSHOP_NOT_FOUND');
  return w;
}

export const workshopService = {
  ownedWorkshop,

  async myWorkshop(ownerId: string) {
    const w = await ownedWorkshop(ownerId);
    const { qris_image_path, ...rest } = w;
    return { ...rest, has_qris: Boolean(qris_image_path) };
  },

  async updateProfile(ownerId: string, patch: UpdateProfileInput) {
    const w = await ownedWorkshop(ownerId);
    const updated = await workshopRepository.update(db, w.id, patch);
    return publicWorkshop(updated!);
  },

  async uploadQris(ownerId: string, file: { buffer: Buffer; mimetype: string }) {
    const w = await ownedWorkshop(ownerId);
    const key = await saveImage('qris', file.buffer, file.mimetype as AllowedImageMime);
    try {
      await workshopRepository.setQris(db, w.id, key);
    } catch (err) {
      await deleteStored(key);
      throw err;
    }
    await deleteStored(w.qris_image_path);
    // The QRIS decides where customers' money goes, so every change is audited.
    await audit(db, { id: ownerId, role: 'WORKSHOP_OWNER' }, { action: w.qris_image_path ? 'QRIS_REPLACED' : 'QRIS_UPLOADED', entity: 'workshop', entityId: w.id });
    return { has_qris: true };
  },

  // ---------- public ----------
  async list(q: ListWorkshopsQuery) {
    if (q.date && q.time_slot) {
      const now = localNow();
      if (q.date < now.date || (q.date === now.date && toMinutes(q.time_slot) <= now.minutes)) {
        throw AppError.unprocessable('That slot has already started', 'SLOT_ALREADY_STARTED');
      }
    }
    const rows = await workshopRepository.listApproved(db, {
      lat: q.latitude,
      lng: q.longitude,
      radiusMeters: q.radius_km * 1000,
      vehicleType: q.vehicle_type,
      search: q.search,
      sort: q.sort,
      slot: q.date && q.time_slot ? { date: q.date, time: q.time_slot } : undefined,
      limit: q.limit,
      offset: (q.page - 1) * q.limit,
    });
    // Cover photo for the workshop cards (null: the card shows its illustration instead).
    return rows.map(({ cover_photo_id, ...w }) => ({ ...publicWorkshop(w), cover_photo_url: cover_photo_id ? photoUrl(w.id, cover_photo_id) : null }));
  },

  async detail(id: string) {
    const w = await workshopRepository.findById(db, id);
    if (!w || w.status !== 'APPROVED') throw AppError.notFound('Workshop not found');
    const [services, mechanics, photos] = await Promise.all([serviceRepository.list(db, id, true), mechanicRepository.list(db, id, true), photoRepository.list(db, id)]);
    return {
      ...publicWorkshop(w),
      services,
      mechanics: mechanics.map(({ phone: _p, workshop_id: _w, ...m }) => ({ ...m, photo_url: m.has_photo ? `/workshops/${id}/mechanics/${m.id}/photo` : null })),
      photos: photos.map((p) => ({ id: p.id, is_cover: p.is_cover, url: photoUrl(id, p.id) })),
    };
  },

  // ---------- services ----------
  async listServices(ownerId: string) {
    return serviceRepository.list(db, (await ownedWorkshop(ownerId)).id, false);
  },
  async createService(ownerId: string, s: ServiceInput) {
    const w = await ownedWorkshop(ownerId);
    if (!w.vehicle_types.includes(s.vehicle_type)) {
      throw AppError.unprocessable(`Workshop does not serve ${s.vehicle_type}`, 'VEHICLE_TYPE_NOT_SUPPORTED');
    }
    return serviceRepository.create(db, w.id, s);
  },
  async updateService(ownerId: string, id: string, s: UpdateServiceInput) {
    const w = await ownedWorkshop(ownerId);
    const row = await serviceRepository.update(db, w.id, id, s);
    if (!row) throw AppError.notFound('Service not found');
    return row;
  },
  async deleteService(ownerId: string, id: string) {
    const w = await ownedWorkshop(ownerId);
    if (!(await serviceRepository.softDelete(db, w.id, id))) throw AppError.notFound('Service not found');
    await audit(db, { id: ownerId, role: 'WORKSHOP_OWNER' }, { action: 'SERVICE_DELETED', entity: 'service', entityId: id });
    return { id, deleted: true };
  },

  // ---------- holidays (item 16) ----------
  async listHolidays(ownerId: string, from?: string, to?: string) {
    return holidayRepository.list(db, (await ownedWorkshop(ownerId)).id, from, to);
  },
  async addHoliday(ownerId: string, date: string, note?: string) {
    if (date < localNow().date) throw AppError.unprocessable('Holiday date is in the past', 'DATE_IN_PAST');
    return holidayRepository.add(db, (await ownedWorkshop(ownerId)).id, date, note);
  },
  async removeHoliday(ownerId: string, id: string) {
    if (!(await holidayRepository.remove(db, (await ownedWorkshop(ownerId)).id, id))) throw AppError.notFound('Holiday not found');
    return { id, deleted: true };
  },

  // ---------- photos (item 19) ----------
  async listPhotos(ownerId: string) {
    const w = await ownedWorkshop(ownerId);
    return (await photoRepository.list(db, w.id)).map((p) => ({ id: p.id, is_cover: p.is_cover, sort_order: p.sort_order, url: photoUrl(w.id, p.id) }));
  },
  async addPhoto(ownerId: string, file: { buffer: Buffer; mimetype: string }) {
    const w = await ownedWorkshop(ownerId);
    // Stored as WebP: a display copy (max 1600 px) and a thumbnail (640 px) for the workshop cards.
    const { main, thumb } = await workshopPhotoVariants(file.buffer);
    const key = await saveImage('photos', main, 'image/webp');
    const thumbKey = await saveImage('photos', thumb, 'image/webp').catch(async (err) => {
      await deleteStored(key);
      throw err;
    });
    try {
      return await withTransaction(async (tx) => {
        await tx.query('SELECT id FROM workshops WHERE id = $1 FOR UPDATE', [w.id]); // serialise the count check
        const n = await photoRepository.count(tx, w.id);
        if (n >= MAX_WORKSHOP_PHOTOS) throw AppError.unprocessable(`At most ${MAX_WORKSHOP_PHOTOS} photos per workshop`, 'PHOTO_LIMIT');
        const row = await photoRepository.add(tx, w.id, key, thumbKey, n === 0);
        return { ...row, url: photoUrl(w.id, row.id) };
      });
    } catch (err) {
      await Promise.all([deleteStored(key), deleteStored(thumbKey)]);
      throw err;
    }
  },
  async setCoverPhoto(ownerId: string, id: string) {
    const w = await ownedWorkshop(ownerId);
    return withTransaction(async (tx) => {
      if (!(await photoRepository.find(tx, w.id, id))) throw AppError.notFound('Photo not found');
      await photoRepository.setCover(tx, w.id, id);
      return { id, is_cover: true };
    });
  },
  async removePhoto(ownerId: string, id: string) {
    const w = await ownedWorkshop(ownerId);
    const removed = await withTransaction(async (tx) => {
      const r = await photoRepository.remove(tx, w.id, id);
      if (!r) throw AppError.notFound('Photo not found');
      if (r.is_cover) await photoRepository.setCover(tx, w.id, null);
      return r;
    });
    await Promise.all([deleteStored(removed.path), deleteStored(removed.thumb_path)]);
    return { id, deleted: true };
  },
  /**
   * Public image of an APPROVED workshop: the display copy, or the thumbnail with size 'sm'. Photos uploaded
   * before display copies existed are converted the first time they are asked for (once, under a row lock).
   */
  async photoFile(workshopId: string, photoId: string, size?: 'sm') {
    const w = await workshopRepository.findById(db, workshopId);
    if (!w || w.status !== 'APPROVED') throw AppError.notFound('Photo not found');
    return storedPhotoKey(workshopId, photoId, size);
  },
  /** The owner's own photo, whatever the workshop's status (e.g. while waiting for approval). */
  async ownPhotoFile(ownerId: string, photoId: string, size?: 'sm') {
    return storedPhotoKey((await ownedWorkshop(ownerId)).id, photoId, size);
  },
  async setMechanicPhoto(ownerId: string, mechanicId: string, file: { buffer: Buffer; mimetype: string } | null) {
    const w = await ownedWorkshop(ownerId);
    // A small WebP portrait is all the app ever shows.
    const key = file ? await saveImage('photos', await mechanicPhoto(file.buffer), 'image/webp') : null;
    const prev = await mechanicRepository.setPhoto(db, w.id, mechanicId, key).catch(async (err) => {
      await deleteStored(key);
      throw err;
    });
    if (!prev) {
      await deleteStored(key);
      throw AppError.notFound('Mechanic not found');
    }
    await deleteStored(prev.old);
    return { id: mechanicId, has_photo: Boolean(key) };
  },
  async ownMechanicPhotoFile(ownerId: string, mechanicId: string) {
    const m = await mechanicRepository.photoPath(db, (await ownedWorkshop(ownerId)).id, mechanicId);
    if (!m?.photo_path) throw AppError.notFound('Photo not found');
    return m.photo_path;
  },
  async mechanicPhotoFile(workshopId: string, mechanicId: string) {
    const w = await workshopRepository.findById(db, workshopId);
    const m = w && w.status === 'APPROVED' ? await mechanicRepository.photoPath(db, workshopId, mechanicId) : null;
    if (!m?.photo_path) throw AppError.notFound('Photo not found');
    return m.photo_path;
  },

  // ---------- mechanics ----------
  async listMechanics(ownerId: string) {
    return mechanicRepository.list(db, (await ownedWorkshop(ownerId)).id, false);
  },
  async createMechanic(ownerId: string, m: MechanicInput) {
    const w = await ownedWorkshop(ownerId);
    return mechanicRepository.create(db, w.id, { ...m, specializations: [...new Set(m.specializations.map((t) => t.toLowerCase()))] });
  },
  async updateMechanic(ownerId: string, id: string, m: UpdateMechanicInput) {
    const w = await ownedWorkshop(ownerId);
    const specializations = m.specializations ? [...new Set(m.specializations.map((t) => t.toLowerCase()))] : undefined;
    const row = await mechanicRepository.update(db, w.id, id, { ...m, specializations });
    if (!row) throw AppError.notFound('Mechanic not found');
    return row;
  },
  /** Soft delete: keeps history/reviews intact. */
  async deactivateMechanic(ownerId: string, id: string) {
    return this.updateMechanic(ownerId, id, { is_active: false });
  },
};
