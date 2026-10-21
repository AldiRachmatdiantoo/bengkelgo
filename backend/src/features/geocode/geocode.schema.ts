import { z } from 'zod';
import { latitude, longitude, safeText } from '../../common/middlewares/validate';

/** Place search for the location boxes (area, street, landmark). Optional lat/lng biases results nearby. */
export const placeSearchQuery = z.object({
  q: safeText(100).pipe(z.string().min(3, 'Type at least 3 characters')),
  limit: z.coerce.number().int().min(1).max(8).default(6),
  lat: latitude.optional(),
  lng: longitude.optional(),
});

export type PlaceSearchQuery = z.infer<typeof placeSearchQuery>;
