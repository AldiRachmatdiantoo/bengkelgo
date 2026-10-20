import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize, currentUser } from '../../common/middlewares/auth';
import { imageUpload } from '../../common/middlewares/upload';
import { input, isoDate, pagination, uuidParam, validate } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import { sendStored } from '../../common/utils/storage';
import { availabilityQuery, slotCapacitySchema } from '../booking/booking.schema';
import { bookingService } from '../booking/booking.service';
import { reviewService } from '../review/review.service';
import { statsService } from '../stats/stats.service';
import {
  listWorkshopsQuery,
  holidayQuery,
  holidaySchema,
  mechanicSchema,
  nextSlotQuery,
  replySchema,
  serviceSchema,
  updateMechanicSchema,
  updateProfileSchema,
  updateServiceSchema,
  type ListWorkshopsQuery,
  type MechanicInput,
  type ServiceInput,
  type UpdateMechanicInput,
  type UpdateProfileInput,
  type UpdateServiceInput,
} from './workshop.schema';
import { workshopService as s } from './workshop.service';

const r = Router();
const owner = [authenticate, authorize('WORKSHOP_OWNER')];
const uid = (req: Request) => currentUser(req).id;
const idParam = { params: uuidParam('id') };

// ---------- Owner portal (static paths first so they never match /:id) ----------
r.get('/me', ...owner, async (req: Request, res: Response) => {
  ok(res, await s.myWorkshop(uid(req)));
});

r.put('/profile', ...owner, validate({ body: updateProfileSchema }), async (req: Request, res: Response) => {
  ok(res, await s.updateProfile(uid(req), input<UpdateProfileInput>(req).body));
});

r.put('/qris', ...owner, imageUpload('qris'), async (req: Request, res: Response) => {
  ok(res, await s.uploadQris(uid(req), req.file!));
});

r.get('/services', ...owner, async (req: Request, res: Response) => {
  ok(res, await s.listServices(uid(req)));
});
r.post('/services', ...owner, validate({ body: serviceSchema }), async (req: Request, res: Response) => {
  created(res, await s.createService(uid(req), input<ServiceInput>(req).body));
});
r.patch('/services/:id', ...owner, validate({ ...idParam, body: updateServiceSchema }), async (req: Request, res: Response) => {
  const { body, params } = input<UpdateServiceInput, unknown, { id: string }>(req);
  ok(res, await s.updateService(uid(req), params.id, body));
});

r.delete('/services/:id', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.deleteService(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
});

// Holidays (item 16): weekly closed days and the daily break are part of PUT /profile.
r.get('/holidays', ...owner, validate({ query: holidayQuery }), async (req: Request, res: Response) => {
  const { from, to } = input<unknown, { from?: string; to?: string }>(req).query;
  ok(res, await s.listHolidays(uid(req), from, to));
});
r.post('/holidays', ...owner, validate({ body: holidaySchema }), async (req: Request, res: Response) => {
  const { date, note } = input<{ date: string; note?: string }>(req).body;
  created(res, await s.addHoliday(uid(req), date, note));
});
r.delete('/holidays/:id', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.removeHoliday(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
});

// Photos (item 19)
r.get('/photos', ...owner, async (req: Request, res: Response) => {
  ok(res, await s.listPhotos(uid(req)));
});
r.post('/photos', ...owner, imageUpload('photo'), async (req: Request, res: Response) => {
  created(res, await s.addPhoto(uid(req), req.file!));
});
r.patch('/photos/:id/cover', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.setCoverPhoto(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
});
r.delete('/photos/:id', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.removePhoto(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
});
r.put('/mechanics/:id/photo', ...owner, validate(idParam), imageUpload('photo'), async (req: Request, res: Response) => {
  ok(res, await s.setMechanicPhoto(uid(req), input<unknown, unknown, { id: string }>(req).params.id, req.file!));
});
r.delete('/mechanics/:id/photo', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.setMechanicPhoto(uid(req), input<unknown, unknown, { id: string }>(req).params.id, null));
});

r.get('/me/stats', ...owner, validate({ query: z.object({ date: isoDate.optional() }) }), async (req: Request, res: Response) => {
  ok(res, await statsService.ownerStats(uid(req), input<unknown, { date?: string }>(req).query.date));
});

r.get('/me/reviews', ...owner, validate({ query: pagination }), async (req: Request, res: Response) => {
  const w = await s.ownedWorkshop(uid(req));
  const { page, limit } = input<unknown, { page: number; limit: number }>(req).query;
  ok(res, await reviewService.listForWorkshop(w.id, page, limit));
});
r.put('/reviews/:id/reply', ...owner, validate({ ...idParam, body: replySchema }), async (req: Request, res: Response) => {
  const w = await s.ownedWorkshop(uid(req));
  const { params, body } = input<{ reply: string }, unknown, { id: string }>(req);
  ok(res, await reviewService.reply(w.id, params.id, body.reply));
});
r.delete('/reviews/:id/reply', ...owner, validate(idParam), async (req: Request, res: Response) => {
  const w = await s.ownedWorkshop(uid(req));
  ok(res, await reviewService.reply(w.id, input<unknown, unknown, { id: string }>(req).params.id, null));
});

r.get('/mechanics', ...owner, async (req: Request, res: Response) => {
  ok(res, await s.listMechanics(uid(req)));
});
r.post('/mechanics', ...owner, validate({ body: mechanicSchema }), async (req: Request, res: Response) => {
  created(res, await s.createMechanic(uid(req), input<MechanicInput>(req).body));
});
r.patch('/mechanics/:id', ...owner, validate({ ...idParam, body: updateMechanicSchema }), async (req: Request, res: Response) => {
  const { body, params } = input<UpdateMechanicInput, unknown, { id: string }>(req);
  ok(res, await s.updateMechanic(uid(req), params.id, body));
});
r.delete('/mechanics/:id', ...owner, validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.deactivateMechanic(uid(req), input<unknown, unknown, { id: string }>(req).params.id));
});

r.get('/quotas', ...owner, validate({ query: availabilityQuery }), async (req: Request, res: Response) => {
  const w = await s.ownedWorkshop(uid(req));
  ok(res, await bookingService.availability(w.id, input<unknown, { date: string }>(req).query.date));
});
r.put('/quotas', ...owner, validate({ body: slotCapacitySchema }), async (req: Request, res: Response) => {
  const b = input<z.infer<typeof slotCapacitySchema>>(req).body;
  ok(res, await bookingService.setSlotCapacity(uid(req), b.date, b.time_slot, b.max_slot_per_hour));
});

// ---------- Public ----------
r.get('/', validate({ query: listWorkshopsQuery }), async (req: Request, res: Response) => {
  ok(res, await s.list(input<unknown, ListWorkshopsQuery>(req).query));
});
r.get('/:id', validate(idParam), async (req: Request, res: Response) => {
  ok(res, await s.detail(input<unknown, unknown, { id: string }>(req).params.id));
});
r.get('/:id/availability', validate({ ...idParam, query: availabilityQuery }), async (req: Request, res: Response) => {
  const { params, query } = input<unknown, { date: string }, { id: string }>(req);
  ok(res, await bookingService.availability(params.id, query.date));
});
r.get('/:id/next-slot', validate({ ...idParam, query: nextSlotQuery }), async (req: Request, res: Response) => {
  const { params, query } = input<unknown, { from?: string }, { id: string }>(req);
  ok(res, await bookingService.nextAvailableSlot(params.id, query.from));
});

// Public images: other sites (the web app on its own domain) may embed them.
const publicImage = async (res: Response, key: string) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  await sendStored(res, key);
};
r.get('/:id/photos/:photoId', validate({ params: z.object({ id: z.uuid(), photoId: z.uuid() }) }), async (req: Request, res: Response) => {
  const { id, photoId } = input<unknown, unknown, { id: string; photoId: string }>(req).params;
  await publicImage(res, await s.photoFile(id, photoId));
});
r.get('/:id/mechanics/:mechanicId/photo', validate({ params: z.object({ id: z.uuid(), mechanicId: z.uuid() }) }), async (req: Request, res: Response) => {
  const { id, mechanicId } = input<unknown, unknown, { id: string; mechanicId: string }>(req).params;
  await publicImage(res, await s.mechanicPhotoFile(id, mechanicId));
});

r.get('/:id/reviews', validate({ ...idParam, query: pagination }), async (req: Request, res: Response) => {
  const { params, query } = input<unknown, { page: number; limit: number }, { id: string }>(req);
  ok(res, await reviewService.listForWorkshop(params.id, query.page, query.limit));
});

export default r;
