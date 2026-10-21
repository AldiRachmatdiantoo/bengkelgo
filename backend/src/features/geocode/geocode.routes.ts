import { Router } from 'express';
import { geocodeLimiter } from '../../common/middlewares/rateLimiter';
import { validate } from '../../common/middlewares/validate';
import { geocodeController as c } from './geocode.controller';
import { placeSearchQuery } from './geocode.schema';

const r = Router();

// Public (the SOS page works without an account). The web app searches on Enter / "Cari" only (no type-ahead).
r.get('/search', geocodeLimiter, validate({ query: placeSearchQuery }), c.search);

export default r;
