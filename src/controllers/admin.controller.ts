import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const getPlatformMetrics = async (req: Request, res: Response) => {
  try {
    const totalTenants = await prisma.owner.count();
    const totalStudents = await prisma.student.count();
    const activeSubscriptions = await prisma.subscription.count({
      where: { status: 'active' }
    });

    res.json({
      metrics: {
        totalTenants,
        totalStudents,
        activeSubscriptions
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch platform metrics' });
  }
};

export const getSubscriptions = async (req: Request, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        owner: {
          select: { name: true, contact: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

export const getOwners = async (req: Request, res: Response) => {
  try {
    const owners = await prisma.owner.findMany({
      select: {
        tenant_id: true,
        name: true,
        contact: true,
        subscriptionPlanId: true,
        twoFaEnabled: true,
        createdAt: true,
        _count: {
          select: { libraries: true, students: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
};

export const getRevenueAnalytics = async (req: Request, res: Response) => {
  try {
    // Global platform revenue aggregation (e.g., from subscription billing, if tracked in a separate table)
    // For now, we aggregate the tenant payments just to show platform-wide activity.
    const totalPayments = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'completed' }
    });

    res.json({
      globalTenantRevenueProcessed: totalPayments._sum.amount || 0,
      currency: 'INR'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
};
