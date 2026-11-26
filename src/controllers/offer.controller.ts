import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import {
  createOfferSchema,
  updateOfferSchema,
  listActiveOffersQuerySchema,
  offerActionSchema,
} from '../validations/offer.validation';
import { ok, fail } from '../utils/response';

function toApiOffer(o: any) {
  return {
    offerId: o.offer_id,
    libraryId: o.library_id ?? null,
    tag: o.tag,
    title: o.title,
    description: o.description ?? null,
    discountLabel: o.discount_label ?? null,
    originalPrice: o.original_price,
    discountedPrice: o.discounted_price,
    discountPercentage: o.discount_percentage ?? null,
    currency: o.currency,
    billingCycle: o.billing_cycle ?? null,
    actionLabel: o.action_label ?? null,
    actionRoute: o.action_route ?? null,
    isVisible: o.is_visible,
    status: o.status,
    startDate: o.start_date ? o.start_date.toISOString().slice(0, 10) : null,
    endDate: o.end_date ? o.end_date.toISOString().slice(0, 10) : null,
    expiresAt: o.expires_at ? o.expires_at.toISOString() : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export const getActiveOffers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const q = listActiveOffersQuerySchema.parse(req.query);
    const now = new Date();

    const dateFilters: any[] = [
      { OR: [{ end_date: null }, { end_date: { gte: now } }] },
      { OR: [{ expires_at: null }, { expires_at: { gt: now } }] },
    ];
    if (q.libraryId) {
      dateFilters.push({ OR: [{ library_id: null }, { library_id: q.libraryId }] });
    }

    const offers = await prisma.offer.findMany({
      where: {
        status: 'active',
        is_visible: true,
        AND: dateFilters,
      },
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, offers.map(toApiOffer), 'Active offers fetched successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch active offers', 500);
  }
};

export const listOffers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const status = req.query.status as string | undefined;

    const offers = await prisma.offer.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
    });

    return ok(res, offers.map(toApiOffer), 'Offers fetched successfully');
  } catch (error) {
    return fail(res, 'Failed to fetch offers', 500);
  }
};

export const createOffer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user?.sub as string;
    const prisma = getTenantPrisma(tenantId);
    const data = createOfferSchema.parse(req.body);

    const offer = await prisma.offer.create({
      data: {
        tenant_id: tenantId,
        library_id: data.library_id ?? null,
        tag: data.tag ?? 'LIMITED TIME OFFER',
        title: data.title,
        description: data.description ?? null,
        discount_label: data.discount_label ?? null,
        original_price: data.original_price,
        discounted_price: data.discounted_price,
        discount_percentage: data.discount_percentage ?? null,
        currency: data.currency ?? 'INR',
        billing_cycle: data.billing_cycle ?? null,
        action_label: data.action_label ?? null,
        action_route: data.action_route ?? null,
        is_visible: data.is_visible ?? true,
        status: data.status ?? 'active',
        start_date: data.start_date ? new Date(`${data.start_date}T00:00:00`) : null,
        end_date: data.end_date ? new Date(`${data.end_date}T23:59:59.999`) : null,
        expires_at: data.expires_at ? new Date(data.expires_at) : null,
        created_by: actorId,
      },
    });

    return ok(res, toApiOffer(offer), 'Offer created successfully', 201);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to create offer', 500);
  }
};

export const updateOffer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const offerId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);
    const data = updateOfferSchema.parse(req.body);

    const existing = await prisma.offer.findUnique({ where: { offer_id: offerId } });
    if (!existing) return fail(res, 'Offer not found', 404, 'NOT_FOUND');

    const offer = await prisma.offer.update({
      where: { offer_id: offerId },
      data: {
        ...(data.library_id !== undefined ? { library_id: data.library_id } : {}),
        ...(data.tag !== undefined ? { tag: data.tag } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.discount_label !== undefined ? { discount_label: data.discount_label } : {}),
        ...(data.original_price !== undefined ? { original_price: data.original_price } : {}),
        ...(data.discounted_price !== undefined ? { discounted_price: data.discounted_price } : {}),
        ...(data.discount_percentage !== undefined
          ? { discount_percentage: data.discount_percentage }
          : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.billing_cycle !== undefined ? { billing_cycle: data.billing_cycle } : {}),
        ...(data.action_label !== undefined ? { action_label: data.action_label } : {}),
        ...(data.action_route !== undefined ? { action_route: data.action_route } : {}),
        ...(data.is_visible !== undefined ? { is_visible: data.is_visible } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.start_date !== undefined
          ? { start_date: data.start_date ? new Date(`${data.start_date}T00:00:00`) : null }
          : {}),
        ...(data.end_date !== undefined
          ? { end_date: data.end_date ? new Date(`${data.end_date}T23:59:59.999`) : null }
          : {}),
        ...(data.expires_at !== undefined
          ? { expires_at: data.expires_at ? new Date(data.expires_at) : null }
          : {}),
      },
    });

    return ok(res, toApiOffer(offer), 'Offer updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to update offer', 500);
  }
};

export const deleteOffer = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const offerId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const existing = await prisma.offer.findUnique({ where: { offer_id: offerId } });
    if (!existing) return fail(res, 'Offer not found', 404, 'NOT_FOUND');

    const offer = await prisma.offer.update({
      where: { offer_id: offerId },
      data: { status: 'deleted', is_visible: false },
    });

    return ok(res, toApiOffer(offer), 'Offer deleted successfully');
  } catch (error) {
    return fail(res, 'Failed to delete offer', 500);
  }
};

export const recordOfferAction = async (req: Request, res: Response) => {
  try {
    const offerId = req.params.id as string;
    const prisma = getTenantPrisma(req.tenantId!);
    offerActionSchema.parse(req.body);

    const existing = await prisma.offer.findUnique({ where: { offer_id: offerId } });
    if (!existing) return fail(res, 'Offer not found', 404, 'NOT_FOUND');

    // Interaction analytics table deferred - acknowledge only
    return ok(res, { offerId, status: 'recorded' }, 'Offer interaction recorded');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to record offer action', 500);
  }
};
