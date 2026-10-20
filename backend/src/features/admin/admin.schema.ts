import { z } from 'zod';
import { email, isoDate, pagination, password, phoneId, safeText } from '../../common/middlewares/validate';
import { addDays, localNow } from '../../common/utils/time';

export const listWorkshopsAdminQuery = pagination.extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']).optional() });
export const approvalSchema = z.object({ action: z.enum(['APPROVE', 'REJECT', 'SUSPEND']), reason: safeText(500).optional() });
/** Defaults to the last 30 days (business timezone). */
export const reportQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional(), workshop_id: z.uuid().optional() })
  .transform((q) => {
    const today = localNow().date;
    return { ...q, from: q.from ?? addDays(today, -30), to: q.to ?? today };
  })
  .refine((q) => q.from <= q.to, { message: 'from must be on or before to', path: ['from'] });
export const searchQuery = z.object({ q: safeText(100).pipe(z.string().min(2)) });
export const auditQuery = pagination.extend({
  entity: z.enum(['order', 'workshop', 'service', 'user']).optional(),
  entity_id: z.uuid().optional(),
  actor_id: z.uuid().optional(),
  action: z.string().regex(/^[A-Z_]{3,60}$/).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

// ---------- BE-15: access management ----------
export const usersQuery = pagination.extend({
  role: z.enum(['CUSTOMER', 'GUEST', 'WORKSHOP_OWNER', 'ADMIN']).optional(),
  q: safeText(100).optional(),
  active: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? undefined : v === 'true')),
});
export const activeSchema = z.object({ active: z.boolean(), reason: safeText(300).optional() });
export const adminSchema = z.object({ name: safeText(100).pipe(z.string().min(2)), email, phone: phoneId.optional(), password });

export type ListWorkshopsAdminQuery = z.infer<typeof listWorkshopsAdminQuery>;
export type ApprovalInput = z.infer<typeof approvalSchema>;
export type ReportQuery = z.infer<typeof reportQuery>;
export type SearchQuery = z.infer<typeof searchQuery>;
export type AuditQuery = z.infer<typeof auditQuery>;
export type UsersQuery = z.infer<typeof usersQuery>;
export type ActiveInput = z.infer<typeof activeSchema>;
export type CreateAdminInput = z.infer<typeof adminSchema>;
