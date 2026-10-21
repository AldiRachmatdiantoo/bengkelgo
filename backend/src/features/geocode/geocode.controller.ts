import type { Request, Response } from 'express';
import { input } from '../../common/middlewares/validate';
import { ok } from '../../common/utils/http';
import type { PlaceSearchQuery, ReverseQuery } from './geocode.schema';
import { geocodeService } from './geocode.service';

export const geocodeController = {
  async search(req: Request, res: Response) {
    ok(res, await geocodeService.search(input<unknown, PlaceSearchQuery>(req).query));
  },
  async reverse(req: Request, res: Response) {
    ok(res, await geocodeService.reverse(input<unknown, ReverseQuery>(req).query));
  },
};
