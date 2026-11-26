import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { recordPaymentSchema } from '../validations/payment.validation';
import { createInAppNotification } from '../services/inAppNotification.service';

export const recordPayment = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = recordPaymentSchema.parse(req.body);

    const totalAllocated = data.allocations.reduce((acc, curr) => acc + curr.amount, 0);
    if (Math.abs(totalAllocated - data.amount) > 0.01) {
      return res.status(400).json({ error: 'Sum of allocations must equal total payment amount' });
    }

    const result = await prismaTenant.$transaction(async (tx) => {
      // Create Payment
      const payment = await tx.payment.create({
        data: {
          tenant_id: tenantId,
          student_id: data.student_id,
          admission_id: data.admission_id,
          amount: data.amount,
          method: data.method,
          provider: data.provider,
          provider_payment_id: data.provider_payment_id,
          receipt_url: data.receipt_url,
          status: 'SUCCESS', // Assuming this is recorded after successful receipt
          created_by: actorId
        }
      });

      for (const allocation of data.allocations) {
        if (!allocation.obligation_id && !allocation.deposit_id) {
          throw new Error('Allocation must have either obligation_id or deposit_id');
        }

        if (allocation.obligation_id) {
          const obligation = await tx.feeObligation.findUnique({
            where: { obligation_id: allocation.obligation_id }
          });
          if (!obligation || obligation.student_id !== data.student_id) {
            throw new Error(`Invalid obligation ID: ${allocation.obligation_id}`);
          }
          
          const newAmountPaid = obligation.amount_paid + allocation.amount;
          const newStatus = newAmountPaid >= obligation.amount_due ? 'PAID' : 'PARTIALLY_PAID';

          await tx.feeObligation.update({
            where: { obligation_id: allocation.obligation_id },
            data: { amount_paid: newAmountPaid, status: newStatus }
          });
        }

        if (allocation.deposit_id) {
          const deposit = await tx.deposit.findUnique({
            where: { deposit_id: allocation.deposit_id }
          });
          if (!deposit || deposit.student_id !== data.student_id) {
            throw new Error(`Invalid deposit ID: ${allocation.deposit_id}`);
          }
        }

        await tx.paymentAllocation.create({
          data: {
            tenant_id: tenantId,
            payment_id: payment.payment_id,
            obligation_id: allocation.obligation_id || null,
            deposit_id: allocation.deposit_id || null,
            amount: allocation.amount
          }
        });
      }

      return payment;
    });

    // In-app notification (outside tx, fire-and-forget)
    await createInAppNotification({
      tenantId,
      recipientRef: tenantId,
      category: 'PAYMENT_SUCCESS',
      title: 'Fee Payment Received',
      message: `Payment of ${result.amount} ${result.currency} recorded successfully.`,
      referenceType: 'payment',
      referenceId: result.payment_id,
    });

    res.status(201).json({ message: 'Payment recorded successfully', data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to record payment' });
  }
};

export const getStudentLedger = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const studentId = req.params.studentId as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const obligations = await prismaTenant.feeObligation.findMany({
      where: { student_id: studentId },
      orderBy: { due_date: 'desc' }
    });

    const payments = await prismaTenant.payment.findMany({
      where: { student_id: studentId },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' }
    });

    const deposits = await prismaTenant.deposit.findMany({
      where: { student_id: studentId },
      orderBy: { collected_at: 'desc' }
    });

    res.json({ obligations, payments, deposits });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student ledger' });
  }
};
