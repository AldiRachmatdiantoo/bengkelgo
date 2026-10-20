import type { Request, Response } from 'express';
import { ok } from '../../common/utils/http';
import { statsService } from './stats.service';

export const statsController = {
  /** Public platform numbers for the landing page (cached ~5 minutes per instance). */
  async publicStats(_req: Request, res: Response) {
    ok(res, await statsService.publicStats());
  },
};
