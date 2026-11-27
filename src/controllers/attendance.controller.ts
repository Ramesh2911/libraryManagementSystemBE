import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getTenantPrisma } from '../config/prisma';
import { ok, fail } from '../utils/response';
import {
  syncAttendanceSchema,
  createQrSessionSchema,
  getQrSessionQuerySchema,
  stopQrSessionSchema,
  qrCheckSchema,
  manualAttendanceSchema,
  correctAttendanceSchema,
  registerQuerySchema,
  monthlyReportQuerySchema,
  historyQuerySchema,
} from '../validations/attendance.validation';
import {
  Actor,
  ScopeError,
  assertRoomAccess,
  assertLibraryAccess,
  assertStudentInLibrary,
  assertStaff,
  resolveLibraryIds,
  resolveAccessibleRoomIds,
  parseDateOnly,
  monthRange,
  issueQrPayload,
} from '../services/attendanceScope.service';

function actorOf(req: Request): Actor {
  return { sub: req.user.sub, tenant_id: req.user.tenant_id, role: req.user.role };
}

function handleError(res: Response, error: any, fallback: string): Response {
  if (error instanceof ScopeError) {
    return fail(res, error.message, error.status, error.code);
  }
  if (error?.name === 'ZodError') {
    return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
  }
  console.error(fallback, error);
  return fail(res, fallback, 500);
}

function toSessionDto(s: any) {
  return {
    sessionId: s.session_id,
    readingRoomId: s.reading_room_id,
    readingRoomName: s.readingRoom?.name ?? null,
    libraryId: s.library_id,
    qrPayload: s.qr_payload,
    issuedAt: s.issued_at?.toISOString?.() ?? s.issued_at,
    expiresAt: s.expires_at?.toISOString?.() ?? s.expires_at,
    status: s.status,
    actionType: s.action_type,
    validForSeconds: s.valid_for_seconds,
  };
}

function toAttendanceDto(log: any, extras: Record<string, any> = {}) {
  const duration =
    log.exit_time && log.entry_time
      ? formatDuration(new Date(log.exit_time).getTime() - new Date(log.entry_time).getTime())
      : null;
  return {
    attendanceId: log.log_id,
    studentId: log.student_id,
    libraryId: log.library_id ?? null,
    readingRoomId: log.reading_room_id ?? null,
    readingRoomName: extras.readingRoomName ?? log.readingRoom?.name ?? null,
    sessionId: log.session_id ?? null,
    attendanceDate: log.date?.toISOString?.().split('T')[0] ?? null,
    seatNumber: extras.seatNumber ?? null,
    checkInAt: log.entry_time?.toISOString?.() ?? log.entry_time,
    checkOutAt: log.exit_time ? log.exit_time.toISOString?.() ?? log.exit_time : null,
    duration,
    status: log.status,
    source: log.source,
    student: extras.student ?? undefined,
    audit: extras.audit ?? undefined,
    updatedAt: log.updatedAt?.toISOString?.() ?? log.updatedAt,
  };
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

async function loadActiveSession(prisma: any, qrPayload: string) {
  const session = await prisma.attendanceQrSession.findUnique({
    where: { qr_payload: qrPayload },
    include: { readingRoom: { select: { name: true } } },
  });
  if (!session) {
    throw new ScopeError('Invalid QR payload', 'INVALID_QR', 400);
  }
  if (session.status === 'stopped') {
    throw new ScopeError('QR session was stopped', 'QR_SESSION_STOPPED', 400);
  }
  if (session.status === 'expired') {
    throw new ScopeError('QR session expired', 'QR_SESSION_EXPIRED', 400);
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await prisma.attendanceQrSession.update({
      where: { session_id: session.session_id },
      data: { status: 'expired' },
    });
    throw new ScopeError('QR session expired', 'QR_SESSION_EXPIRED', 400);
  }
  return session;
}

async function findByIdempotencyKey(prisma: any, deviceEventId: string) {
  return prisma.attendanceLog.findUnique({ where: { device_event_id: deviceEventId } });
}

// ---------------------------------------------------------------------------
// Legacy biometric sync — response shape kept raw for existing Flutter client
// ---------------------------------------------------------------------------
export const syncAttendance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const { logs } = syncAttendanceSchema.parse(req.body);

    const results = {
      processed: 0,
      errors: [] as any[],
    };

    for (const log of logs) {
      try {
        const pingTime = new Date(log.timestamp);
        const dateStr = pingTime.toISOString().split('T')[0];
        const dateObj = new Date(`${dateStr}T00:00:00Z`);

        const existingLog = await prismaTenant.attendanceLog.findFirst({
          where: {
            student_id: log.student_id,
            date: dateObj,
          },
        });

        if (existingLog) {
          if (pingTime > existingLog.entry_time) {
            await prismaTenant.attendanceLog.update({
              where: { log_id: existingLog.log_id },
              data: { exit_time: pingTime },
            });
          } else if (pingTime < existingLog.entry_time) {
            await prismaTenant.attendanceLog.update({
              where: { log_id: existingLog.log_id },
              data: {
                entry_time: pingTime,
                exit_time: existingLog.entry_time,
              },
            });
          }
        } else {
          await prismaTenant.attendanceLog.create({
            data: {
              tenant_id: tenantId,
              student_id: log.student_id,
              date: dateObj,
              entry_time: pingTime,
            },
          });
        }

        results.processed++;
      } catch (err: any) {
        results.errors.push({ student_id: log.student_id, error: err.message });
      }
    }

    res.status(200).json({ message: 'Sync completed', data: results });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
};

// ---------------------------------------------------------------------------
// QR session — OWNER / COORDINATOR
// ---------------------------------------------------------------------------
export const createQrSession = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const input = createQrSessionSchema.parse(req.body);

    const { room } = await assertRoomAccess(prisma, actor, input.readingRoomId);

    await prisma.attendanceQrSession.updateMany({
      where: { reading_room_id: room.room_id, status: 'active' },
      data: { status: 'stopped', stopped_at: new Date() },
    });

    const expiresAt = new Date(Date.now() + input.validForSeconds * 1000);
    const session = await prisma.attendanceQrSession.create({
      data: {
        tenant_id: actor.tenant_id ?? req.tenantId!,
        library_id: room.library_id,
        reading_room_id: room.room_id,
        action_type: input.actionType,
        qr_payload: issueQrPayload(),
        valid_for_seconds: input.validForSeconds,
        status: 'active',
        expires_at: expiresAt,
        created_by: actor.sub,
        created_by_role: actor.role,
      },
      include: { readingRoom: { select: { name: true } } },
    });

    return ok(res, toSessionDto(session), 'QR session created', 201);
  } catch (error) {
    return handleError(res, error, 'Failed to create QR session');
  }
};

export const getQrSession = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const query = getQrSessionQuerySchema.parse(req.query);

    const { room } = await assertRoomAccess(prisma, actor, query.readingRoomId);

    let session = await prisma.attendanceQrSession.findFirst({
      where: { reading_room_id: room.room_id, status: 'active' },
      orderBy: { issued_at: 'desc' },
      include: { readingRoom: { select: { name: true } } },
    });

    if (session && new Date(session.expires_at).getTime() <= Date.now()) {
      await prisma.attendanceQrSession.update({
        where: { session_id: session.session_id },
        data: { status: 'expired' },
      });
      session = null;
    }

    if (!session) {
      return fail(res, 'No active session for this reading room', 404, 'NO_ACTIVE_SESSION');
    }
    return ok(res, toSessionDto(session), 'Active QR session fetched');
  } catch (error) {
    return handleError(res, error, 'Failed to fetch QR session');
  }
};

export const stopQrSession = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const input = stopQrSessionSchema.parse(req.body);

    const { room } = await assertRoomAccess(prisma, actor, input.readingRoomId);

    const session = await prisma.attendanceQrSession.findFirst({
      where: { session_id: input.sessionId, reading_room_id: room.room_id },
    });
    if (!session) {
      return fail(res, 'No active session for this reading room', 404, 'NO_ACTIVE_SESSION');
    }

    const stoppedAt = new Date();
    const updated =
      session.status === 'active'
        ? await prisma.attendanceQrSession.update({
            where: { session_id: session.session_id },
            data: { status: 'stopped', stopped_at: stoppedAt },
          })
        : session;

    return ok(
      res,
      {
        sessionId: updated.session_id,
        readingRoomId: updated.reading_room_id,
        status: updated.status,
        stoppedAt: (updated.stopped_at ?? stoppedAt)?.toISOString?.() ?? updated.stopped_at,
      },
      'QR session stopped'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to stop QR session');
  }
};

// ---------------------------------------------------------------------------
// Student QR check-in / check-out — STUDENT only
// ---------------------------------------------------------------------------
export const studentCheckIn = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const studentId = actor.sub;
    const prisma = getTenantPrisma(req.tenantId!);
    const input = qrCheckSchema.parse(req.body);

    const existingById = await findByIdempotencyKey(prisma, input.deviceEventId);
    if (existingById) {
      return ok(res, toAttendanceDto(existingById), 'Attendance check-in recorded');
    }

    const session = await loadActiveSession(prisma, input.qrPayload);
    if (session.action_type !== 'check_in') {
      throw new ScopeError('QR session does not permit check-in', 'QR_ACTION_MISMATCH', 400);
    }

    await assertStudentInLibrary(prisma, studentId, session.library_id, session.reading_room_id);

    const today = parseDateOnly(new Date().toISOString().split('T')[0]);
    const already = await prisma.attendanceLog.findFirst({
      where: { student_id: studentId, date: today },
    });
    if (already) {
      return fail(
        res,
        'Attendance already recorded for today',
        409,
        'ATTENDANCE_ALREADY_CHECKED_IN'
      );
    }

    let log;
    try {
      log = await prisma.attendanceLog.create({
        data: {
          tenant_id: req.tenantId!,
          student_id: studentId,
          library_id: session.library_id,
          reading_room_id: session.reading_room_id,
          session_id: session.session_id,
          date: today,
          entry_time: new Date(),
          status: 'checked_in',
          source: 'qr',
          device_event_id: input.deviceEventId,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const race = await findByIdempotencyKey(prisma, input.deviceEventId);
        if (race) return ok(res, toAttendanceDto(race), 'Attendance check-in recorded');
      }
      throw err;
    }

    return ok(
      res,
      toAttendanceDto(log, { readingRoomName: session.readingRoom?.name }),
      'Attendance check-in recorded'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to record check-in');
  }
};

export const studentCheckOut = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const studentId = actor.sub;
    const prisma = getTenantPrisma(req.tenantId!);
    const input = qrCheckSchema.parse(req.body);

    const existingById = await findByIdempotencyKey(prisma, input.deviceEventId);
    if (existingById) {
      return ok(res, toAttendanceDto(existingById), 'Attendance check-out recorded');
    }

    const session = await loadActiveSession(prisma, input.qrPayload);
    if (session.action_type !== 'check_out') {
      throw new ScopeError('QR session does not permit check-out', 'QR_ACTION_MISMATCH', 400);
    }

    const today = parseDateOnly(new Date().toISOString().split('T')[0]);
    const openLog = await prisma.attendanceLog.findFirst({
      where: { student_id: studentId, date: today, status: 'checked_in' },
    });
    if (!openLog) {
      return fail(res, 'No active check-in for this student', 409, 'NO_ACTIVE_CHECK_IN');
    }
    if (openLog.reading_room_id && openLog.reading_room_id !== session.reading_room_id) {
      return fail(res, 'Check-out room must match check-in room', 409, 'ROOM_MISMATCH');
    }

    const updated = await prisma.attendanceLog.update({
      where: { log_id: openLog.log_id },
      data: {
        exit_time: new Date(),
        status: 'present',
        device_event_id: input.deviceEventId,
      },
    });

    return ok(
      res,
      toAttendanceDto(updated, { readingRoomName: session.readingRoom?.name }),
      'Attendance check-out recorded'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to record check-out');
  }
};

// ---------------------------------------------------------------------------
// Manual attendance — OWNER / COORDINATOR
// ---------------------------------------------------------------------------
export const manualAttendance = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const input = manualAttendanceSchema.parse(req.body);

    const { room } = await assertRoomAccess(prisma, actor, input.readingRoomId);
    if (room.library_id !== input.libraryId) {
      throw new ScopeError(
        'Reading room not in provided library',
        'READING_ROOM_NOT_IN_ACTIVE_LIBRARY',
        403
      );
    }

    const { student } = await assertStudentInLibrary(
      prisma,
      input.studentId,
      input.libraryId,
      input.readingRoomId
    );

    const existingById = await findByIdempotencyKey(prisma, input.deviceEventId);
    if (existingById) {
      return ok(res, toAttendanceDto(existingById), 'Manual attendance recorded');
    }

    const today = parseDateOnly(new Date().toISOString().split('T')[0]);
    const now = new Date();

    let log;
    let auditAction: string;

    if (input.action === 'check_in') {
      const already = await prisma.attendanceLog.findFirst({
        where: { student_id: input.studentId, date: today },
      });
      if (already) {
        return fail(
          res,
          'Attendance already recorded for today',
          409,
          'ATTENDANCE_ALREADY_CHECKED_IN'
        );
      }
      auditAction = 'manual_check_in';
      log = await prisma.attendanceLog.create({
        data: {
          tenant_id: req.tenantId!,
          student_id: input.studentId,
          library_id: input.libraryId,
          reading_room_id: input.readingRoomId,
          date: today,
          entry_time: now,
          status: 'checked_in',
          source: 'manual',
          device_event_id: input.deviceEventId,
        },
      });
    } else {
      const openLog = await prisma.attendanceLog.findFirst({
        where: { student_id: input.studentId, date: today, status: 'checked_in' },
      });
      if (!openLog) {
        return fail(res, 'No active check-in for this student', 409, 'NO_ACTIVE_CHECK_IN');
      }
      auditAction = 'manual_check_out';
      log = await prisma.attendanceLog.update({
        where: { log_id: openLog.log_id },
        data: {
          exit_time: now,
          status: 'present',
          source: 'manual',
          device_event_id: input.deviceEventId,
        },
      });
    }

    const audit = await prisma.attendanceAudit.create({
      data: {
        tenant_id: req.tenantId!,
        attendance_id: log.log_id,
        action: auditAction,
        performed_by: actor.sub,
        performed_by_role: actor.role,
        reason: input.reason,
        previous_value:
          input.action === 'check_out'
            ? ({ status: 'checked_in' } as Prisma.InputJsonValue)
            : Prisma.DbNull,
        new_value: { status: log.status },
        performed_at: now,
      },
    });

    return ok(
      res,
      toAttendanceDto(log, {
        readingRoomName: room.name,
        audit: {
          performedByUserId: audit.performed_by,
          performedByRole: audit.performed_by_role,
          reason: audit.reason,
          performedAt: audit.performed_at?.toISOString?.() ?? audit.performed_at,
        },
      }),
      'Manual attendance recorded'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to record manual attendance');
  }
};

// ---------------------------------------------------------------------------
// Correct attendance — OWNER / COORDINATOR
// ---------------------------------------------------------------------------
export const correctAttendance = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const attendanceId = req.params.attendanceId as string;
    const input = correctAttendanceSchema.parse(req.body);

    const log = await prisma.attendanceLog.findUnique({
      where: { log_id: attendanceId },
      include: { readingRoom: { select: { name: true } } },
    });
    if (!log) {
      return fail(res, 'Attendance record not found', 404, 'ATTENDANCE_NOT_FOUND');
    }

    await assertLogScope(prisma, actor, log.library_id, log.reading_room_id);

    if (log.status === input.status) {
      return ok(
        res,
        toAttendanceDto(log, { readingRoomName: log.readingRoom?.name }),
        'Attendance already has this status'
      );
    }

    const now = new Date();
    const previous = { status: log.status };
    const updated = await prisma.attendanceLog.update({
      where: { log_id: attendanceId },
      data: {
        status: input.status,
        corrected_by: actor.sub,
        corrected_at: now,
        correction_reason: input.reason,
      },
      include: { readingRoom: { select: { name: true } } },
    });

    const audit = await prisma.attendanceAudit.create({
      data: {
        tenant_id: req.tenantId!,
        attendance_id: attendanceId,
        action: 'correct',
        performed_by: actor.sub,
        performed_by_role: actor.role,
        reason: input.reason,
        notes: input.notes ?? null,
        previous_value: previous,
        new_value: { status: input.status },
        performed_at: now,
      },
    });

    return ok(
      res,
      toAttendanceDto(updated, {
        readingRoomName: updated.readingRoom?.name,
        audit: {
          performedByUserId: audit.performed_by,
          performedByRole: audit.performed_by_role,
          reason: audit.reason,
          notes: audit.notes,
          performedAt: audit.performed_at?.toISOString?.() ?? audit.performed_at,
        },
      }),
      'Attendance corrected'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to correct attendance');
  }
};

async function assertLogScope(prisma: any, actor: Actor, libraryId?: string | null, readingRoomId?: string | null) {
  if (readingRoomId) {
    await assertRoomAccess(prisma, actor, readingRoomId);
    return;
  }
  if (libraryId) {
    await assertLibraryAccess(prisma, actor, libraryId);
    return;
  }
  assertStaff(actor);
}

// ---------------------------------------------------------------------------
// Daily register — OWNER / COORDINATOR
// ---------------------------------------------------------------------------
export const dailyRegister = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const query = registerQuerySchema.parse(req.query);

    const libraryIds = await resolveLibraryIds(prisma, actor, query.libraryId);
    const roomIds = await resolveAccessibleRoomIds(
      prisma,
      actor,
      libraryIds,
      query.readingRoomId
    );

    if (!roomIds.length) {
      return ok(
        res,
        {
          summary: {
            totalStudents: 0,
            present: 0,
            checkedIn: 0,
            absent: 0,
            late: 0,
            halfDay: 0,
            leave: 0,
            pending: 0,
          },
          records: [],
          pagination: { page: query.page, limit: query.limit, total: 0, totalPages: 0 },
        },
        'Daily register fetched'
      );
    }

    const search = query.search;
    const assignments = await prisma.seatAssignment.findMany({
      where: {
        status: 'ACTIVE',
        seat: { room_id: { in: roomIds } },
        ...(search
          ? {
              student: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { mobile: { contains: search } },
                ],
              },
            }
          : {}),
      },
      include: {
        student: { select: { student_id: true, name: true, mobile: true, status: true } },
        seat: {
          select: {
            seat_number: true,
            room_id: true,
            room: { select: { room_id: true, name: true, library_id: true } },
          },
        },
      },
      orderBy: [{ seat: { seat_number: 'asc' } }],
    });

    const rows = assignments.filter((a: any) => a.student?.status === 'active');
    const studentIds = rows.map((a: any) => a.student.student_id);

    const logs = studentIds.length
      ? await prisma.attendanceLog.findMany({
          where: { date: parseDateOnly(query.date), student_id: { in: studentIds } },
          include: { readingRoom: { select: { name: true } } },
        })
      : [];
    const logByStudent = new Map<string, any>();
    for (const l of logs) {
      if (!logByStudent.has(l.student_id)) logByStudent.set(l.student_id, l);
    }

    const countByStatus = (s: string) =>
      rows.filter((a: any) => (logByStudent.get(a.student.student_id)?.status ?? 'pending') === s)
        .length;

    const summary = {
      totalStudents: rows.length,
      present: countByStatus('present'),
      checkedIn: countByStatus('checked_in'),
      absent: countByStatus('absent'),
      late: countByStatus('late'),
      halfDay: countByStatus('half_day'),
      leave: countByStatus('leave'),
      pending: countByStatus('pending'),
    };

    let filtered = rows;
    if (query.status) {
      filtered = rows.filter(
        (a: any) => (logByStudent.get(a.student.student_id)?.status ?? 'pending') === query.status
      );
    }

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
    const start = (query.page - 1) * query.limit;
    const pageRows = filtered.slice(start, start + query.limit);

    const records = pageRows.map((a: any) => {
      const log = logByStudent.get(a.student.student_id);
      if (!log) {
        return {
          attendanceId: null,
          student: {
            id: a.student.student_id,
            name: a.student.name,
            admissionNumber: a.student.student_id,
            mobile: a.student.mobile,
          },
          attendanceDate: query.date,
          libraryId: a.seat.room.library_id,
          readingRoomId: a.seat.room.room_id,
          readingRoomName: a.seat.room.name,
          seatNumber: a.seat.seat_number,
          checkInAt: null,
          checkOutAt: null,
          status: 'pending',
          source: null,
        };
      }
      return {
        attendanceId: log.log_id,
        student: {
          id: a.student.student_id,
          name: a.student.name,
          admissionNumber: a.student.student_id,
          mobile: a.student.mobile,
        },
        attendanceDate: query.date,
        libraryId: log.library_id ?? a.seat.room.library_id,
        readingRoomId: log.reading_room_id ?? a.seat.room.room_id,
        readingRoomName: log.readingRoom?.name ?? a.seat.room.name,
        seatNumber: a.seat.seat_number,
        checkInAt: log.entry_time?.toISOString?.() ?? null,
        checkOutAt: log.exit_time ? log.exit_time.toISOString?.() ?? log.exit_time : null,
        status: log.status,
        source: log.source,
      };
    });

    return ok(
      res,
      {
        summary,
        records,
        pagination: { page: query.page, limit: query.limit, total, totalPages },
      },
      'Daily register fetched'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to fetch daily register');
  }
};

// ---------------------------------------------------------------------------
// Monthly report — OWNER / COORDINATOR
// ---------------------------------------------------------------------------
export const monthlyReport = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const query = monthlyReportQuerySchema.parse(req.query);

    const libraryIds = await resolveLibraryIds(prisma, actor, query.libraryId);
    const roomIds = await resolveAccessibleRoomIds(
      prisma,
      actor,
      libraryIds,
      query.readingRoomId
    );

    if (!roomIds.length) {
      return ok(
        res,
        {
          month: query.month,
          summary: {
            workingDays: 0,
            totalStudents: 0,
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            halfDayCount: 0,
            leaveCount: 0,
          },
          students: [],
        },
        'Monthly report fetched'
      );
    }

    const search = query.search;
    const assignments = await prisma.seatAssignment.findMany({
      where: {
        status: 'ACTIVE',
        seat: { room_id: { in: roomIds } },
        ...(search
          ? {
              student: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { mobile: { contains: search } },
                ],
              },
            }
          : {}),
      },
      include: {
        student: { select: { student_id: true, name: true, status: true } },
        seat: {
          select: {
            seat_number: true,
            room_id: true,
            room: { select: { room_id: true, name: true } },
          },
        },
      },
    });

    const rows = assignments.filter((a: any) => a.student?.status === 'active');
    const studentIds = rows.map((a: any) => a.student.student_id);
    const { from, to } = monthRange(query.month);

    const logs = studentIds.length
      ? await prisma.attendanceLog.findMany({
          where: {
            student_id: { in: studentIds },
            date: { gte: from, lt: to },
          },
        })
      : [];

    const workingDays = new Set(logs.map((l: any) => l.date.toISOString().split('T')[0])).size;

    const byStudent = new Map<string, any>();
    for (const a of rows) {
      byStudent.set(a.student.student_id, {
        studentId: a.student.student_id,
        studentName: a.student.name,
        admissionNumber: a.student.student_id,
        readingRoomId: a.seat.room.room_id,
        readingRoomName: a.seat.room.name,
        seatNumber: a.seat.seat_number,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        halfDayDays: 0,
        leaveDays: 0,
        checkedInDays: 0,
      });
    }

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;

    for (const l of logs) {
      const entry = byStudent.get(l.student_id);
      if (!entry) continue;
      switch (l.status) {
        case 'present':
          entry.presentDays++;
          presentCount++;
          break;
        case 'checked_in':
          entry.checkedInDays++;
          presentCount++;
          break;
        case 'absent':
          entry.absentDays++;
          absentCount++;
          break;
        case 'late':
          entry.lateDays++;
          lateCount++;
          break;
        case 'half_day':
          entry.halfDayDays++;
          halfDayCount++;
          break;
        case 'leave':
          entry.leaveDays++;
          leaveCount++;
          break;
      }
    }

    const students = [...byStudent.values()].map((s) => {
      const totalDays = s.presentDays + s.checkedInDays + s.absentDays + s.lateDays + s.halfDayDays + s.leaveDays;
      return {
        ...s,
        totalWorkingDays: workingDays,
        attendancePercentage:
          totalDays === 0 ? 0 : Math.round(((s.presentDays + s.checkedInDays + s.lateDays) / totalDays) * 100),
      };
    });

    return ok(
      res,
      {
        month: query.month,
        summary: {
          workingDays,
          totalStudents: students.length,
          presentCount,
          absentCount,
          lateCount,
          halfDayCount,
          leaveCount,
        },
        students,
      },
      'Monthly report fetched'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to fetch monthly report');
  }
};

// ---------------------------------------------------------------------------
// Student history — staff OR STUDENT self (GET /:studentId must be last)
// ---------------------------------------------------------------------------
export const getStudentAttendance = async (req: Request, res: Response) => {
  try {
    const actor = actorOf(req);
    const prisma = getTenantPrisma(req.tenantId!);
    const studentId = req.params.studentId as string;
    const query = historyQuerySchema.parse(req.query);

    if (actor.role === 'STUDENT') {
      if (actor.sub !== studentId) {
        return fail(res, 'Students may only view their own history', 403, 'FORBIDDEN');
      }
    } else {
      assertStaff(actor);
    }

    const student = await prisma.student.findUnique({
      where: { student_id: studentId },
      select: { student_id: true, name: true, mobile: true },
    });
    if (!student) {
      return fail(res, 'Student not found', 404, 'NOT_FOUND');
    }

    const where: any = { student_id: studentId };
    if (query.month) {
      const { from, to } = monthRange(query.month);
      where.date = { gte: from, lt: to };
    }
    if (query.status) where.status = query.status;

    const total = await prisma.attendanceLog.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
    const logs = await prisma.attendanceLog.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { readingRoom: { select: { name: true } } },
    });

    const records = logs.map((log: any) => toAttendanceDto(log));

    return ok(
      res,
      {
        studentId,
        studentName: student.name,
        records,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages,
        },
      },
      'Attendance history fetched'
    );
  } catch (error) {
    return handleError(res, error, 'Failed to fetch attendance history');
  }
};
