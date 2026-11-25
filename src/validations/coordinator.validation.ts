import { z } from 'zod';
import { uuidField } from './common';
import { MODULES } from '../config/modules';

// Permissions: partial boolean map over the 10 known modules; unknown keys rejected.
// Missing key = false (denied) at enforcement time.
export const permissionsSchema = z
  .object(
    Object.fromEntries(MODULES.map((m) => [m, z.boolean()])) as Record<
      (typeof MODULES)[number],
      z.ZodBoolean
    >
  )
  .partial()
  .strict();

export const createCoordinatorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  otp: z.string().regex(/^\d{4,8}$/, "OTP must be 4-8 digits"), // phone verified at account creation
  assignments: z.array(z.object({
    library_id: uuidField().optional(),
    floor_id: uuidField().optional(),
    room_id: uuidField().optional()
  })).optional(),
  permissions: permissionsSchema.optional()
});

export const assignCoordinatorSchema = z.object({
  assignments: z.array(z.object({
    library_id: uuidField().optional(),
    floor_id: uuidField().optional(),
    room_id: uuidField().optional()
  })).min(1, "At least one assignment required")
});

export const updateCoordinatorPermissionsSchema = z.object({
  permissions: permissionsSchema
});

export const updateCoordinatorStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended'])
});
