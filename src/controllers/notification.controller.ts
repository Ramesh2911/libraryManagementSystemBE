import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import {
  listNotificationsQuerySchema,
  markReadSchema,
} from '../validations/notification.validation';
import { ok, fail } from '../utils/response';

function toApiNotification(n: any) {
  return {
    id: n.notification_id,
    title: n.title,
    message: n.message,
    type: n.category.toLowerCase(),
    category: n.category,
    priority: n.priority,
    isRead: n.isRead,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    referenceType: n.reference_type ?? null,
    referenceId: n.reference_id ?? null,
    createdAt: n.createdAt,
  };
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const q = listNotificationsQuerySchema.parse(req.query);

    const where: any = {};
    if (q.unread) where.isRead = false;
    if (q.category) where.category = q.category;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
    });

    return ok(
      res,
      { unreadCount, notifications: notifications.map(toApiNotification) },
      'Notifications fetched successfully'
    );
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to fetch notifications', 500);
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
    });
    const hasUrgentAlerts = await prisma.notification.findFirst({
      where: { isRead: false, priority: 'urgent' },
      select: { notification_id: true },
    });
    const latestAlerts = await prisma.notification.findMany({
      where: { isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        notification_id: true,
        title: true,
        message: true,
        category: true,
        priority: true,
        createdAt: true,
      },
    });

    return ok(
      res,
      {
        unreadCount,
        hasUrgentAlerts: !!hasUrgentAlerts,
        latestAlerts: latestAlerts.map((n) => ({
          id: n.notification_id,
          title: n.title,
          message: n.message,
          category: n.category,
          priority: n.priority,
          createdAt: n.createdAt,
        })),
      },
      'Unread count fetched successfully'
    );
  } catch (error) {
    return fail(res, 'Failed to fetch unread count', 500);
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const notificationId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const existing = await prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });
    if (!existing) return fail(res, 'Notification not found', 404, 'NOT_FOUND');

    const notification = await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return ok(res, toApiNotification(notification), 'Notification marked as read');
  } catch (error) {
    return fail(res, 'Failed to mark notification read', 500);
  }
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const { markAll } = markReadSchema.parse(req.body ?? {});

    if (markAll) {
      const result = await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return ok(res, { updated: result.count }, 'Notifications updated successfully');
    }

    // markAll false + no ids = no-op unless ids provided
    const ids = (req.body?.ids as string[] | undefined) ?? [];
    if (ids.length === 0) {
      return fail(res, 'Provide markAll:true or ids[]', 400, 'VALIDATION_FAILED');
    }
    const result = await prisma.notification.updateMany({
      where: { notification_id: { in: ids }, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return ok(res, { updated: result.count }, 'Notifications updated successfully');
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return fail(res, 'Validation failed', 400, 'VALIDATION_FAILED');
    }
    return fail(res, 'Failed to update notifications', 500);
  }
};
