import { z } from 'zod';

/**
 * Lenient UUID check (any 8-4-4-4-12 hex).
 * Zod v4's .uuid() rejects non-RFC variants used by seed data
 * (e.g. 22222222-2222-2222-2222-222222222222).
 */
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID');

export const uuidField = (message = 'Invalid UUID') =>
  z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, message);
