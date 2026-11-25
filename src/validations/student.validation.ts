import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  mobile: z.string().regex(/^\d{10}$/, "Mobile must be 10 digits"),
  otp: z.string().regex(/^\d{4,8}$/, "OTP must be 4-8 digits"), // phone verified at account creation
  parent_mobile: z.string().regex(/^\d{10}$/, "Parent Mobile must be 10 digits").optional(),
  address: z.string().optional(),
  college: z.string().optional(),
  emergency_contact: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  photo_url: z.string().url().optional(),
  aadhaar_ref: z.string().optional()
});

export const updateStudentSchema = z.object({
  name: z.string().min(2).optional(),
  mobile: z.string().regex(/^\d{10}$/).optional(),
  parent_mobile: z.string().regex(/^\d{10}$/).optional(),
  address: z.string().optional(),
  college: z.string().optional(),
  emergency_contact: z.string().optional(),
  status: z.enum(["active", "cancelled"]).optional(),
  photo_url: z.string().url().optional()
});
