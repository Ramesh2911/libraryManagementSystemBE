import { z } from 'zod';

export const createRoomTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional()
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial();
