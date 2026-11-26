import { z } from 'zod';
import { uuidField } from './common';

const timeStr = z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM');

const locationFields = {
  branch_name: z.string().max(100).optional().nullable(),
  owner_name: z.string().min(2).max(80).optional().nullable(),
  mobile: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone').optional().nullable(),
  email: z.string().email().optional().nullable(),
  area: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  city: z.string().min(2).optional().nullable(),
  state: z.string().optional().nullable(),
  pin_code: z.string().optional().nullable(),
  // camelCase aliases accepted too
  pincode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
};

export const createLibrarySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters long'),
  address: z.string().optional(),
  contact: z.string().optional(),
  logo_url: z.string().url('Must be a valid URL').optional(),
  ...locationFields,
});

export const updateLibrarySchema = createLibrarySchema.partial();

// ---- GET /libraries/:id / PATCH extended (setup fields) ----
export const updateLibrarySetupSchema = updateLibrarySchema.extend({
  setup_status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
});

// ---- Operation GET/PUT ----
export const operationPutSchema = z.object({
  opening_time: timeStr.optional().nullable(),
  closing_time: timeStr.optional().nullable(),
  openTime: timeStr.optional(),
  closeTime: timeStr.optional(),
  openingTime: timeStr.optional(),
  closingTime: timeStr.optional(),
  working_days: z
    .array(z.union([z.string(), z.object({ day: z.string(), isOpen: z.boolean() })]))
    .optional()
    .nullable(),
  daysOpen: z.array(z.string()).optional(),
  holidays: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
      })
    )
    .optional()
    .nullable(),
});

export type OperationPutInput = z.infer<typeof operationPutSchema>;

// ---- Room type pricing PUT (replace-all array) ----
const pricingTier = z.object({
  monthly_fee_per_seat: z.number().min(0),
  security_deposit: z.number().min(0).optional(),
  deposit_type: z.enum(['REFUNDABLE', 'NON_REFUNDABLE']).optional(),
  advance_amount: z.number().min(0).optional(),
});

export const roomTypePricingPutSchema = z
  .array(
    z.object({
      room_type_id: uuidField(),
      full_day: pricingTier,
      half_day: z
        .object({
          enabled: z.boolean(),
          monthly_fee_per_seat: z.number().min(0).optional(),
          security_deposit: z.number().min(0).optional(),
          deposit_type: z.enum(['REFUNDABLE', 'NON_REFUNDABLE']).optional(),
          advance_amount: z.number().min(0).optional(),
        })
        .optional(),
    })
  )
  .min(1, 'At least one pricing row required');

export type RoomTypePricingPutInput = z.infer<typeof roomTypePricingPutSchema>;

export const setupCompleteSchema = z.object({}).optional();
