import { getTenantPrisma } from '../config/prisma';

export class NotificationService {
  /**
   * Dispatches a notification via the requested channel and logs it
   */
  static async dispatch(
    tenantId: string, 
    channel: 'SMS' | 'WHATSAPP' | 'PUSH' | 'EMAIL', 
    triggerEvent: string, 
    recipientRef: string, 
    payload: any
  ) {
    try {
      const prismaTenant = getTenantPrisma(tenantId);
      
      // 1. Dispatch logic based on channel (e.g. call WhatsApp API, Firebase, etc.)
      console.log(`[Notification Engine] Sending ${channel} to ${recipientRef} for ${triggerEvent}`);
      
      // ... actual provider integration goes here ...

      // 2. Log to notification_logs
      await prismaTenant.notificationLog.create({
        data: {
          tenant_id: tenantId,
          channel,
          trigger_event: triggerEvent,
          recipient_ref: recipientRef,
          delivery_status: 'sent'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to dispatch notification:', error);
      return false;
    }
  }
}
