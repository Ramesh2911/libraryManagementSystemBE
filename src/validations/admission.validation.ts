import { z } from 'zod';
import { uuidField } from './common';

export const createAdmissionSchema = z.object({
  student_id: uuidField("Invalid student ID"),
  library_id: uuidField("Invalid library ID"),
  room_id: uuidField("Invalid room ID").optional(),
  plan_id: uuidField("Invalid plan ID").optional(),
  
  // Seat Assignments (optional)
  seat_assignments: z.array(z.object({
    seat_id: uuidField("Invalid seat ID"),
    slot_id: uuidField("Invalid slot ID").optional()
  })).optional(),

  // Fee Obligation
  fee_type: z.enum(["MONTHLY", "DAILY", "WEEKLY", "YEARLY", "ONE_TIME"]),
  amount_total: z.number().positive("Fee amount must be positive"),
  discount: z.number().min(0).default(0),
  due_date: z.string().datetime({ message: "Invalid date format. Use ISO8601" }),
  billing_cycle: z.string().min(1, "Billing cycle is required (e.g. M1, OCT-2026)")
});

export const cancelAdmissionSchema = z.object({
  cancellation_reason: z.string().optional()
});
