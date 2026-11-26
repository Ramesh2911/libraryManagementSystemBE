import { getTenantPrisma } from '../config/prisma';

export type NotificationCategory =
  | 'SYSTEM'
  | 'PAYMENT_SUCCESS'
  | 'FEE_REMINDER'
  | 'ADMISSION'
  | 'OVERDUE'
  | 'PROMO';

export interface CreateInAppNotificationInput {
  tenantId: string;
  recipientRef: string;
  recipientRole?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  priority?: 'normal' | 'urgent';
  referenceType?: string;
  referenceId?: string;
}

/**
 * Fire-and-forget in-app notification create.
 * Failures are logged, never thrown (should not break primary business flow).
 */
export async function createInAppNotification(input: CreateInAppNotificationInput): Promise<void> {
  try {
    const prisma = getTenantPrisma(input.tenantId);
    await prisma.notification.create({
      data: {
        tenant_id: input.tenantId,
        recipient_ref: input.recipientRef,
        recipient_role: input.recipientRole ?? 'OWNER',
        category: input.category,
        title: input.title,
        message: input.message,
        priority: input.priority ?? 'normal',
        reference_type: input.referenceType ?? null,
        reference_id: input.referenceId ?? null,
      },
    });
  } catch (err) {
    console.error('[notification] failed to create in-app notification:', err);
  }
}
