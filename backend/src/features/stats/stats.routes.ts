import { Router, type Request, type Response } from 'express';
import { ok } from '../../common/utils/http';
import { statsService } from './stats.service';

const r = Router();

/** Public platform numbers for the landing page (cached ~5 minutes per instance). */
r.get('/public', async (_req: Request, res: Response) => {
  ok(res, await statsService.publicStats());
});

export default r;
