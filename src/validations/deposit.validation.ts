import { z } from 'zod';
import { uuidField } from './common';

export const createDepositSchema = z.object({
  student_id: uuidField("Invalid student ID"),
  library_id: uuidField("Invalid library ID"),
  admission_id: uuidField().optional(),
  amount: z.number().positive("Amount must be positive"),
  deposit_type: z.enum(["REFUNDABLE", "NON_REFUNDABLE"]).default("REFUNDABLE")
});

export const refundDepositSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional()
});
