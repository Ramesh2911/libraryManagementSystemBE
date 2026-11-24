import { z } from 'zod';

export const createLibrarySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters long"),
  address: z.string().optional(),
  contact: z.string().optional(),
  logo_url: z.string().url("Must be a valid URL").optional(),
});

export const updateLibrarySchema = createLibrarySchema.partial();
