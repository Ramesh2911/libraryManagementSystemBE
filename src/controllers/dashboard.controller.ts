import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import {
  seatSummaryQuerySchema,
  businessOverviewQuerySchema,
  revenueQuerySchema,
} from '../validations/dashboard.validation';
import { ok, fail } from '../utils/response';

const CURRENCY = 'INR';

// Asia/Kolkata (UTC+5:30) - fixed business timezone for day/month boundaries
const IST_OFFSET_MIN = 330;

function istDayStart(d: Date): Date {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utc + IST_OFFSET_MIN * 60000);
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

/** Overdue fee statuses: past due date, not fully paid, not waived/cancelled/paid */
const OVERDUE_STATUSES = ['DUE', 'PARTIALLY_PAID', 'OVERDUE'] as const;

export const getSeatSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const q = seatSummaryQuerySchema.parse(req.query);

    const roomWhere: any = { library_id: q.libraryId, status: 'active' };
    if (q.floorId) roomWhere.floor_id = q.floorId;
    if (q.roomTypeId) roomWhere.room_type_id = q.roomTypeId;

    // Seats in scope: seat -> room matches library/floor/roomType
    const seats = await prisma.seat.findMany({
      where: {
        status: 'ACTIVE',
        room: roomWhere,
      },
      select: {
        seat_id: true,
        assignments: {
          where: { status: 'ACTIVE' },
          select: {
            student_id: true,
            student: {
              select: {
                student_id: true,
                feeObligations: {
                  where: {
                    due_date: { lt: new Date() },
                    status: { in: [...OVERDUE_STATUSES] },
                  },
                  select: { amount_due: true, amount_paid: true },
                },
              },
            },
          },
        },
      },
    });

    let filledSeats = 0;
    let pendingSeats = 0;
    for (const seat of seats) {
      const active = seat.assignments;
      if (active.length === 0) continue;
      filledSeats += 1;
      const obligations = active[0]?.student?.feeObligations ?? [];
      const hasOverdue = obligations.some((o) => o.amount_paid < o.amount_due);
      if (hasOverdue) pendingSeats += 1;
    }

    const totalSeats = seats.length;
    const vacantSeats = totalSeats - filledSeats;

    return ok(
      res,
      {
        libraryId: q.libraryId,
        filters: {
          floorId: q.floorId ?? null,
          roomTypeId: q.roomTypeId ?? null,
        },
        totalSeats,
        filledSeats,
        vacantSeats,
        pendingSeats,
      },
      'Seat summary fetched successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch seat summary', 500);
  }
};

export const getBusinessOverview = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const q = businessOverviewQuerySchema.parse(req.query);
    const libraryId = q.libraryId;

    const now = new Date();
    const dayStart = istDayStart(now);
    const dayEnd = addDays(dayStart, 1);
    const monthStart = new Date(dayStart);
    monthStart.setDate(1);

    // Resolve student ids in library (via active seat) when libraryId given
    let libraryStudentIds: string[] | null = null;
    if (libraryId) {
      const assignments = await prisma.seatAssignment.findMany({
        where: {
          status: 'ACTIVE',
          seat: { room: { library_id: libraryId } },
        },
        select: { student_id: true },
        distinct: ['student_id'],
      });
      libraryStudentIds = assignments.map((a) => a.student_id);
      if (libraryStudentIds.length === 0) libraryStudentIds = [];
    }

    const studentScope =
      libraryStudentIds !== null ? { student_id: { in: libraryStudentIds } } : {};

    // Overdue: fee rows past due with remaining balance
    const overdueRows = await prisma.feeObligation.findMany({
      where: {
        due_date: { lt: now },
        status: { in: [...OVERDUE_STATUSES] },
        ...studentScope,
      },
      select: { student_id: true, amount_due: true, amount_paid: true },
    });
    const overdueStudentIds = new Set<string>();
    let overdueAmount = 0;
    for (const row of overdueRows) {
      const remaining = row.amount_due - row.amount_paid;
      if (remaining > 0) {
        overdueStudentIds.add(row.student_id);
        overdueAmount += remaining;
      }
    }

    // Total students
    let totalStudents: number;
    if (libraryStudentIds !== null) {
      totalStudents = await prisma.student.count({
        where: { status: 'active', student_id: { in: libraryStudentIds } },
      });
    } else {
      totalStudents = await prisma.student.count({ where: { status: 'active' } });
    }

    // Payments: SUCCESS only. Library scope via admission.feePlan or student's active seat.
    const paymentWhereBase = { status: 'SUCCESS' as const };
    const paymentLibraryWhere = libraryId
      ? {
          OR: [
            { admission: { feePlan: { library_id: libraryId } } },
            {
              student: {
                seatAssignments: {
                  some: { status: 'ACTIVE', seat: { room: { library_id: libraryId } } },
                },
              },
            },
          ],
        }
      : {};

    const todayAgg = await prisma.payment.aggregate({
      where: {
        ...paymentWhereBase,
        ...paymentLibraryWhere,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      _sum: { amount: true },
    });

    const monthAgg = await prisma.payment.aggregate({
      where: {
        ...paymentWhereBase,
        ...paymentLibraryWhere,
        createdAt: { gte: monthStart, lt: dayEnd },
      },
      _sum: { amount: true },
    });

    // Visit today (scheduled_at preferred, fallback checked_in_at)
    const visitToday = await prisma.visitor.count({
      where: {
        ...(libraryId ? { library_id: libraryId } : {}),
        OR: [
          { scheduled_at: { gte: dayStart, lt: dayEnd } },
          { scheduled_at: null, checked_in_at: { gte: dayStart, lt: dayEnd } },
        ],
      },
    });

    return ok(
      res,
      {
        delayOverdue: { count: overdueStudentIds.size },
        totalStudents: { count: totalStudents },
        overdueAmount: { amount: Math.round(overdueAmount * 100) / 100, currency: CURRENCY },
        todayCollection: {
          amount: todayAgg._sum.amount ?? 0,
          currency: CURRENCY,
        },
        monthlyRevenue: {
          amount: monthAgg._sum.amount ?? 0,
          currency: CURRENCY,
        },
        visitToday: { count: visitToday },
      },
      'Business overview fetched successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch business overview', 500);
  }
};

export const getRevenue = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const q = revenueQuerySchema.parse(req.query);
    const libraryId = q.libraryId;
    const period = q.period;

    const now = new Date();
    const dayStart = istDayStart(now);

    let curStart: Date;
    let curEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;
    let bucket: 'day' | 'month';

    if (period === 'this_month') {
      bucket = 'day';
      curStart = new Date(dayStart);
      curStart.setDate(1);
      curEnd = addDays(dayStart, 1);
      prevEnd = curStart;
      prevStart = addMonths(curStart, -1);
    } else if (period === 'last_month') {
      bucket = 'day';
      curEnd = new Date(dayStart);
      curEnd.setDate(1);
      curStart = addMonths(curEnd, -1);
      prevEnd = curStart;
      prevStart = addMonths(curEnd, -2);
    } else {
      // this_year
      bucket = 'month';
      curStart = new Date(dayStart);
      curStart.setMonth(0, 1);
      curEnd = addDays(dayStart, 1);
      prevEnd = curStart;
      prevStart = new Date(curStart);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
    }

    const paymentLibraryWhere = libraryId
      ? {
          OR: [
            { admission: { feePlan: { library_id: libraryId } } },
            {
              student: {
                seatAssignments: {
                  some: { status: 'ACTIVE', seat: { room: { library_id: libraryId } } },
                },
              },
            },
          ],
        }
      : {};

    const curAgg = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        ...paymentLibraryWhere,
        createdAt: { gte: curStart, lt: curEnd },
      },
      _sum: { amount: true },
    });
    const prevAgg = await prisma.payment.aggregate({
      where: {
        status: 'SUCCESS',
        ...paymentLibraryWhere,
        createdAt: { gte: prevStart, lt: prevEnd },
      },
      _sum: { amount: true },
    });

    const rows = await prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        ...paymentLibraryWhere,
        createdAt: { gte: curStart, lt: curEnd },
      },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Bucket into chart points (IST calendar)
    const buckets = new Map<string, number>();
    if (bucket === 'day') {
      // seed all days in range
      for (let d = new Date(curStart); d < curEnd; d = addDays(d, 1)) {
        buckets.set(isoDateIST(d), 0);
      }
    } else {
      // seed 12 months of current year
      for (let m = 0; m < 12; m++) {
        const d = new Date(curStart);
        d.setMonth(m, 1);
        buckets.set(`${d.getFullYear()}-${String(m + 1).padStart(2, '0')}`, 0);
      }
    }

    for (const row of rows) {
      const key =
        bucket === 'day'
          ? isoDateIST(row.createdAt)
          : (() => {
              const d = new Date(
                row.createdAt.getTime() +
                  row.createdAt.getTimezoneOffset() * 60000 +
                  IST_OFFSET_MIN * 60000
              );
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            })();
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + row.amount);
      }
    }

    const chart = Array.from(buckets.entries()).map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 100) / 100,
    }));

    const totalRevenue = curAgg._sum.amount ?? 0;
    const previousPeriodRevenue = prevAgg._sum.amount ?? 0;
    const growthPercentage =
      previousPeriodRevenue > 0
        ? Math.round(((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 1000) / 10
        : null;

    return ok(
      res,
      {
        period,
        currency: CURRENCY,
        totalRevenue,
        previousPeriodRevenue,
        growthPercentage,
        chart,
      },
      'Revenue data fetched successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch revenue data', 500);
  }
};

function isoDateIST(d: Date): string {
  const shifted = new Date(
    d.getTime() + d.getTimezoneOffset() * 60000 + IST_OFFSET_MIN * 60000
  );
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
