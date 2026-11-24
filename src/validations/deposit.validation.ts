import { z } from 'zod';

export const createDepositSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  library_id: z.string().uuid("Invalid library ID"),
  admission_id: z.string().uuid().optional(),
  amount: z.number().positive("Amount must be positive"),
  deposit_type: z.enum(["REFUNDABLE", "NON_REFUNDABLE"]).default("REFUNDABLE")
});

export const refundDepositSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional()
});
