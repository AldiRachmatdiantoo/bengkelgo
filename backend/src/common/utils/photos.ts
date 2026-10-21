import sharp from 'sharp';
import { AppError } from '../errors/AppError';

/**
 * Display copies of uploaded photos: WebP, never wider/taller than needed, metadata (incl. GPS) dropped.
 * A 4 MB phone photo becomes ~150 KB for the detail page and ~30 KB for a workshop card.
 */
const webp = (input: Buffer, maxSide: number, quality: number) =>
  sharp(input, { failOn: 'error' })
    .rotate() // honour the camera orientation before the EXIF data is dropped
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
    // Right header, broken picture (e.g. a cut-off upload): a clear 400 instead of a server error.
    .catch(() => {
      throw AppError.badRequest('The image could not be read', 'INVALID_FILE_TYPE');
    });

/** Workshop photo: the full view (detail page) and a thumbnail (cards, gallery strip). */
export async function workshopPhotoVariants(input: Buffer) {
  const [main, thumb] = await Promise.all([webp(input, 1600, 80), webp(input, 640, 72)]);
  return { main, thumb };
}

/** Mechanic photo: only ever shown as a small portrait. */
export const mechanicPhoto = (input: Buffer) => webp(input, 480, 78);
