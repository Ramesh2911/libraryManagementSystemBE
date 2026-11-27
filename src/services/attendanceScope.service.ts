import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class ScopeError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface Actor {
  sub: string;
  tenant_id?: string;
  role: string;
}

function isStaff(actor: Actor): boolean {
  return actor.role === 'OWNER' || actor.role === 'SUPER_ADMIN' || actor.role === 'COORDINATOR';
}

/** OWNER: library must exist in tenant. COORDINATOR: ACTIVE assignment must cover the library. */
export async function assertLibraryAccess(prisma: any, actor: Actor, libraryId: string) {
  const lib = await prisma.library.findFirst({
    where: { library_id: libraryId, status: { not: 'deleted' } },
    select: { library_id: true, name: true },
  });
  if (!lib) {
    throw new ScopeError('Library not found', 'NOT_FOUND', 404);
  }
  if (actor.role === 'OWNER' || actor.role === 'SUPER_ADMIN') return lib;

  if (actor.role !== 'COORDINATOR') {
    throw new ScopeError('Insufficient permissions', 'FORBIDDEN', 403);
  }

  const floors = await prisma.floor.findMany({
    where: { library_id: libraryId },
    select: { floor_id: true },
  });
  const floorIds = floors.map((f: any) => f.floor_id);
  const rooms = await prisma.readingRoom.findMany({
    where: { library_id: libraryId },
    select: { room_id: true },
  });
  const roomIds = rooms.map((r: any) => r.room_id);

  const assignment = await prisma.coordinatorAssignment.findFirst({
    where: {
      coordinator_id: actor.sub,
      status: 'ACTIVE',
      OR: [
        { library_id: libraryId },
        ...(floorIds.length ? [{ floor_id: { in: floorIds } }] : []),
        ...(roomIds.length ? [{ room_id: { in: roomIds } }] : []),
      ],
    },
    select: { assignment_id: true },
  });
  if (!assignment) {
    throw new ScopeError('Coordinator not assigned to this library', 'FORBIDDEN_LIBRARY_SCOPE', 403);
  }
  return lib;
}

/** Resolve room + assert actor can use it. Returns { room, libraryId }. */
export async function assertRoomAccess(prisma: any, actor: Actor, readingRoomId: string) {
  const room = await prisma.readingRoom.findFirst({
    where: { room_id: readingRoomId, status: 'active' },
    select: { room_id: true, library_id: true, name: true, capacity: true, floor_id: true },
  });
  if (!room) {
    throw new ScopeError('Reading room not found', 'NOT_FOUND', 404);
  }
  await assertLibraryAccess(prisma, actor, room.library_id);
  return { room, libraryId: room.library_id };
}

/** Student must have an ACTIVE seat assignment in the library (optionally a specific room). */
export async function assertStudentInLibrary(
  prisma: any,
  studentId: string,
  libraryId: string,
  readingRoomId?: string
) {
  const student = await prisma.student.findFirst({
    where: { student_id: studentId, status: 'active' },
    select: { student_id: true, name: true, mobile: true },
  });
  if (!student) {
    throw new ScopeError('Student not found or inactive', 'NOT_FOUND', 404);
  }

  const assignment = await prisma.seatAssignment.findFirst({
    where: {
      student_id: studentId,
      status: 'ACTIVE',
      seat: {
        room: {
          library_id: libraryId,
          ...(readingRoomId ? { room_id: readingRoomId } : {}),
        },
      },
    },
    select: { assignment_id: true, seat: { select: { seat_number: true, room_id: true } } },
  });
  if (!assignment) {
    throw new ScopeError(
      readingRoomId
        ? 'Student not assigned to this reading room'
        : 'Student not assigned to this library',
      'STUDENT_NOT_ASSIGNED_TO_LIBRARY',
      403
    );
  }
  return { student, assignment };
}

/** Resolve library ids the actor can operate on. If libraryId given, assert access and return [libraryId]. */
export async function resolveLibraryIds(
  prisma: any,
  actor: Actor,
  libraryId?: string
): Promise<string[]> {
  if (libraryId) {
    await assertLibraryAccess(prisma, actor, libraryId);
    return [libraryId];
  }
  if (actor.role === 'OWNER' || actor.role === 'SUPER_ADMIN') {
    const libs = await prisma.library.findMany({
      where: { status: { not: 'deleted' } },
      select: { library_id: true },
    });
    return libs.map((l: any) => l.library_id);
  }
  if (actor.role !== 'COORDINATOR') {
    throw new ScopeError('Insufficient permissions', 'FORBIDDEN', 403);
  }
  const assignments = await prisma.coordinatorAssignment.findMany({
    where: { coordinator_id: actor.sub, status: 'ACTIVE' },
    select: { library_id: true, floor_id: true, room_id: true },
  });
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.library_id) ids.add(a.library_id);
    if (a.floor_id) {
      const rooms = await prisma.readingRoom.findMany({
        where: { floor_id: a.floor_id },
        select: { library_id: true },
      });
      rooms.forEach((r: any) => ids.add(r.library_id));
    }
    if (a.room_id) {
      const room = await prisma.readingRoom.findUnique({
        where: { room_id: a.room_id },
        select: { library_id: true },
      });
      if (room) ids.add(room.library_id);
    }
  }
  return [...ids];
}

/** Resolve room ids the actor can see inside the given libraries. */
export async function resolveAccessibleRoomIds(
  prisma: any,
  actor: Actor,
  libraryIds: string[],
  readingRoomId?: string
): Promise<string[]> {
  if (readingRoomId) {
    const { room } = await assertRoomAccess(prisma, actor, readingRoomId);
    if (libraryIds.length && !libraryIds.includes(room.library_id)) {
      throw new ScopeError(
        'Reading room not in accessible library',
        'READING_ROOM_NOT_IN_ACTIVE_LIBRARY',
        403
      );
    }
    return [room.room_id];
  }
  if (!libraryIds.length) return [];

  const rooms = await prisma.readingRoom.findMany({
    where: { library_id: { in: libraryIds }, status: 'active' },
    select: { room_id: true, library_id: true, floor_id: true },
  });
  if (actor.role !== 'COORDINATOR') return rooms.map((r: any) => r.room_id);

  const assignments = await prisma.coordinatorAssignment.findMany({
    where: { coordinator_id: actor.sub, status: 'ACTIVE' },
    select: { library_id: true, floor_id: true, room_id: true },
  });
  const fullLibs = new Set(
    assignments.filter((a: any) => a.library_id && libraryIds.includes(a.library_id)).map((a: any) => a.library_id)
  );
  const allowed = new Set<string>();
  for (const r of rooms) {
    if (fullLibs.has(r.library_id)) {
      allowed.add(r.room_id);
      continue;
    }
    for (const a of assignments) {
      if (a.room_id && a.room_id === r.room_id) {
        allowed.add(r.room_id);
        break;
      }
      if (a.floor_id && r.floor_id === a.floor_id) {
        allowed.add(r.room_id);
        break;
      }
    }
  }
  return [...allowed];
}

/** Staff-only guard for student history / audit views. */
export function assertStaff(actor: Actor) {
  if (!isStaff(actor)) {
    throw new ScopeError('Insufficient permissions', 'FORBIDDEN', 403);
  }
}

/** Asia/Kolkata day start (UTC Date). Same helper as dashboard. */
export function istDayStart(d: Date): Date {
  const IST_OFFSET_MIN = 330;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const ist = new Date(utc + IST_OFFSET_MIN * 60000);
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MIN * 60000);
}

/** Parse YYYY-MM-DD as UTC midnight date (matches existing sync storage). */
export function parseDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** First day of month (YYYY-MM) as UTC date, and next month start. */
export function monthRange(month: string): { from: Date; to: Date } {
  const [y, m] = month.split('-').map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { from, to };
}

/** Opaque QR session payload. */
export function issueQrPayload(): string {
  return crypto.randomBytes(32).toString('base64url');
}
