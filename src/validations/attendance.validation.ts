import { z } from 'zod';
import { uuidField } from './common';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const monthStr = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');
const deviceEventId = z.string().min(8).max(128);
const actionType = z.enum(['check_in', 'check_out']);
const finalStatus = z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'pending']);

// ---- existing sync (unchanged contract) ----
const biometricLogSchema = z.object({
  student_id: uuidField('Invalid student ID'),
  timestamp: z.string().datetime({ message: 'Invalid ISO8601 timestamp' }),
});

export const syncAttendanceSchema = z.object({
  logs: z.array(biometricLogSchema).min(1, 'Logs array cannot be empty'),
});

// ---- QR session ----
export const createQrSessionSchema = z.object({
  readingRoomId: uuidField('Invalid reading room ID'),
  validForSeconds: z.number().int().min(30).max(86400).default(300),
  attendanceDate: dateStr,
  actionType,
});

export const getQrSessionQuerySchema = z.object({
  readingRoomId: uuidField('Invalid reading room ID'),
});

export const stopQrSessionSchema = z.object({
  readingRoomId: uuidField('Invalid reading room ID'),
  sessionId: uuidField('Invalid session ID'),
});

// ---- Student QR check-in / check-out ----
export const qrCheckSchema = z.object({
  qrPayload: z.string().min(16).max(512),
  deviceEventId,
});

// ---- Manual attendance ----
export const manualAttendanceSchema = z.object({
  studentId: uuidField('Invalid student ID'),
  libraryId: uuidField('Invalid library ID'),
  readingRoomId: uuidField('Invalid reading room ID'),
  action: actionType,
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  source: z.literal('manual').optional(),
  deviceEventId,
});

// ---- Correct attendance ----
export const correctAttendanceSchema = z.object({
  status: finalStatus,
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
  notes: z.string().trim().max(1000).optional(),
});

// ---- Daily register ----
export const registerQuerySchema = z.object({
  date: dateStr,
  libraryId: uuidField().optional(),
  readingRoomId: uuidField().optional(),
  status: finalStatus.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// ---- Monthly report ----
export const monthlyReportQuerySchema = z.object({
  month: monthStr,
  libraryId: uuidField().optional(),
  readingRoomId: uuidField().optional(),
  search: z.string().trim().max(120).optional(),
});

// ---- Student history ----
export const historyQuerySchema = z.object({
  month: monthStr.optional(),
  status: finalStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateQrSessionInput = z.infer<typeof createQrSessionSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
export type RegisterQueryInput = z.infer<typeof registerQuerySchema>;
export type MonthlyReportQueryInput = z.infer<typeof monthlyReportQuerySchema>;
export type HistoryQueryInput = z.infer<typeof historyQuerySchema>;
