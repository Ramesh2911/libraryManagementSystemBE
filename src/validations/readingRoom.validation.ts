import { z } from 'zod';
import { uuidField } from './common';

export const createReadingRoomSchema = z.object({
  library_id: uuidField("Invalid library ID"),
  floor_id: uuidField("Invalid floor ID").optional(),
  room_type_id: uuidField("Invalid room type ID").optional(),
  type: z.string().default("General"), // Legacy type fallback
  name: z.string().optional(),
  is_silent_zone: z.boolean().default(false),
  capacity: z.number().int().positive("Capacity must be positive"),
});

export const updateReadingRoomSchema = createReadingRoomSchema.partial();
