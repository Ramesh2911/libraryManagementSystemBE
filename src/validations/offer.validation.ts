import { z } from 'zod';
import { uuidField } from './common';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .optional();

export const createOfferSchema = z.object({
  library_id: uuidField().optional().nullable(),
  tag: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  discount_label: z.string().optional().nullable(),
  original_price: z.number().min(0),
  discounted_price: z.number().min(0),
  discount_percentage: z.number().int().min(0).max(100).optional().nullable(),
  currency: z.string().optional(),
  billing_cycle: z.string().optional().nullable(),
  action_label: z.string().optional().nullable(),
  action_route: z.string().optional().nullable(),
  is_visible: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  start_date: dateString,
  end_date: dateString,
  expires_at: z.string().datetime({ offset: true }).or(z.string().datetime()).optional().nullable(),
});

export const updateOfferSchema = createOfferSchema.partial();

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const listActiveOffersQuerySchema = z.object({
  libraryId: uuidField().optional(),
});

export type ListActiveOffersQuery = z.infer<typeof listActiveOffersQuerySchema>;

export const offerActionSchema = z.object({
  action: z.enum(['viewed', 'clicked', 'dismiss']),
  clientTimestamp: z.string().optional(),
});

export type OfferActionInput = z.infer<typeof offerActionSchema>;
