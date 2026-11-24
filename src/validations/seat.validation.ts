import { z } from 'zod';
import { uuidField } from './common';

export const allocateSeatSchema = z.object({
  admission_id: uuidField("Invalid admission ID"),
  student_id: uuidField("Invalid student ID"),
  slot_id: uuidField("Invalid slot ID").optional(),
});

export const transferSeatSchema = z.object({
  student_id: uuidField("Invalid student ID"),
  new_seat_id: uuidField("Invalid new seat ID"),
  slot_id: uuidField("Invalid slot ID").optional(),
});

export const updateSeatStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]),
});
