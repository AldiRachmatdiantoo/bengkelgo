import { Router } from 'express';
import { authenticate, authorize } from '../../common/middlewares/auth';
import { imageUpload } from '../../common/middlewares/upload';
import { pagination, uuidParam, validate } from '../../common/middlewares/validate';
import { availabilityQuery, slotCapacitySchema } from '../booking/booking.schema';
import { workshopController as c } from './workshop.controller';
import {
  holidayQuery,
  holidaySchema,
  listWorkshopsQuery,
  mechanicPhotoParams,
  mechanicSchema,
  nextSlotQuery,
  ownerStatsQuery,
  photoParams,
  replySchema,
  serviceSchema,
  updateMechanicSchema,
  updateProfileSchema,
  updateServiceSchema,
} from './workshop.schema';

const r = Router();
const owner = [authenticate, authorize('WORKSHOP_OWNER')];
const idParam = { params: uuidParam('id') };

// ---------- Owner portal (static paths first so they never match /:id) ----------
r.get('/me', ...owner, c.myWorkshop);
r.put('/profile', ...owner, validate({ body: updateProfileSchema }), c.updateProfile);
r.put('/qris', ...owner, imageUpload('qris'), c.uploadQris);

r.get('/services', ...owner, c.listServices);
r.post('/services', ...owner, validate({ body: serviceSchema }), c.createService);
r.patch('/services/:id', ...owner, validate({ ...idParam, body: updateServiceSchema }), c.updateService);
r.delete('/services/:id', ...owner, validate(idParam), c.deleteService);

r.get('/holidays', ...owner, validate({ query: holidayQuery }), c.listHolidays);
r.post('/holidays', ...owner, validate({ body: holidaySchema }), c.addHoliday);
r.delete('/holidays/:id', ...owner, validate(idParam), c.removeHoliday);

r.get('/photos', ...owner, c.listPhotos);
r.post('/photos', ...owner, imageUpload('photo'), c.addPhoto);
r.patch('/photos/:id/cover', ...owner, validate(idParam), c.setCoverPhoto);
r.delete('/photos/:id', ...owner, validate(idParam), c.removePhoto);
r.put('/mechanics/:id/photo', ...owner, validate(idParam), imageUpload('photo'), c.setMechanicPhoto);
r.delete('/mechanics/:id/photo', ...owner, validate(idParam), c.removeMechanicPhoto);

r.get('/me/stats', ...owner, validate({ query: ownerStatsQuery }), c.myStats);
r.get('/me/reviews', ...owner, validate({ query: pagination }), c.myReviews);
r.put('/reviews/:id/reply', ...owner, validate({ ...idParam, body: replySchema }), c.replyToReview);
r.delete('/reviews/:id/reply', ...owner, validate(idParam), c.removeReviewReply);

r.get('/mechanics', ...owner, c.listMechanics);
r.post('/mechanics', ...owner, validate({ body: mechanicSchema }), c.createMechanic);
r.patch('/mechanics/:id', ...owner, validate({ ...idParam, body: updateMechanicSchema }), c.updateMechanic);
r.delete('/mechanics/:id', ...owner, validate(idParam), c.deactivateMechanic);

r.get('/quotas', ...owner, validate({ query: availabilityQuery }), c.myQuotas);
r.put('/quotas', ...owner, validate({ body: slotCapacitySchema }), c.setSlotCapacity);

// ---------- Public ----------
r.get('/', validate({ query: listWorkshopsQuery }), c.list);
r.get('/:id', validate(idParam), c.detail);
r.get('/:id/availability', validate({ ...idParam, query: availabilityQuery }), c.availability);
r.get('/:id/next-slot', validate({ ...idParam, query: nextSlotQuery }), c.nextSlot);
r.get('/:id/photos/:photoId', validate({ params: photoParams }), c.photo);
r.get('/:id/mechanics/:mechanicId/photo', validate({ params: mechanicPhotoParams }), c.mechanicPhoto);
r.get('/:id/reviews', validate({ ...idParam, query: pagination }), c.reviews);

export default r;
