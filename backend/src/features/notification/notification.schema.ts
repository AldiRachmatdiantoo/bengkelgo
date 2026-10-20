import { z } from 'zod';
import { pagination } from '../../common/middlewares/validate';

export const listNotificationsQuery = pagination.extend({ unread_only: z.enum(['true', 'false']).optional().transform((v) => v === 'true') });
/** { ids: [...] } marks those as read; an empty body marks all as read. */
export const markReadSchema = z.object({ ids: z.array(z.uuid()).max(200).optional() });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
