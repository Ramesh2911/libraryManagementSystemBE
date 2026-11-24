import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createDeposit, refundDeposit } from '../controllers/deposit.controller';

jest.mock('../config/prisma');

describe('Deposit Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;
  let txMock: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = { tenantId: 'tenant-1', user: { sub: 'admin-1' } };
    mockResponse = { json: jsonMock, status: statusMock };
    txMock = {
      deposit: { findUnique: jest.fn(), update: jest.fn() },
      refund: { create: jest.fn() },
      transaction: { create: jest.fn() }
    };
    mockPrismaTenant = {
      deposit: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation(cb => cb(txMock))
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createDeposit', () => {
    it('should create deposit', async () => {
      mockRequest.body = { student_id: '96b16520-22c6-43d9-ab70-cc3f443b749f', library_id: '1c0eb22c-a25e-4bb5-a309-8d4e76a16d8a', amount: 500 };
      mockPrismaTenant.deposit.create.mockResolvedValue({ deposit_id: 'd-1', amount: 500 });
      await createDeposit(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('refundDeposit', () => {
    it('should process refund', async () => {
      mockRequest.params = { id: 'd-1' };
      mockRequest.body = { amount: 200, reason: 'Leaving' };
      txMock.deposit.findUnique.mockResolvedValue({ deposit_id: 'd-1', student_id: 's-1', amount: 500, refunded_amount: 0 });
      txMock.deposit.update.mockResolvedValue({ deposit_id: 'd-1' });
      txMock.refund.create.mockResolvedValue({ refund_id: 'r-1' });
      await refundDeposit(mockRequest as Request, mockResponse as Response);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Refund processed successfully' }));
    });
  });
});
