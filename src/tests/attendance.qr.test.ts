import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import {
  createQrSession,
  getQrSession,
  stopQrSession,
  studentCheckIn,
  studentCheckOut,
  manualAttendance,
  correctAttendance,
  dailyRegister,
  monthlyReport,
  getStudentAttendance,
} from '../controllers/attendance.controller';

jest.mock('../config/prisma');

const ROOM = '932d557c-53eb-47cf-b2cb-07bebb60d676';
const LIB = '4cb4527d-0187-4a8c-8b6b-c5cc554a940b';
const STUDENT = '550e8400-e29b-41d4-a716-446655440000';
const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const LOG_ID = '11111111-2222-3333-4444-555555555555';
const QR = 'cGF5bG9hZC12YWxpZC1xcnBheWxvYWQtZm9yLXRlc3Rz';
const EVENT = 'device-event-0001';

describe('Attendance QR + staff handlers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrisma: any;

  const roomRow = {
    room_id: ROOM,
    library_id: LIB,
    name: 'First Floor Reading Room',
    capacity: 40,
    floor_id: 'floor-1',
  };

  const activeSession = {
    session_id: SESSION,
    tenant_id: 'tenant-1',
    library_id: LIB,
    reading_room_id: ROOM,
    action_type: 'check_in',
    qr_payload: QR,
    valid_for_seconds: 300,
    status: 'active',
    issued_at: new Date('2026-11-27T09:00:00Z'),
    expires_at: new Date(Date.now() + 60_000),
    stopped_at: null,
    created_by: 'owner-1',
    created_by_role: 'OWNER',
    readingRoom: { name: 'First Floor Reading Room' },
  };

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      tenantId: 'tenant-1',
      user: { sub: 'owner-1', tenant_id: 'tenant-1', role: 'OWNER' },
      body: {},
      query: {},
      params: {},
    };
    mockResponse = { json: jsonMock, status: statusMock };

    mockPrisma = {
      library: { findFirst: jest.fn(), findMany: jest.fn() },
      readingRoom: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
      floor: { findMany: jest.fn() },
      student: { findFirst: jest.fn(), findUnique: jest.fn() },
      seatAssignment: { findFirst: jest.fn(), findMany: jest.fn() },
      coordinatorAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      attendanceQrSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      attendanceLog: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      attendanceAudit: { create: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(mockPrisma)),
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrisma);

    mockPrisma.library.findFirst.mockResolvedValue({ library_id: LIB, name: 'Main' });
    mockPrisma.readingRoom.findFirst.mockResolvedValue(roomRow);
    mockPrisma.readingRoom.findMany.mockResolvedValue([roomRow]);
    mockPrisma.floor.findMany.mockResolvedValue([{ floor_id: 'floor-1' }]);
  });

  const run = async (fn: any) => {
    await fn(mockRequest as Request, mockResponse as Response);
  };

  describe('createQrSession', () => {
    it('creates active session with opaque payload', async () => {
      mockRequest.body = {
        readingRoomId: ROOM,
        validForSeconds: 300,
        attendanceDate: '2026-11-27',
        actionType: 'check_in',
      };
      mockPrisma.attendanceQrSession.create.mockResolvedValue(activeSession);

      await run(createQrSession);

      expect(mockPrisma.attendanceQrSession.updateMany).toHaveBeenCalled();
      expect(mockPrisma.attendanceQrSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reading_room_id: ROOM,
            action_type: 'check_in',
            status: 'active',
          }),
        })
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, statusCode: 201 })
      );
    });

    it('returns 404 NOT_FOUND for missing room', async () => {
      mockRequest.body = {
        readingRoomId: ROOM,
        attendanceDate: '2026-11-27',
        actionType: 'check_in',
      };
      mockPrisma.readingRoom.findFirst.mockResolvedValue(null);

      await run(createQrSession);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    });
  });

  describe('getQrSession', () => {
    it('returns 404 NO_ACTIVE_SESSION when none', async () => {
      mockRequest.query = { readingRoomId: ROOM };
      mockPrisma.attendanceQrSession.findFirst.mockResolvedValue(null);

      await run(getQrSession);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_ACTIVE_SESSION' })
      );
    });

    it('expires stale active session and returns 404', async () => {
      mockRequest.query = { readingRoomId: ROOM };
      mockPrisma.attendanceQrSession.findFirst.mockResolvedValue({
        ...activeSession,
        expires_at: new Date(Date.now() - 1000),
      });
      mockPrisma.attendanceQrSession.update.mockResolvedValue({});

      await run(getQrSession);

      expect(mockPrisma.attendanceQrSession.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'expired' } })
      );
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('returns active session', async () => {
      mockRequest.query = { readingRoomId: ROOM };
      mockPrisma.attendanceQrSession.findFirst.mockResolvedValue(activeSession);

      await run(getQrSession);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: SESSION, qrPayload: QR }),
        })
      );
    });
  });

  describe('stopQrSession', () => {
    it('stops active session', async () => {
      mockRequest.body = { readingRoomId: ROOM, sessionId: SESSION };
      mockPrisma.attendanceQrSession.findFirst.mockResolvedValue(activeSession);
      mockPrisma.attendanceQrSession.update.mockResolvedValue({
        ...activeSession,
        status: 'stopped',
        stopped_at: new Date(),
      });

      await run(stopQrSession);

      expect(mockPrisma.attendanceQrSession.update).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'stopped' }) })
      );
    });

    it('returns 404 when session not in room', async () => {
      mockRequest.body = { readingRoomId: ROOM, sessionId: SESSION };
      mockPrisma.attendanceQrSession.findFirst.mockResolvedValue(null);

      await run(stopQrSession);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  describe('studentCheckIn', () => {
    beforeEach(() => {
      mockRequest.user = { sub: STUDENT, tenant_id: 'tenant-1', role: 'STUDENT' };
      mockRequest.body = { qrPayload: QR, deviceEventId: EVENT };
      mockPrisma.attendanceLog.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceQrSession.findUnique.mockResolvedValue(activeSession);
      mockPrisma.student.findFirst.mockResolvedValue({
        student_id: STUDENT,
        name: 'Rahim',
        mobile: '9800000001',
      });
      mockPrisma.seatAssignment.findFirst.mockResolvedValue({
        assignment_id: 'a1',
        seat: { seat_number: 'A-12', room_id: ROOM },
      });
      mockPrisma.attendanceLog.findFirst.mockResolvedValue(null);
      mockPrisma.attendanceLog.create.mockResolvedValue({
        log_id: LOG_ID,
        student_id: STUDENT,
        library_id: LIB,
        reading_room_id: ROOM,
        session_id: SESSION,
        date: new Date('2026-11-27T00:00:00Z'),
        entry_time: new Date(),
        exit_time: null,
        status: 'checked_in',
        source: 'qr',
        device_event_id: EVENT,
      });
    });

    it('records check-in from valid QR', async () => {
      await run(studentCheckIn);

      expect(mockPrisma.attendanceLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            student_id: STUDENT,
            status: 'checked_in',
            source: 'qr',
            device_event_id: EVENT,
          }),
        })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Attendance check-in recorded',
        })
      );
    });

    it('is idempotent on deviceEventId', async () => {
      mockPrisma.attendanceLog.findUnique.mockResolvedValue({
        log_id: LOG_ID,
        student_id: STUDENT,
        status: 'checked_in',
        entry_time: new Date(),
        date: new Date('2026-11-27T00:00:00Z'),
      });

      await run(studentCheckIn);

      expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Attendance check-in recorded' })
      );
    });

    it('returns 400 INVALID_QR for unknown payload', async () => {
      mockPrisma.attendanceQrSession.findUnique.mockResolvedValue(null);

      await run(studentCheckIn);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_QR' }));
    });

    it('returns 400 QR_SESSION_EXPIRED for expired session', async () => {
      mockPrisma.attendanceQrSession.findUnique.mockResolvedValue({
        ...activeSession,
        expires_at: new Date(Date.now() - 1000),
      });

      await run(studentCheckIn);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'QR_SESSION_EXPIRED' })
      );
    });

    it('returns 400 QR_ACTION_MISMATCH when session is check_out', async () => {
      mockPrisma.attendanceQrSession.findUnique.mockResolvedValue({
        ...activeSession,
        action_type: 'check_out',
      });

      await run(studentCheckIn);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'QR_ACTION_MISMATCH' })
      );
    });

    it('returns 409 ATTENDANCE_ALREADY_CHECKED_IN when log exists today', async () => {
      mockPrisma.attendanceLog.findFirst.mockResolvedValue({
        log_id: LOG_ID,
        status: 'checked_in',
      });

      await run(studentCheckIn);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ATTENDANCE_ALREADY_CHECKED_IN' })
      );
    });

    it('returns 403 STUDENT_NOT_ASSIGNED_TO_LIBRARY when no seat', async () => {
      mockPrisma.seatAssignment.findFirst.mockResolvedValue(null);

      await run(studentCheckIn);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'STUDENT_NOT_ASSIGNED_TO_LIBRARY' })
      );
    });
  });

  describe('studentCheckOut', () => {
    const openLog = {
      log_id: LOG_ID,
      student_id: STUDENT,
      library_id: LIB,
      reading_room_id: ROOM,
      status: 'checked_in',
      entry_time: new Date('2026-11-27T09:00:00Z'),
      date: new Date('2026-11-27T00:00:00Z'),
    };

    beforeEach(() => {
      mockRequest.user = { sub: STUDENT, tenant_id: 'tenant-1', role: 'STUDENT' };
      mockRequest.body = { qrPayload: QR, deviceEventId: 'device-event-out-1' };
      mockPrisma.attendanceLog.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceQrSession.findUnique.mockResolvedValue({
        ...activeSession,
        action_type: 'check_out',
      });
      mockPrisma.attendanceLog.findFirst.mockResolvedValue(openLog);
      mockPrisma.attendanceLog.update.mockResolvedValue({
        ...openLog,
        exit_time: new Date(),
        status: 'present',
        device_event_id: 'device-event-out-1',
      });
    });

    it('records check-out and sets present', async () => {
      await run(studentCheckOut);

      expect(mockPrisma.attendanceLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'present' }),
        })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Attendance check-out recorded' })
      );
    });

    it('returns 409 NO_ACTIVE_CHECK_IN when none open', async () => {
      mockPrisma.attendanceLog.findFirst.mockResolvedValue(null);

      await run(studentCheckOut);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_ACTIVE_CHECK_IN' })
      );
    });

    it('returns 409 ROOM_MISMATCH when different room', async () => {
      mockPrisma.attendanceLog.findFirst.mockResolvedValue({
        ...openLog,
        reading_room_id: 'other-room-id-0000-0000-000000000000',
      });

      await run(studentCheckOut);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'ROOM_MISMATCH' }));
    });
  });

  describe('manualAttendance', () => {
    beforeEach(() => {
      mockRequest.body = {
        studentId: STUDENT,
        libraryId: LIB,
        readingRoomId: ROOM,
        action: 'check_in',
        reason: 'Student phone was unavailable',
        source: 'manual',
        deviceEventId: 'manual-event-0001',
      };
      mockPrisma.student.findFirst.mockResolvedValue({
        student_id: STUDENT,
        name: 'Rahim',
        mobile: '9800000001',
      });
      mockPrisma.seatAssignment.findFirst.mockResolvedValue({
        assignment_id: 'a1',
        seat: { seat_number: 'A-12', room_id: ROOM },
      });
      mockPrisma.attendanceLog.findUnique.mockResolvedValue(null);
      mockPrisma.attendanceLog.findFirst.mockResolvedValue(null);
      mockPrisma.attendanceLog.create.mockResolvedValue({
        log_id: LOG_ID,
        student_id: STUDENT,
        library_id: LIB,
        reading_room_id: ROOM,
        date: new Date('2026-11-27T00:00:00Z'),
        entry_time: new Date(),
        status: 'checked_in',
        source: 'manual',
        device_event_id: 'manual-event-0001',
      });
      mockPrisma.attendanceAudit.create.mockResolvedValue({
        audit_id: 'aud-1',
        performed_by: 'owner-1',
        performed_by_role: 'OWNER',
        reason: 'Student phone was unavailable',
        performed_at: new Date(),
      });
    });

    it('records manual check-in with audit', async () => {
      await run(manualAttendance);

      expect(mockPrisma.attendanceLog.create).toHaveBeenCalled();
      expect(mockPrisma.attendanceAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'manual_check_in' }),
        })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Manual attendance recorded' })
      );
    });

    it('returns 403 when reading room not in provided library', async () => {
      mockPrisma.readingRoom.findFirst.mockResolvedValue({
        ...roomRow,
        library_id: 'other-lib-0000-0000-000000000000',
      });

      await run(manualAttendance);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'READING_ROOM_NOT_IN_ACTIVE_LIBRARY' })
      );
    });

    it('returns 409 NO_ACTIVE_CHECK_IN for manual check-out with no open log', async () => {
      mockRequest.body.action = 'check_out';
      mockPrisma.attendanceLog.findFirst.mockResolvedValue(null);

      await run(manualAttendance);

      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NO_ACTIVE_CHECK_IN' })
      );
    });
  });

  describe('correctAttendance', () => {
    const logRow = {
      log_id: LOG_ID,
      student_id: STUDENT,
      library_id: LIB,
      reading_room_id: ROOM,
      status: 'pending',
      entry_time: new Date(),
      date: new Date('2026-11-27T00:00:00Z'),
      readingRoom: { name: 'First Floor Reading Room' },
    };

    beforeEach(() => {
      mockRequest.params = { attendanceId: LOG_ID };
      mockRequest.body = {
        status: 'present',
        reason: 'Approved correction after register review',
        notes: 'Corrected by authorized staff',
      };
      mockPrisma.attendanceLog.findUnique.mockResolvedValue(logRow);
      mockPrisma.attendanceLog.update.mockResolvedValue({
        ...logRow,
        status: 'present',
        corrected_by: 'owner-1',
        corrected_at: new Date(),
      });
      mockPrisma.attendanceAudit.create.mockResolvedValue({
        audit_id: 'aud-2',
        performed_by: 'owner-1',
        performed_by_role: 'OWNER',
        reason: 'Approved correction after register review',
        notes: 'Corrected by authorized staff',
        performed_at: new Date(),
      });
    });

    it('overwrites status and writes audit', async () => {
      await run(correctAttendance);

      expect(mockPrisma.attendanceLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'present' }),
        })
      );
      expect(mockPrisma.attendanceAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'correct' }),
        })
      );
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Attendance corrected' })
      );
    });

    it('returns 404 ATTENDANCE_NOT_FOUND', async () => {
      mockPrisma.attendanceLog.findUnique.mockResolvedValue(null);

      await run(correctAttendance);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ATTENDANCE_NOT_FOUND' })
      );
    });
  });

  describe('dailyRegister', () => {
    beforeEach(() => {
      mockRequest.query = { date: '2026-11-27', page: '1', limit: '50' };
      mockPrisma.library.findMany.mockResolvedValue([{ library_id: LIB }]);
      mockPrisma.seatAssignment.findMany.mockResolvedValue([
        {
          student: { student_id: STUDENT, name: 'Rahim', mobile: '9800000001', status: 'active' },
          seat: {
            seat_number: 'A-12',
            room_id: ROOM,
            room: { room_id: ROOM, name: 'First Floor Reading Room', library_id: LIB },
          },
        },
      ]);
      mockPrisma.attendanceLog.findMany.mockResolvedValue([
        {
          log_id: LOG_ID,
          student_id: STUDENT,
          library_id: LIB,
          reading_room_id: ROOM,
          status: 'checked_in',
          entry_time: new Date('2026-11-27T09:00:00Z'),
          exit_time: null,
          source: 'qr',
          readingRoom: { name: 'First Floor Reading Room' },
        },
      ]);
    });

    it('returns summary + records + pagination', async () => {
      await run(dailyRegister);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            summary: expect.objectContaining({ totalStudents: 1, checkedIn: 1 }),
            records: expect.arrayContaining([
              expect.objectContaining({ attendanceId: LOG_ID, status: 'checked_in' }),
            ]),
            pagination: expect.objectContaining({ total: 1, page: 1 }),
          }),
        })
      );
    });
  });

  describe('monthlyReport', () => {
    beforeEach(() => {
      mockRequest.query = { month: '2026-11' };
      mockPrisma.library.findMany.mockResolvedValue([{ library_id: LIB }]);
      mockPrisma.seatAssignment.findMany.mockResolvedValue([
        {
          student: { student_id: STUDENT, name: 'Rahim', status: 'active' },
          seat: {
            seat_number: 'A-12',
            room_id: ROOM,
            room: { room_id: ROOM, name: 'First Floor Reading Room' },
          },
        },
      ]);
      mockPrisma.attendanceLog.findMany.mockResolvedValue([
        {
          log_id: LOG_ID,
          student_id: STUDENT,
          status: 'present',
          date: new Date('2026-11-27T00:00:00Z'),
        },
        {
          log_id: LOG_ID + '2',
          student_id: STUDENT,
          status: 'absent',
          date: new Date('2026-11-26T00:00:00Z'),
        },
      ]);
    });

    it('aggregates per-student day counts', async () => {
      await run(monthlyReport);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            month: '2026-11',
            summary: expect.objectContaining({ presentCount: 1, absentCount: 1 }),
            students: expect.arrayContaining([
              expect.objectContaining({ studentId: STUDENT, presentDays: 1, absentDays: 1 }),
            ]),
          }),
        })
      );
    });
  });

  describe('getStudentAttendance', () => {
    beforeEach(() => {
      mockRequest.params = { studentId: STUDENT };
      mockRequest.query = { page: '1', pageSize: '50' };
      mockPrisma.student.findUnique.mockResolvedValue({
        student_id: STUDENT,
        name: 'Rahim',
        mobile: '9800000001',
      });
      mockPrisma.attendanceLog.count.mockResolvedValue(1);
      mockPrisma.attendanceLog.findMany.mockResolvedValue([
        {
          log_id: LOG_ID,
          student_id: STUDENT,
          status: 'present',
          date: new Date('2026-11-27T00:00:00Z'),
          entry_time: new Date('2026-11-27T09:00:00Z'),
          exit_time: new Date('2026-11-27T17:00:00Z'),
          source: 'qr',
          readingRoom: { name: 'First Floor Reading Room' },
        },
      ]);
    });

    it('staff can fetch history with pagination', async () => {
      await run(getStudentAttendance);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: STUDENT,
            records: expect.any(Array),
            pagination: expect.objectContaining({ total: 1 }),
          }),
        })
      );
    });

    it('STUDENT can fetch own history', async () => {
      mockRequest.user = { sub: STUDENT, tenant_id: 'tenant-1', role: 'STUDENT' };

      await run(getStudentAttendance);

      expect(statusMock).not.toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    it('STUDENT cannot fetch another student history', async () => {
      mockRequest.user = { sub: STUDENT, tenant_id: 'tenant-1', role: 'STUDENT' };
      mockRequest.params = { studentId: '99999999-8888-7777-6666-555555555555' };

      await run(getStudentAttendance);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    });
  });
});
