import { z } from 'zod';

export const createFloorSchema = z.object({
  library_id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  status: z.enum(['active', 'inactive']).optional()
});

export const updateFloorSchema = createFloorSchema.partial();
