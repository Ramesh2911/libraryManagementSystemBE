import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  unread: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  category: z
    .enum(['SYSTEM', 'PAYMENT_SUCCESS', 'FEE_REMINDER', 'ADMISSION', 'OVERDUE', 'PROMO'])
    .optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 50;
      return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 50;
    }),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const markReadSchema = z.object({
  markAll: z.boolean().optional().default(false),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
