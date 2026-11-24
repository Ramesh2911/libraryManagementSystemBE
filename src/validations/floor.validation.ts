import { z } from 'zod';
import { uuidField } from './common';

export const createFloorSchema = z.object({
  library_id: uuidField(),
  name: z.string().min(1, "Name is required"),
  status: z.enum(['active', 'inactive']).optional()
});

export const updateFloorSchema = createFloorSchema.partial();
