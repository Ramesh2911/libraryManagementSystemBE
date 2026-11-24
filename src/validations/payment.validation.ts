import { z } from 'zod';
import { uuidField } from './common';

export const recordPaymentSchema = z.object({
  student_id: uuidField("Invalid student ID"),
  admission_id: uuidField("Invalid admission ID").optional(),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "UPI", "ONLINE_GATEWAY", "BANK_TRANSFER"]),
  provider: z.string().optional(),
  provider_payment_id: z.string().optional(),
  receipt_url: z.string().url().optional(),
  allocations: z.array(z.object({
    obligation_id: uuidField().optional(),
    deposit_id: uuidField().optional(),
    amount: z.number().positive()
  })).min(1, "At least one allocation is required")
});
