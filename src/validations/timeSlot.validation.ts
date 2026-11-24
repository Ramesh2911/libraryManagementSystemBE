import { z } from 'zod';
import { uuidField } from './common';

export const createTimeSlotSchema = z.object({
  library_id: uuidField(),
  name: z.string().min(1, "Name is required"),
  start_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Invalid time format (HH:MM)"),
  end_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Invalid time format (HH:MM)"),
  status: z.enum(['active', 'inactive']).optional()
});

export const updateTimeSlotSchema = createTimeSlotSchema.partial();
