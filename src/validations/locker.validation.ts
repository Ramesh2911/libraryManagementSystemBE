import { z } from 'zod';
import { uuidField } from './common';

export const createLockerSchema = z.object({
  library_id: uuidField(),
  locker_number: z.string().min(1),
  fee: z.number().min(0).optional()
});

export const assignLockerSchema = z.object({
  student_id: uuidField()
});

export const releaseLockerSchema = z.object({});
