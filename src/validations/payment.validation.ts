import { z } from 'zod';

export const recordPaymentSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  admission_id: z.string().uuid("Invalid admission ID").optional(),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "UPI", "ONLINE_GATEWAY", "BANK_TRANSFER"]),
  provider: z.string().optional(),
  provider_payment_id: z.string().optional(),
  receipt_url: z.string().url().optional(),
  allocations: z.array(z.object({
    obligation_id: z.string().uuid().optional(),
    deposit_id: z.string().uuid().optional(),
    amount: z.number().positive()
  })).min(1, "At least one allocation is required")
});
