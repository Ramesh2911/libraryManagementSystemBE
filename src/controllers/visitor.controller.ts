import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import {
  createVisitorSchema,
  updateVisitorStatusSchema,
  listVisitorsQuerySchema,
} from '../validations/visitor.validation';
import { ok, fail } from '../utils/response';

// API status (lowercase) <-> DB status (UPPERCASE)
const TO_DB_STATUS: Record<string, string> = {
  checked_in: 'CHECKED_IN',
  checked_out: 'CHECKED_OUT',
};
const TO_API_STATUS: Record<string, string> = {
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  SCHEDULED: 'checked_in', // create default maps to checked_in
  CANCELLED: 'checked_out',
};

function toApiVisitor(v: any) {
  return {
    id: v.visitor_id,
    full_name: v.name,
    phone_number: v.phone,
    whatsapp_number: v.whatsapp_number ?? '',
    email: v.email ?? '',
    purpose: v.purpose ?? '',
    company: v.company ?? '',
    persons: v.number_of_people,
    visit_date_time: v.scheduled_at ? v.scheduled_at.toISOString() : null,
    notes: v.notes ?? null,
    status: TO_API_STATUS[v.status] ?? v.status.toLowerCase(),
  };
}

export const getVisitors = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);

    const q = listVisitorsQuerySchema.parse(req.query);

    // Sequential (not Promise.all) - each op opens its own tx; parallel txs exhaust Render free pool
    const total_count = await prisma.visitor.count();
    const checked_in_count = await prisma.visitor.count({ where: { status: 'CHECKED_IN' } });
    const checked_out_count = await prisma.visitor.count({ where: { status: 'CHECKED_OUT' } });

    // Filters apply only to the visitors array (summary stays unfiltered - openapi contract)
    const where: any = {};
    if (q.libraryId) where.library_id = q.libraryId;
    if (q.status) where.status = TO_DB_STATUS[q.status];
    if (q.search) {
      const s = q.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { company: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (q.from_date || q.to_date) {
      where.scheduled_at = {};
      if (q.from_date) where.scheduled_at.gte = new Date(`${q.from_date}T00:00:00`);
      if (q.to_date) where.scheduled_at.lte = new Date(`${q.to_date}T23:59:59.999`);
    }

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { scheduled_at: 'desc' },
    });

    return ok(res, {
      summary: { total_count, checked_in_count, checked_out_count },
      visitors: visitors.map(toApiVisitor),
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch visitors', 500);
  }
};

export const createVisitor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user?.sub as string;
    const prisma = getTenantPrisma(tenantId);
    const data = createVisitorSchema.parse(req.body);

    // library_id not in doc form - use tenant's first library
    const library = await prisma.library.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { createdAt: 'asc' },
    });
    if (!library) return fail(res, 'No library configured for this tenant', 400, 'NO_LIBRARY');

    const visitor = await prisma.visitor.create({
      data: {
        tenant_id: tenantId,
        library_id: library.library_id,
        name: data.full_name,
        phone: data.phone_number,
        whatsapp_number: data.whatsapp_number,
        email: data.email,
        company: data.company,
        purpose: data.purpose,
        number_of_people: data.persons,
        scheduled_at: new Date(data.visit_date_time),
        notes: data.notes ?? null,
        status: 'CHECKED_IN', // doc default: checked_in
        checked_in_at: new Date(),
        created_by: actorId,
      },
    });

    return ok(res, toApiVisitor(visitor), 'Visitor saved successfully.', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to log visitor', 500);
  }
};

export const updateVisitorStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const visitorId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);
    const { status } = updateVisitorStatusSchema.parse(req.body);

    const existing = await prisma.visitor.findUnique({ where: { visitor_id: visitorId } });
    if (!existing) return fail(res, 'Visitor not found', 404, 'NOT_FOUND');

    const dataToUpdate: any = { status: TO_DB_STATUS[status] };
    if (status === 'checked_in') dataToUpdate.checked_in_at = new Date();
    if (status === 'checked_out') dataToUpdate.checked_out_at = new Date();

    const visitor = await prisma.visitor.update({
      where: { visitor_id: visitorId },
      data: dataToUpdate,
    });

    return ok(res, { id: visitor.visitor_id, status }, 'Visitor status updated successfully.');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, error.message || 'Failed to update visitor status', 400);
  }
};
