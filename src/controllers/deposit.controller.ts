import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createDepositSchema, refundDepositSchema } from '../validations/deposit.validation';

export const createDeposit = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = createDepositSchema.parse(req.body);

    const deposit = await prismaTenant.deposit.create({
      data: {
        tenant_id: tenantId,
        ...data,
        created_by: actorId
      }
    });

    res.status(201).json({ message: 'Deposit created successfully', deposit });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create deposit' });
  }
};

export const refundDeposit = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const depositId = req.params.id as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = refundDepositSchema.parse(req.body);

    const result = await prismaTenant.$transaction(async (tx) => {
      const deposit = await tx.deposit.findUnique({ where: { deposit_id: depositId } });
      if (!deposit || deposit.status === 'REFUNDED') {
        throw new Error('Deposit not found or already fully refunded');
      }

      const availableToRefund = deposit.amount - deposit.refunded_amount;
      if (data.amount > availableToRefund) {
        throw new Error(`Refund amount exceeds available deposit balance (${availableToRefund})`);
      }

      const newRefundedAmount = deposit.refunded_amount + data.amount;
      const newStatus = newRefundedAmount >= deposit.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const updatedDeposit = await tx.deposit.update({
        where: { deposit_id: depositId },
        data: { refunded_amount: newRefundedAmount, status: newStatus }
      });

      const refund = await tx.refund.create({
        data: {
          tenant_id: tenantId,
          deposit_id: depositId,
          student_id: deposit.student_id,
          amount: data.amount,
          reason: data.reason,
          created_by: actorId
        }
      });

      // Log transaction
      await tx.transaction.create({
        data: {
          tenant_id: tenantId,
          library_id: deposit.library_id,
          type: 'REFUND',
          category: 'DEPOSIT_REFUND',
          amount: data.amount,
          reference_id: refund.refund_id,
          description: `Refund for deposit ${depositId}`
        }
      });

      return { deposit: updatedDeposit, refund };
    });

    res.json({ message: 'Refund processed successfully', data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to process refund' });
  }
};
