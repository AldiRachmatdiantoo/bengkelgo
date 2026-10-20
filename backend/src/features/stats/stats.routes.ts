import { Router } from 'express';
import { statsController as c } from './stats.controller';

const r = Router();

r.get('/public', c.publicStats);

export default r;
