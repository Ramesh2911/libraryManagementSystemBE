import { z } from 'zod';
import { uuidField } from './common';

const biometricLogSchema = z.object({
  student_id: uuidField("Invalid student ID"),
  timestamp: z.string().datetime({ message: "Invalid ISO8601 timestamp" })
});

export const syncAttendanceSchema = z.object({
  logs: z.array(biometricLogSchema).min(1, "Logs array cannot be empty")
});
