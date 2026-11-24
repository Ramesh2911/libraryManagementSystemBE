import { z } from 'zod';

export const createCoordinatorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  assignments: z.array(z.object({
    library_id: z.string().uuid().optional(),
    floor_id: z.string().uuid().optional(),
    room_id: z.string().uuid().optional()
  })).optional(),
  permissions: z.record(z.string(), z.boolean()).optional() // e.g., { canAllocateSeat: true, canCollectFee: false }
});

export const assignCoordinatorSchema = z.object({
  assignments: z.array(z.object({
    library_id: z.string().uuid().optional(),
    floor_id: z.string().uuid().optional(),
    room_id: z.string().uuid().optional()
  })).min(1, "At least one assignment required")
});

export const updateCoordinatorPermissionsSchema = z.object({
  permissions: z.record(z.string(), z.boolean())
});

export const updateCoordinatorStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended'])
});
