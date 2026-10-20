import type { Request, Response } from 'express';
import { currentUser } from '../../common/middlewares/auth';
import { input } from '../../common/middlewares/validate';
import { created, ok } from '../../common/utils/http';
import { sendStored } from '../../common/utils/storage';
import type { SlotCapacityInput } from '../booking/booking.schema';
import { bookingService } from '../booking/booking.service';
import { reviewService } from '../review/review.service';
import { statsService } from '../stats/stats.service';
import type {
  HolidayInput,
  ListWorkshopsQuery,
  MechanicInput,
  ReplyInput,
  ServiceInput,
  UpdateMechanicInput,
  UpdateProfileInput,
  UpdateServiceInput,
} from './workshop.schema';
import { workshopService as s } from './workshop.service';

type IdParams = { id: string };
type Page = { page: number; limit: number };
const uid = (req: Request) => currentUser(req).id;
const idOf = (req: Request) => input<unknown, unknown, IdParams>(req).params.id;

/** Public images: other sites (the web app on its own domain) may embed them. */
async function publicImage(res: Response, key: string) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  await sendStored(res, key);
}

export const workshopController = {
  // ---------- Owner portal ----------
  async myWorkshop(req: Request, res: Response) {
    ok(res, await s.myWorkshop(uid(req)));
  },

  async updateProfile(req: Request, res: Response) {
    ok(res, await s.updateProfile(uid(req), input<UpdateProfileInput>(req).body));
  },

  async uploadQris(req: Request, res: Response) {
    ok(res, await s.uploadQris(uid(req), req.file!));
  },

  async listServices(req: Request, res: Response) {
    ok(res, await s.listServices(uid(req)));
  },

  async createService(req: Request, res: Response) {
    created(res, await s.createService(uid(req), input<ServiceInput>(req).body));
  },

  async updateService(req: Request, res: Response) {
    const { body, params } = input<UpdateServiceInput, unknown, IdParams>(req);
    ok(res, await s.updateService(uid(req), params.id, body));
  },

  async deleteService(req: Request, res: Response) {
    ok(res, await s.deleteService(uid(req), idOf(req)));
  },

  /** Holidays (item 16): weekly closed days and the daily break are part of PUT /profile. */
  async listHolidays(req: Request, res: Response) {
    const { from, to } = input<unknown, { from?: string; to?: string }>(req).query;
    ok(res, await s.listHolidays(uid(req), from, to));
  },

  async addHoliday(req: Request, res: Response) {
    const { date, note } = input<HolidayInput>(req).body;
    created(res, await s.addHoliday(uid(req), date, note));
  },

  async removeHoliday(req: Request, res: Response) {
    ok(res, await s.removeHoliday(uid(req), idOf(req)));
  },

  // Photos (item 19)
  async listPhotos(req: Request, res: Response) {
    ok(res, await s.listPhotos(uid(req)));
  },

  async addPhoto(req: Request, res: Response) {
    created(res, await s.addPhoto(uid(req), req.file!));
  },

  async setCoverPhoto(req: Request, res: Response) {
    ok(res, await s.setCoverPhoto(uid(req), idOf(req)));
  },

  async removePhoto(req: Request, res: Response) {
    ok(res, await s.removePhoto(uid(req), idOf(req)));
  },

  async setMechanicPhoto(req: Request, res: Response) {
    ok(res, await s.setMechanicPhoto(uid(req), idOf(req), req.file!));
  },

  async removeMechanicPhoto(req: Request, res: Response) {
    ok(res, await s.setMechanicPhoto(uid(req), idOf(req), null));
  },

  async myStats(req: Request, res: Response) {
    ok(res, await statsService.ownerStats(uid(req), input<unknown, { date?: string }>(req).query.date));
  },

  async myReviews(req: Request, res: Response) {
    const w = await s.ownedWorkshop(uid(req));
    const { page, limit } = input<unknown, Page>(req).query;
    ok(res, await reviewService.listForWorkshop(w.id, page, limit));
  },

  async replyToReview(req: Request, res: Response) {
    const w = await s.ownedWorkshop(uid(req));
    const { params, body } = input<ReplyInput, unknown, IdParams>(req);
    ok(res, await reviewService.reply(w.id, params.id, body.reply));
  },

  async removeReviewReply(req: Request, res: Response) {
    const w = await s.ownedWorkshop(uid(req));
    ok(res, await reviewService.reply(w.id, idOf(req), null));
  },

  async listMechanics(req: Request, res: Response) {
    ok(res, await s.listMechanics(uid(req)));
  },

  async createMechanic(req: Request, res: Response) {
    created(res, await s.createMechanic(uid(req), input<MechanicInput>(req).body));
  },

  async updateMechanic(req: Request, res: Response) {
    const { body, params } = input<UpdateMechanicInput, unknown, IdParams>(req);
    ok(res, await s.updateMechanic(uid(req), params.id, body));
  },

  async deactivateMechanic(req: Request, res: Response) {
    ok(res, await s.deactivateMechanic(uid(req), idOf(req)));
  },

  async myQuotas(req: Request, res: Response) {
    const w = await s.ownedWorkshop(uid(req));
    ok(res, await bookingService.availability(w.id, input<unknown, { date: string }>(req).query.date));
  },

  async setSlotCapacity(req: Request, res: Response) {
    const b = input<SlotCapacityInput>(req).body;
    ok(res, await bookingService.setSlotCapacity(uid(req), b.date, b.time_slot, b.max_slot_per_hour));
  },

  // ---------- Public ----------
  async list(req: Request, res: Response) {
    ok(res, await s.list(input<unknown, ListWorkshopsQuery>(req).query));
  },

  async detail(req: Request, res: Response) {
    ok(res, await s.detail(idOf(req)));
  },

  async availability(req: Request, res: Response) {
    const { params, query } = input<unknown, { date: string }, IdParams>(req);
    ok(res, await bookingService.availability(params.id, query.date));
  },

  async nextSlot(req: Request, res: Response) {
    const { params, query } = input<unknown, { from?: string }, IdParams>(req);
    ok(res, await bookingService.nextAvailableSlot(params.id, query.from));
  },

  async photo(req: Request, res: Response) {
    const { id, photoId } = input<unknown, unknown, { id: string; photoId: string }>(req).params;
    await publicImage(res, await s.photoFile(id, photoId));
  },

  async mechanicPhoto(req: Request, res: Response) {
    const { id, mechanicId } = input<unknown, unknown, { id: string; mechanicId: string }>(req).params;
    await publicImage(res, await s.mechanicPhotoFile(id, mechanicId));
  },

  async reviews(req: Request, res: Response) {
    const { params, query } = input<unknown, Page, IdParams>(req);
    ok(res, await reviewService.listForWorkshop(params.id, query.page, query.limit));
  },
};
