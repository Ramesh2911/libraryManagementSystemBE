import cron from 'node-cron';
import { prisma } from '../config/prisma';

export const startCronJobs = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Running daily subscription & overdue checks...');
    try {
      await processOverdues();
    } catch (err) {
      console.error('[CRON] Error running daily checks:', err);
    }
  });
};

export const processOverdues = async () => {
  const today = new Date();
  
  // Find all fee obligations that have due amounts and where due_date has passed
  const unpaidObligations = await prisma.feeObligation.findMany({
    where: {
      status: { not: 'PAID' },
      due_date: { lt: today }
    }
  });

  let processedCount = 0;

  for (const obligation of unpaidObligations) {
    if (obligation.amount_paid >= obligation.amount_due) continue;

    // Check if OverdueTracking already exists for this obligation
    // Note: Schema has fee_snapshot_id which we are using to store obligation_id mapping for now
    const existingOverdue = await prisma.overdueTracking.findFirst({
      where: { fee_snapshot_id: obligation.obligation_id }
    });

    const overdueDays = Math.floor((today.getTime() - new Date(obligation.due_date).getTime()) / (1000 * 3600 * 24));

    if (!existingOverdue) {
      // Create new overdue tracker
      await prisma.overdueTracking.create({
        data: {
          tenant_id: obligation.tenant_id,
          student_id: obligation.student_id,
          fee_snapshot_id: obligation.obligation_id,
          overdue_days: overdueDays,
          recovery_status: 'pending'
        }
      });
    } else {
      // Update existing overdue days
      await prisma.overdueTracking.update({
        where: { overdue_id: existingOverdue.overdue_id },
        data: {
          overdue_days: overdueDays
        }
      });
    }
    processedCount++;
  }

  console.log(`[CRON] Processed ${processedCount} overdue records.`);
};

startCronJobs();
