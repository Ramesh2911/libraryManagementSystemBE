import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { ok, fail } from '../utils/response';
import {
  basicDetailsSchema,
  locationDetailsSchema,
  operationTimingSchema,
  roomsSetupSchema,
  feesDepositSchema,
  finalizeSchema,
} from '../validations/ownerSetup.validation';

const DRAFT_TTL_SEC = 24 * 60 * 60; // 24h

type StepName =
  | 'basic_details'
  | 'location_details'
  | 'operation_timing'
  | 'rooms_setup'
  | 'fees_deposit'
  | 'review_summary'
  | 'finalize';

interface SetupDraft {
  readingRoomId: string;
  basic?: Record<string, unknown>;
  location?: Record<string, unknown>;
  timing?: Record<string, unknown>;
  rooms?: Record<string, unknown>;
  fees?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const draftKey = (tenantId: string) => `setup:draft:${tenantId}`;

async function loadDraft(tenantId: string): Promise<SetupDraft | null> {
  const raw = await redis.get(draftKey(tenantId));
  return raw ? (JSON.parse(raw) as SetupDraft) : null;
}

async function saveDraft(tenantId: string, draft: SetupDraft): Promise<void> {
  draft.updatedAt = new Date().toISOString();
  await redis.set(draftKey(tenantId), JSON.stringify(draft), 'EX', DRAFT_TTL_SEC);
}

async function ensureDraft(tenantId: string): Promise<SetupDraft> {
  const existing = await loadDraft(tenantId);
  if (existing) return existing;
  const now = new Date().toISOString();
  return {
    readingRoomId: `hub_draft_${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
  };
}

function zodFail(res: Response, err: any) {
  if (err?.name === 'ZodError') {
    return fail(res, 'Validation failed', 400, 'VALIDATION_ERROR');
  }
  console.error(err);
  return fail(res, 'Setup step failed', 500);
}

// ---- Step 1 ----
export const postBasicDetails = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = basicDetailsSchema.parse(req.body);
    const draft = await ensureDraft(tenantId);
    draft.basic = data as Record<string, unknown>;
    await saveDraft(tenantId, draft);

    const libraryName = (data.libraryName || data.readingRoomName) as string;
    return ok(
      res,
      {
        readingRoomId: draft.readingRoomId,
        nextStep: 'location_details',
        basicDetails: {
          libraryName,
          branchName: data.branchName ?? null,
          ownerName: data.ownerName,
          email: data.email ?? null,
        },
      },
      'Basic details recorded.'
    );
  } catch (err) {
    return zodFail(res, err);
  }
};

// ---- Step 2 ----
export const postLocationDetails = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = locationDetailsSchema.parse(req.body);
    const draft = await loadDraft(tenantId);
    if (!draft || !draft.basic) {
      return fail(res, 'Complete basic details first', 400, 'OUT_OF_ORDER');
    }
    draft.location = data as Record<string, unknown>;
    await saveDraft(tenantId, draft);

    return ok(
      res,
      { readingRoomId: draft.readingRoomId, nextStep: 'operation_timing' },
      'Location details saved.'
    );
  } catch (err) {
    return zodFail(res, err);
  }
};

// ---- Step 3 ----
export const postOperationTiming = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = operationTimingSchema.parse(req.body);
    const draft = await loadDraft(tenantId);
    if (!draft || !draft.location) {
      return fail(res, 'Complete location details first', 400, 'OUT_OF_ORDER');
    }
    draft.timing = data as Record<string, unknown>;
    await saveDraft(tenantId, draft);

    return ok(
      res,
      { readingRoomId: draft.readingRoomId, nextStep: 'rooms_setup' },
      'Operating schedule saved.'
    );
  } catch (err) {
    return zodFail(res, err);
  }
};

// ---- Step 4 ----
export const postRoomsSetup = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = roomsSetupSchema.parse(req.body);
    const draft = await loadDraft(tenantId);
    if (!draft || !draft.timing) {
      return fail(res, 'Complete operation timing first', 400, 'OUT_OF_ORDER');
    }
    draft.rooms = data as unknown as Record<string, unknown>;
    await saveDraft(tenantId, draft);

    let totalFloors = 0;
    let totalRooms = 0;
    let totalSeats = 0;
    for (const floor of data.floors) {
      totalFloors += 1;
      for (const room of floor.rooms) {
        totalRooms += 1;
        totalSeats += room.capacity ?? room.totalSeats ?? 0;
      }
    }

    return ok(
      res,
      {
        readingRoomId: draft.readingRoomId,
        totalFloors,
        totalRooms,
        totalSeats,
        nextStep: 'fees_deposit',
      },
      'Rooms and seat matrix configured.'
    );
  } catch (err) {
    return zodFail(res, err);
  }
};

// ---- Step 5 ----
export const postFeesDeposit = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const data = feesDepositSchema.parse(req.body);
    const draft = await loadDraft(tenantId);
    if (!draft || !draft.rooms) {
      return fail(res, 'Complete rooms setup first', 400, 'OUT_OF_ORDER');
    }
    draft.fees = data as unknown as Record<string, unknown>;
    await saveDraft(tenantId, draft);

    return ok(
      res,
      { readingRoomId: draft.readingRoomId, nextStep: 'review_summary' },
      'Fee structure recorded.'
    );
  } catch (err) {
    return zodFail(res, err);
  }
};

// ---- Step 6a: review ----
export const getReviewSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const draft = await loadDraft(tenantId);
    if (!draft) return fail(res, 'No setup draft found', 404, 'NO_DRAFT');

    const steps = {
      basic_details: !!draft.basic,
      location_details: !!draft.location,
      operation_timing: !!draft.timing,
      rooms_setup: !!draft.rooms,
      fees_deposit: !!draft.fees,
    };
    const complete = Object.values(steps).every(Boolean);

    return ok(
      res,
      {
        readingRoomId: draft.readingRoomId,
        complete,
        steps,
        draft,
      },
      complete ? 'Draft ready to finalize.' : 'Draft incomplete.'
    );
  } catch (err) {
    console.error(err);
    return fail(res, 'Failed to build review summary', 500);
  }
};

// ---- Step 6b: finalize (single transaction) ----
export const postFinalize = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    finalizeSchema.parse(req.body ?? {});

    // Already provisioned? -> 409 (checked before draft so re-finalize after success is 409, not 404)
    const existingCount = await prisma.library.count({
      where: { tenant_id: tenantId, status: 'active' },
    });
    if (existingCount > 0) {
      return fail(res, 'Setup already finalized for this owner', 409, 'ALREADY_SETUP');
    }

    const draft = await loadDraft(tenantId);
    if (!draft) return fail(res, 'No setup draft found', 404, 'NO_DRAFT');
    if (!draft.basic || !draft.location || !draft.timing || !draft.rooms || !draft.fees) {
      return fail(res, 'Setup incomplete - finish all steps before finalize', 400, 'INCOMPLETE');
    }

    const basic = draft.basic as any;
    const location = draft.location as any;
    const timing = draft.timing as any;
    const rooms = draft.rooms as any;
    const fees = draft.fees as any;

    const libraryName = (basic.libraryName || basic.readingRoomName) as string;
    const addressParts = [
      location.address,
      location.area,
      location.city,
      location.state,
      location.postalCode || location.pincode,
    ].filter(Boolean);
    const address = addressParts.join(', ');

    // Collect unique room-type names (from rooms + fees)
    const roomTypeNames = new Set<string>();
    for (const floor of rooms.floors ?? []) {
      for (const room of floor.rooms ?? []) {
        const t = room.roomType || room.room_type || room.type;
        if (typeof t === 'string' && t.trim()) roomTypeNames.add(t.trim());
      }
    }
    for (const plan of fees.feePlans ?? []) {
      if (typeof plan.roomType === 'string' && plan.roomType.trim()) {
        roomTypeNames.add(plan.roomType.trim());
      }
    }
    if (roomTypeNames.size === 0) roomTypeNames.add('General');

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

        const library = await tx.library.create({
          data: {
            tenant_id: tenantId,
            name: libraryName,
            address: address || null,
            contact: basic.phone || null,
            status: 'active',
            branch_name: basic.branchName ?? null,
            owner_name: basic.ownerName ?? null,
            mobile: basic.phone || null,
            email: basic.email ?? null,
            area: location.area ?? null,
            unit: (location as any).unit ?? null,
            city: location.city ?? null,
            state: location.state ?? null,
            pin_code: location.postalCode || location.pincode || null,
            latitude: typeof location.latitude === 'number' ? location.latitude : null,
            longitude: typeof location.longitude === 'number' ? location.longitude : null,
            setup_status: 'COMPLETED',
            completed_at: new Date(),
          },
        });

        // Room types
        const roomTypeById = new Map<string, string>();
        for (const name of roomTypeNames) {
          const rt = await tx.roomType.create({
            data: { tenant_id: tenantId, name, status: 'active' },
          });
          roomTypeById.set(name.toLowerCase(), rt.room_type_id);
        }

        // Floors + rooms + seats
        const seatCreates: any[] = [];
        let totalSeats = 0;
        let acSeats = 0;
        let nonAcSeats = 0;

        for (const floor of rooms.floors ?? []) {
          const floorName = floor.name || floor.floorName || 'Floor';
          const floorRec = await tx.floor.create({
            data: {
              tenant_id: tenantId,
              library_id: library.library_id,
              name: floorName,
              status: 'active',
            },
          });

          for (const room of floor.rooms ?? []) {
            const roomName = room.name || room.roomNumber || 'Room';
            const typeName = (room.roomType || room.room_type || room.type || 'General') as string;
            const roomTypeId = roomTypeById.get(typeName.toLowerCase()) ?? null;
            const capacity =
              room.capacity ??
              room.totalSeats ??
              (typeof room.seatFrom === 'number' && typeof room.seatTo === 'number'
                ? room.seatTo - room.seatFrom + 1
                : 0);
            if (!capacity || capacity < 1) {
              throw new Error(`Room "${roomName}" has no valid capacity`);
            }

            const readingRoom = await tx.readingRoom.create({
              data: {
                tenant_id: tenantId,
                library_id: library.library_id,
                floor_id: floorRec.floor_id,
                room_type_id: roomTypeId,
                type: typeName,
                name: roomName,
                capacity,
                status: 'active',
              },
            });

            // Seat numbers: explicit range wins, else 1..capacity
            const from =
              typeof room.seatFrom === 'number' ? room.seatFrom : 1;
            const to =
              typeof room.seatTo === 'number' ? room.seatTo : from + capacity - 1;
            for (let n = from; n <= to; n++) {
              seatCreates.push({
                tenant_id: tenantId,
                room_id: readingRoom.room_id,
                seat_number: String(n),
                status: 'ACTIVE',
              });
            }
            totalSeats += to - from + 1;
            if (/ac/i.test(typeName) && !/non-?ac/i.test(typeName)) {
              acSeats += to - from + 1;
            } else {
              nonAcSeats += to - from + 1;
            }
          }
        }

        if (seatCreates.length > 0) {
          await tx.seat.createMany({ data: seatCreates, skipDuplicates: true });
        }

        // Time slots
        const openTime = timing.openTime || timing.openingTime;
        const closeTime = timing.closeTime || timing.closingTime;
        const slots: Array<{ name: string; start_time: string; end_time: string }> = [];
        if (Array.isArray(timing.slots) && timing.slots.length > 0) {
          for (const s of timing.slots) {
            slots.push({
              name: s.name || 'Slot',
              start_time: s.startTime || s.start_time,
              end_time: s.endTime || s.end_time,
            });
          }
        } else {
          slots.push({ name: 'Full Day', start_time: openTime, end_time: closeTime });
        }
        for (const s of slots) {
          await tx.timeSlot.create({
            data: {
              tenant_id: tenantId,
              library_id: library.library_id,
              name: s.name,
              start_time: s.start_time,
              end_time: s.end_time,
              status: 'active',
            },
          });
        }

        // Persist operation details (open/close, working days, holidays)
        const workingDays = timing.workingDays ?? timing.daysOpen ?? null;
        const holidays = Array.isArray(timing.holidays)
          ? timing.holidays.map((h: any, i: number) => ({
              id: h.id ?? `holiday_${i + 1}`,
              name: h.name,
              date: h.date,
            }))
          : null;
        const opPayload = {
          opening_time: openTime,
          closing_time: closeTime,
          working_days: (workingDays ?? Prisma.DbNull) as any,
          holidays: (holidays ?? Prisma.DbNull) as any,
        };
        await tx.libraryOperation.upsert({
          where: { library_id: library.library_id },
          create: {
            tenant_id: tenantId,
            library_id: library.library_id,
            ...opPayload,
          },
          update: opPayload,
        });

        // Fee plans (openapi shape: name/amount/cycle/depositAmount;
        // doc shape: roomType + fullDay/halfDay tiers)
        const feeCreates: any[] = [];
        for (const plan of fees.feePlans ?? []) {
          const roomTypeLabel = plan.roomType ? `${plan.roomType} ` : '';
          if (typeof plan.amount === 'number') {
            feeCreates.push({
              tenant_id: tenantId,
              library_id: library.library_id,
              name: plan.name || `${roomTypeLabel}Plan`.trim(),
              billing_period: plan.cycle || 'MONTHLY',
              amount: plan.amount,
              admission_fee: plan.depositAmount ?? 0,
              status: 'active',
            });
          } else if (plan.fullDay) {
            feeCreates.push({
              tenant_id: tenantId,
              library_id: library.library_id,
              name: plan.name || `${roomTypeLabel}Full Day`.trim(),
              billing_period: plan.cycle || 'MONTHLY',
              amount: plan.fullDay.monthlyFee ?? plan.fullDay.dailyFee ?? 0,
              admission_fee: plan.fullDay.deposit ?? plan.fullDay.advanceAmount ?? 0,
              status: 'active',
            });
            if (plan.halfDayEnabled && plan.halfDay) {
              feeCreates.push({
                tenant_id: tenantId,
                library_id: library.library_id,
                name: `${roomTypeLabel}Half Day`.trim(),
                billing_period: plan.cycle || 'MONTHLY',
                amount: plan.halfDay.monthlyFee ?? plan.halfDay.dailyFee ?? 0,
                admission_fee: plan.halfDay.deposit ?? plan.halfDay.advanceAmount ?? 0,
                status: 'active',
              });
            }
          }
        }
        if (feeCreates.length > 0) await tx.feePlan.createMany({ data: feeCreates });

        // Room type pricing (full_day/half_day structured) for display APIs
        for (const plan of fees.feePlans ?? []) {
          if (!plan.roomType || !plan.fullDay) continue;
          const rtId = roomTypeById.get(String(plan.roomType).toLowerCase());
          if (!rtId) continue;
          await tx.roomTypePricing.upsert({
            where: {
              library_id_room_type_id: {
                library_id: library.library_id,
                room_type_id: rtId,
              },
            },
            create: {
              tenant_id: tenantId,
              library_id: library.library_id,
              room_type_id: rtId,
              full_day_monthly_fee_per_seat: plan.fullDay.monthlyFee ?? plan.fullDay.dailyFee ?? 0,
              full_day_security_deposit: plan.fullDay.deposit ?? 0,
              full_day_deposit_type: plan.fullDay.depositType ?? 'REFUNDABLE',
              full_day_advance_amount: plan.fullDay.advanceAmount ?? 0,
              half_day_enabled: !!plan.halfDayEnabled,
              half_day_monthly_fee_per_seat: plan.halfDayEnabled
                ? plan.halfDay?.monthlyFee ?? plan.halfDay?.dailyFee ?? null
                : null,
              half_day_security_deposit: plan.halfDayEnabled ? plan.halfDay?.deposit ?? null : null,
              half_day_deposit_type: plan.halfDayEnabled ? plan.halfDay?.depositType ?? null : null,
              half_day_advance_amount: plan.halfDayEnabled
                ? plan.halfDay?.advanceAmount ?? null
                : null,
            },
            update: {
              full_day_monthly_fee_per_seat: plan.fullDay.monthlyFee ?? plan.fullDay.dailyFee ?? 0,
              full_day_security_deposit: plan.fullDay.deposit ?? 0,
              full_day_deposit_type: plan.fullDay.depositType ?? 'REFUNDABLE',
              full_day_advance_amount: plan.fullDay.advanceAmount ?? 0,
              half_day_enabled: !!plan.halfDayEnabled,
              half_day_monthly_fee_per_seat: plan.halfDayEnabled
                ? plan.halfDay?.monthlyFee ?? plan.halfDay?.dailyFee ?? null
                : null,
              half_day_security_deposit: plan.halfDayEnabled ? plan.halfDay?.deposit ?? null : null,
              half_day_deposit_type: plan.halfDayEnabled ? plan.halfDay?.depositType ?? null : null,
              half_day_advance_amount: plan.halfDayEnabled
                ? plan.halfDay?.advanceAmount ?? null
                : null,
            },
          });
        }

        const feePlanRows = await tx.feePlan.findMany({
          where: { library_id: library.library_id },
          select: { amount: true },
        });
        const amounts = feePlanRows.map((f) => f.amount).sort((a, b) => a - b);
        const monthlyFeeRange =
          amounts.length > 0
            ? `INR${amounts[0].toLocaleString('en-IN')}${
                amounts.length > 1 && amounts[amounts.length - 1] !== amounts[0]
                  ? ` - INR${amounts[amounts.length - 1].toLocaleString('en-IN')}`
                  : ''
              }`
            : null;

        return {
          library,
          totalSeats,
          acSeats,
          nonAcSeats,
          totalFloors: (rooms.floors ?? []).length,
          monthlyFeeRange,
          operatingHours: `${openTime} - ${closeTime}`,
        };
      },
      { timeout: 60_000, maxWait: 10_000 }
    );

    // Draft clear after success
    await redis.del(draftKey(tenantId));

    return ok(
      res,
      {
        readingRoom: {
          id: result.library.library_id,
          name: result.library.name,
          ownerName: basic.ownerName,
          phone: basic.phone,
          email: basic.email ?? null,
          address: result.library.address,
          totalSeats: result.totalSeats,
          acSeats: result.acSeats,
          nonAcSeats: result.nonAcSeats,
          totalFloors: result.totalFloors,
          monthlyFeeRange: result.monthlyFeeRange,
          operatingHours: result.operatingHours,
          status: 'active',
        },
        user: {
          id: req.user?.sub ?? null,
          isSetupComplete: true,
          role: 'OWNER',
        },
      },
      'Reading room setup finalized successfully! Welcome to SmartLibrary.',
      201
    );
  } catch (err: any) {
    if (err?.name === 'ZodError') return fail(res, 'Validation failed', 400, 'VALIDATION_ERROR');
    console.error('finalize error:', err);
    return fail(res, err?.message || 'Finalize failed', 500);
  }
};
