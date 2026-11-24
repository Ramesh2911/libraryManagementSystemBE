import { z } from 'zod';

export const createFeePlanSchema = z.object({
  library_id: z.string().uuid("Invalid library ID"),
  name: z.string().min(1, "Name is required"),
  billing_period: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'CUSTOM']),
  amount: z.number().positive("Amount must be positive"),
  admission_fee: z.number().min(0).default(0),
  status: z.enum(['active', 'inactive']).optional(),
  effective_from: z.string().datetime().optional(),
  effective_to: z.string().datetime().optional()
});

export const updateFeePlanSchema = createFeePlanSchema.partial();
