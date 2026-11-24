import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createLocker, assignLocker } from '../controllers/locker.controller';

jest.mock('../config/prisma');

describe('Locker Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;
  let txMock: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = { tenantId: 'tenant-1' };
    mockResponse = { json: jsonMock, status: statusMock };
    txMock = {
      locker: { findUnique: jest.fn(), update: jest.fn() },
      lockerAssignment: { create: jest.fn() }
    };
    mockPrismaTenant = {
      locker: { create: jest.fn() },
      $transaction: jest.fn().mockImplementation(cb => cb(txMock))
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createLocker', () => {
    it('should create a locker', async () => {
      mockRequest.body = { library_id: '96b16520-22c6-43d9-ab70-cc3f443b749f', locker_number: 'A1' };
      mockPrismaTenant.locker.create.mockResolvedValue({ locker_id: 'l-1' });
      await createLocker(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });
});
