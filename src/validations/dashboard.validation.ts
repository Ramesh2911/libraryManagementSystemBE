import { z } from 'zod';
import { uuidField } from './common';

// Lenient UUID (matches common.ts) - seed data uses non-RFC variants
const uuidQuery = uuidField();

export const seatSummaryQuerySchema = z.object({
  libraryId: uuidQuery,
  floorId: uuidQuery.optional(),
  roomTypeId: uuidQuery.optional(),
});

export type SeatSummaryQuery = z.infer<typeof seatSummaryQuerySchema>;

export const businessOverviewQuerySchema = z.object({
  libraryId: uuidQuery.optional(),
});

export type BusinessOverviewQuery = z.infer<typeof businessOverviewQuerySchema>;

export const REVENUE_PERIODS = ['this_month', 'last_month', 'this_year'] as const;

export const revenueQuerySchema = z.object({
  libraryId: uuidQuery.optional(),
  period: z.enum(REVENUE_PERIODS).default('this_month'),
});

export type RevenueQuery = z.infer<typeof revenueQuerySchema>;
