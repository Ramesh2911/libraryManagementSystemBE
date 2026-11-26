import { z } from 'zod';

// Owner 6-step onboarding. Schemas accept both openapi field names and
// doc/auth_api.md aliases (readingRoomName/floorName/roomNumber etc.) so the
// Flutter app works whichever naming it sends.

const timeStr = z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/, 'Time must be HH:MM');

// ---- Step 1: basic details ----
export const basicDetailsSchema = z
  .object({
    libraryName: z.string().min(3).max(100).optional(),
    readingRoomName: z.string().min(3).max(100).optional(),
    branchName: z.string().max(100).optional(),
    ownerName: z.string().min(2).max(80),
    phone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone'),
    email: z.string().email().optional(),
    tagline: z.string().max(200).optional(),
  })
  .refine((d) => !!(d.libraryName || d.readingRoomName), {
    message: 'libraryName (or readingRoomName) is required',
    path: ['libraryName'],
  });

// ---- Step 2: location ----
export const locationDetailsSchema = z.object({
  address: z.string().min(3),
  city: z.string().min(2),
  area: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// ---- Step 3: operation timing ----
export const operationTimingSchema = z
  .object({
    openTime: timeStr.optional(),
    closeTime: timeStr.optional(),
    openingTime: timeStr.optional(),
    closingTime: timeStr.optional(),
    daysOpen: z.array(z.string()).optional(),
    workingDays: z.array(z.object({ day: z.string(), isOpen: z.boolean() })).optional(),
    slots: z
      .array(
        z.object({
          name: z.string().min(1),
          startTime: timeStr,
          endTime: timeStr,
        })
      )
      .optional(),
    dailyBreak: z
      .object({
        isEnabled: z.boolean(),
        breakStart: timeStr.optional(),
        breakEnd: timeStr.optional(),
      })
      .optional(),
    holidays: z
      .array(z.object({ name: z.string(), date: z.string() }))
      .optional(),
  })
  .refine((d) => !!(d.openTime || d.openingTime), {
    message: 'openTime (or openingTime) is required',
    path: ['openTime'],
  })
  .refine((d) => !!(d.closeTime || d.closingTime), {
    message: 'closeTime (or closingTime) is required',
    path: ['closeTime'],
  });

// ---- Step 4: rooms ----
const roomSchema = z.object({
  name: z.string().min(1).optional(),
  roomNumber: z.string().min(1).optional(),
  roomTypeId: z.string().optional(),
  roomType: z.string().optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  totalSeats: z.number().int().min(1).max(1000).optional(),
  seatFrom: z.number().int().optional(),
  seatTo: z.number().int().optional(),
});

const floorSchema = z.object({
  name: z.string().min(1).optional(),
  floorName: z.string().min(1).optional(),
  rooms: z.array(roomSchema).default([]),
});

export const roomsSetupSchema = z.object({
  floors: z.array(floorSchema).min(1, 'At least one floor required'),
});

// ---- Step 5: fees ----
const feeTierSchema = z
  .object({
    dailyFee: z.number().min(0).optional(),
    monthlyFee: z.number().min(0).optional(),
    deposit: z.number().min(0).optional(),
    depositType: z.string().optional(),
    advanceAmount: z.number().min(0).optional(),
  })
  .optional();

export const feesDepositSchema = z.object({
  feePlans: z
    .array(
      z.object({
        name: z.string().min(1).optional(),
        roomType: z.string().min(1).optional(),
        amount: z.number().min(0).optional(),
        cycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
        depositAmount: z.number().min(0).optional(),
        fullDay: feeTierSchema,
        halfDayEnabled: z.boolean().optional(),
        halfDay: feeTierSchema,
      })
    )
    .min(1, 'At least one fee plan required'),
});

export const finalizeSchema = z.object({
  readingRoomId: z.string().optional(), // draft id from earlier steps (informational)
});

export type BasicDetailsInput = z.infer<typeof basicDetailsSchema>;
export type LocationDetailsInput = z.infer<typeof locationDetailsSchema>;
export type OperationTimingInput = z.infer<typeof operationTimingSchema>;
export type RoomsSetupInput = z.infer<typeof roomsSetupSchema>;
export type FeesDepositInput = z.infer<typeof feesDepositSchema>;
