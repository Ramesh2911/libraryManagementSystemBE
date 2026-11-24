import { Request, Response } from 'express';
import { recordPayment } from '../controllers/payment.controller';
import { getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Payment Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;
  let txMock: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      tenantId: 'tenant-123',
    };
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };
    
    txMock = {
      feeSnapshot: { findUnique: jest.fn(), update: jest.fn() },
      payment: { create: jest.fn() },
      overdueTracking: { findMany: jest.fn(), update: jest.fn() }
    };

    mockPrismaTenant = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(txMock);
      })
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('recordPayment', () => {
    it('should record payment and update snapshot atomically', async () => {
      mockRequest.body = {
        student_id: '550e8400-e29b-41d4-a716-446655440000',
        admission_id: 'adm-1',
        amount: 500,
        method: 'cash',
        allocations: [
          { obligation_id: '123e4567-e89b-12d3-a456-426614174000', amount: 500 }
        ]
      };

      txMock.feeObligation = { findUnique: jest.fn(), update: jest.fn() };
      txMock.paymentAllocation = { create: jest.fn() };

      txMock.feeObligation.findUnique.mockResolvedValue({
        obligation_id: '123e4567-e89b-12d3-a456-426614174000',
        student_id: '550e8400-e29b-41d4-a716-446655440000',
        amount_due: 1000,
        amount_paid: 0
      });

      txMock.feeObligation.update.mockResolvedValue({ amount_paid: 500 });
      txMock.payment.create.mockResolvedValue({ payment_id: 'pay-1' });

      await recordPayment(mockRequest as Request, mockResponse as Response);

      expect(txMock.feeObligation.update).toHaveBeenCalledWith({
        where: { obligation_id: '123e4567-e89b-12d3-a456-426614174000' },
        data: { amount_paid: 500, status: 'PARTIALLY_PAID' }
      });
      expect(txMock.payment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          amount: 500,
          method: 'cash',
          status: 'completed'
        })
      }));
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Payment recorded successfully' }));
    });

    it('should throw if payment exceeds due amount', async () => {
      mockRequest.body = {
        student_id: '550e8400-e29b-41d4-a716-446655440000',
        admission_id: 'adm-1',
        amount: 1500,
        method: 'cash',
        allocations: [
          { obligation_id: '123e4567-e89b-12d3-a456-426614174000', amount: 1500 }
        ]
      };

      txMock.feeObligation = { findUnique: jest.fn(), update: jest.fn() };
      txMock.feeObligation.findUnique.mockResolvedValue({
        obligation_id: '123e4567-e89b-12d3-a456-426614174000',
        student_id: '550e8400-e29b-41d4-a716-446655440000',
        amount_due: 1000,
        amount_paid: 0
      });

      await recordPayment(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Payment amount exceeds due amount' });
    });
  });
});
