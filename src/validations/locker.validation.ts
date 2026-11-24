import { z } from 'zod';

export const createLockerSchema = z.object({
  library_id: z.string().uuid(),
  locker_number: z.string().min(1),
  fee: z.number().min(0).optional()
});

export const assignLockerSchema = z.object({
  student_id: z.string().uuid()
});

export const releaseLockerSchema = z.object({});
