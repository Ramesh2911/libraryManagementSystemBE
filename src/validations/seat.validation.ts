import { z } from 'zod';

export const allocateSeatSchema = z.object({
  admission_id: z.string().uuid("Invalid admission ID"),
  student_id: z.string().uuid("Invalid student ID"),
  slot_id: z.string().uuid("Invalid slot ID").optional(),
});

export const transferSeatSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  new_seat_id: z.string().uuid("Invalid new seat ID"),
  slot_id: z.string().uuid("Invalid slot ID").optional(),
});

export const updateSeatStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]),
});
