import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { getTenantPrisma } from '../config/prisma';
import {
  createLibrarySchema,
  updateLibrarySchema,
  updateLibrarySetupSchema,
  operationPutSchema,
  roomTypePricingPutSchema,
} from '../validations/librarySetup.validation';
import { ok, fail } from '../utils/response';

function toLibraryDto(lib: any) {
  return {
    id: lib.library_id,
    library_id: lib.library_id,
    name: lib.name,
    branch_name: lib.branch_name ?? null,
    owner_name: lib.owner_name ?? null,
    mobile: lib.mobile ?? lib.contact ?? null,
    email: lib.email ?? null,
    contact: lib.contact ?? null,
    address: lib.address ?? null,
    area: lib.area ?? null,
    unit: lib.unit ?? null,
    city: lib.city ?? null,
    state: lib.state ?? null,
    pin_code: lib.pin_code ?? null,
    latitude: lib.latitude ?? null,
    longitude: lib.longitude ?? null,
    logo_url: lib.logo_url ?? null,
    setup_status: lib.setup_status ?? 'DRAFT',
    completed_at: lib.completed_at ?? null,
    status: lib.status,
    createdAt: lib.createdAt,
    updatedAt: lib.updatedAt,
  };
}

function normalizeLocation(data: any) {
  const out: any = { ...data };
  if (out.pincode && !out.pin_code) {
    out.pin_code = out.pincode;
  }
  delete out.pincode;
  // map camelCase aliases if provided
  if (out.branchName && !out.branch_name) out.branch_name = out.branchName;
  if (out.ownerName && !out.owner_name) out.owner_name = out.ownerName;
  delete out.branchName;
  delete out.ownerName;
  return out;
}

export const getLibraryById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    return ok(res, toLibraryDto(lib), 'Library fetched successfully');
  } catch (error) {
    return fail(res, 'Failed to fetch library', 500);
  }
};

export const createLibraryExtended = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const raw = createLibrarySchema.parse(req.body);
    const data = normalizeLocation(raw);

    const newLibrary = await prisma.library.create({
      data: {
        tenant_id: tenantId,
        name: data.name,
        address: data.address ?? null,
        contact: data.contact ?? data.mobile ?? null,
        logo_url: data.logo_url ?? null,
        branch_name: data.branch_name ?? null,
        owner_name: data.owner_name ?? null,
        mobile: data.mobile ?? data.contact ?? null,
        email: data.email ?? null,
        area: data.area ?? null,
        unit: data.unit ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        pin_code: data.pin_code ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        setup_status: 'IN_PROGRESS',
      },
    });

    return ok(res, toLibraryDto(newLibrary), 'Library created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to create library', 500);
  }
};

// Keep legacy PATCH (raw) but accept extended fields
export const updateLibrary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const raw = updateLibrarySchema.parse(req.body);
    const data = normalizeLocation(raw);

    const payload: any = {};
    const map: Array<[string, string]> = [
      ['name', 'name'],
      ['address', 'address'],
      ['contact', 'contact'],
      ['logo_url', 'logo_url'],
      ['branch_name', 'branch_name'],
      ['owner_name', 'owner_name'],
      ['mobile', 'mobile'],
      ['email', 'email'],
      ['area', 'area'],
      ['unit', 'unit'],
      ['city', 'city'],
      ['state', 'state'],
      ['pin_code', 'pin_code'],
      ['latitude', 'latitude'],
      ['longitude', 'longitude'],
    ];
    for (const [src, dst] of map) {
      if (data[src] !== undefined) payload[dst] = data[src];
    }

    const updatedLibrary = await prisma.library.update({
      where: { library_id: libraryId },
      data: payload,
    });

    res.json(updatedLibrary);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Library not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update library' });
  }
};

export const deleteLibrary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const deletedLibrary = await prisma.library.update({
      where: { library_id: libraryId },
      data: { status: 'deleted' },
    });

    res.json({ message: 'Library deleted successfully', library: deletedLibrary });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Library not found' });
    }
    res.status(500).json({ error: 'Failed to delete library' });
  }
};

// ---- Operation ----
function normalizeOperation(data: any) {
  const opening = data.opening_time ?? data.openingTime ?? data.openTime ?? null;
  const closing = data.closing_time ?? data.closingTime ?? data.closeTime ?? null;
  let workingDays = data.working_days ?? data.daysOpen ?? null;
  if (workingDays && !Array.isArray(workingDays)) workingDays = null;
  const holidays = data.holidays ?? null;
  const holidaysJson =
    holidays && Array.isArray(holidays)
      ? holidays.map((h: any, i: number) => ({
          id: h.id ?? `holiday_${i + 1}`,
          name: h.name,
          date: h.date,
        }))
      : Prisma.DbNull;
  return {
    opening_time: opening,
    closing_time: closing,
    working_days: (workingDays ?? Prisma.DbNull) as Prisma.InputJsonValue,
    holidays: holidaysJson as Prisma.InputJsonValue,
  };
}

export const getOperation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      select: { library_id: true },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    const op = await prisma.libraryOperation.findUnique({
      where: { library_id: libraryId },
    });

    const slots = await prisma.timeSlot.findMany({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      orderBy: { start_time: 'asc' },
    });

    return ok(
      res,
      {
        library_id: libraryId,
        opening_time: op?.opening_time ?? null,
        closing_time: op?.closing_time ?? null,
        working_days: op?.working_days ?? null,
        time_slots: slots.map((s) => ({
          id: s.slot_id,
          name: s.name,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
        holidays: op?.holidays ?? [],
      },
      'Operation details fetched successfully'
    );
  } catch (error) {
    return fail(res, 'Failed to fetch operation details', 500);
  }
};

export const putOperation = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);
    const parsed = operationPutSchema.parse(req.body);
    const norm = normalizeOperation(parsed);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      select: { library_id: true },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    const op = await prisma.libraryOperation.upsert({
      where: { library_id: libraryId },
      create: {
        tenant_id: tenantId,
        library_id: libraryId,
        ...norm,
      },
      update: norm,
    });

    const slots = await prisma.timeSlot.findMany({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      orderBy: { start_time: 'asc' },
    });

    return ok(
      res,
      {
        library_id: libraryId,
        opening_time: op.opening_time,
        closing_time: op.closing_time,
        working_days: op.working_days,
        time_slots: slots.map((s) => ({
          id: s.slot_id,
          name: s.name,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
        holidays: op.holidays ?? [],
      },
      'Operation details saved successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to save operation details', 500);
  }
};

// ---- Room type pricing ----
function toPricingDto(p: any) {
  return {
    id: p.pricing_id,
    library_id: p.library_id,
    room_type_id: p.room_type_id,
    room_type_name: p.roomType?.name ?? null,
    full_day: {
      monthly_fee_per_seat: p.full_day_monthly_fee_per_seat,
      security_deposit: p.full_day_security_deposit,
      deposit_type: p.full_day_deposit_type,
      advance_amount: p.full_day_advance_amount,
    },
    half_day: p.half_day_enabled
      ? {
          enabled: true,
          monthly_fee_per_seat: p.half_day_monthly_fee_per_seat ?? 0,
          security_deposit: p.half_day_security_deposit ?? 0,
          deposit_type: p.half_day_deposit_type ?? 'REFUNDABLE',
          advance_amount: p.half_day_advance_amount ?? 0,
        }
      : { enabled: false },
  };
}

export const getPricing = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      select: { library_id: true },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    const rows = await prisma.roomTypePricing.findMany({
      where: { library_id: libraryId },
      include: { roomType: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return ok(res, rows.map(toPricingDto), 'Room type pricing fetched successfully');
  } catch (error) {
    console.error('getPricing error:', error);
    return fail(res, 'Failed to fetch room type pricing', 500);
  }
};

export const putPricing = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);
    const items = roomTypePricingPutSchema.parse(req.body);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      select: { library_id: true },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    // Every room_type_id must exist in room_types (FK) — reject early with 400 instead of 500
    const keepIds = [...new Set(items.map((i) => i.room_type_id))];
    const existing = await prisma.roomType.findMany({
      where: { room_type_id: { in: keepIds } },
      select: { room_type_id: true },
    });
    const existingIds = new Set(existing.map((r) => r.room_type_id));
    const missing = keepIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      return fail(
        res,
        `Unknown room_type_id: ${missing.join(', ')}. Create the room types first via POST /api/v1/room-types.`,
        400,
        'UNKNOWN_ROOM_TYPE'
      );
    }

    // replace-all upsert in one transaction
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

      await tx.roomTypePricing.deleteMany({
        where: { library_id: libraryId, room_type_id: { notIn: keepIds } },
      });

      for (const item of items) {
        const half = item.half_day;
        const data = {
          full_day_monthly_fee_per_seat: item.full_day.monthly_fee_per_seat,
          full_day_security_deposit: item.full_day.security_deposit ?? 0,
          full_day_deposit_type: item.full_day.deposit_type ?? 'REFUNDABLE',
          full_day_advance_amount: item.full_day.advance_amount ?? 0,
          half_day_enabled: !!half?.enabled,
          half_day_monthly_fee_per_seat: half?.enabled ? half.monthly_fee_per_seat ?? null : null,
          half_day_security_deposit: half?.enabled ? half.security_deposit ?? null : null,
          half_day_deposit_type: half?.enabled ? half.deposit_type ?? null : null,
          half_day_advance_amount: half?.enabled ? half.advance_amount ?? null : null,
        };
        await tx.roomTypePricing.upsert({
          where: {
            library_id_room_type_id: {
              library_id: libraryId,
              room_type_id: item.room_type_id,
            },
          },
          create: {
            tenant_id: tenantId,
            library_id: libraryId,
            room_type_id: item.room_type_id,
            ...data,
          },
          update: data,
        });
      }
    });

    const rows = await prisma.roomTypePricing.findMany({
      where: { library_id: libraryId },
      include: { roomType: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return ok(res, rows.map(toPricingDto), 'Room type pricing saved successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    console.error('putPricing error:', error);
    if (error.code === 'P2003') {
      return fail(res, 'Foreign key constraint failed (unknown room_type_id, library_id, or tenant_id)', 400, 'FK_VIOLATION');
    }
    if (error.code === 'P2028') {
      return fail(res, 'Transaction timed out - please retry', 500, 'TX_TIMEOUT');
    }
    return fail(res, 'Failed to save room type pricing', 500);
  }
};

// ---- Setup aggregate ----
export const getSetupSummary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    const op = await prisma.libraryOperation.findUnique({
      where: { library_id: libraryId },
    });
    const slots = await prisma.timeSlot.findMany({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      orderBy: { start_time: 'asc' },
    });
    const floors = await prisma.floor.findMany({
      where: { library_id: libraryId, status: { not: 'deleted' } },
      orderBy: { createdAt: 'asc' },
      include: {
        readingRooms: {
          where: { status: 'active' },
          include: { roomType: { select: { room_type_id: true, name: true } } },
        },
      },
    });
    const pricing = await prisma.roomTypePricing.findMany({
      where: { library_id: libraryId },
      include: { roomType: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return ok(
      res,
      {
        basic_details: {
          library_id: lib.library_id,
          name: lib.name,
          branch_name: lib.branch_name ?? null,
          owner_name: lib.owner_name ?? null,
          mobile: lib.mobile ?? lib.contact ?? null,
          email: lib.email ?? null,
          setup_status: lib.setup_status,
          completed_at: lib.completed_at,
        },
        location: {
          address: lib.address ?? null,
          area: lib.area ?? null,
          unit: lib.unit ?? null,
          city: lib.city ?? null,
          state: lib.state ?? null,
          pin_code: lib.pin_code ?? null,
          latitude: lib.latitude ?? null,
          longitude: lib.longitude ?? null,
        },
        operation: {
          opening_time: op?.opening_time ?? null,
          closing_time: op?.closing_time ?? null,
          working_days: op?.working_days ?? null,
          time_slots: slots.map((s) => ({
            id: s.slot_id,
            name: s.name,
            start_time: s.start_time,
            end_time: s.end_time,
          })),
          holidays: op?.holidays ?? [],
        },
        floors: floors.map((f) => ({
          id: f.floor_id,
          name: f.name,
          rooms: f.readingRooms.map((r) => ({
            id: r.room_id,
            room_number: r.name ?? '',
            room_type_id: r.room_type_id,
            room_type_name: r.roomType?.name ?? null,
            total_seats: r.capacity,
          })),
        })),
        room_type_pricing: pricing.map(toPricingDto),
      },
      'Setup summary fetched successfully'
    );
  } catch (error) {
    return fail(res, 'Failed to fetch setup summary', 500);
  }
};

// ---- Setup complete (idempotent) ----
export const postSetupComplete = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const lib = await prisma.library.findFirst({
      where: { library_id: libraryId, status: { not: 'deleted' } },
    });
    if (!lib) return fail(res, 'Library not found', 404, 'NOT_FOUND');

    if (lib.setup_status === 'COMPLETED' && lib.completed_at) {
      return ok(
        res,
        {
          library_id: libraryId,
          setup_status: 'COMPLETED',
          completed_at: lib.completed_at.toISOString(),
        },
        'Library setup already completed'
      );
    }

    const updated = await prisma.library.update({
      where: { library_id: libraryId },
      data: { setup_status: 'COMPLETED', completed_at: new Date() },
    });

    return ok(
      res,
      {
        library_id: libraryId,
        setup_status: updated.setup_status,
        completed_at: updated.completed_at?.toISOString() ?? null,
      },
      'Library setup completed successfully'
    );
  } catch (error) {
    return fail(res, 'Failed to complete setup', 500);
  }
};
