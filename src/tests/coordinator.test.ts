import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createCoordinator, assignCoordinator } from '../controllers/coordinator.controller';
import bcrypt from 'bcryptjs';

jest.mock('../config/prisma');
jest.mock('bcryptjs');

describe('Coordinator Controller', () => {
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
      coordinator: { create: jest.fn() },
      coordinatorAssignment: { create: jest.fn(), updateMany: jest.fn() }
    };
    mockPrismaTenant = {
      coordinator: { findFirst: jest.fn() },
      $transaction: jest.fn().mockImplementation(cb => cb(txMock))
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
  });

  describe('createCoordinator', () => {
    it('should create a coordinator successfully', async () => {
      mockRequest.body = { name: 'John Doe', mobile: '1234567890', password: 'password123', assignments: [] };
      mockPrismaTenant.coordinator.findFirst.mockResolvedValue(null);
      txMock.coordinator.create.mockResolvedValue({ coordinator_id: 'c-1', name: 'John Doe' });
      
      await createCoordinator(mockRequest as Request, mockResponse as Response);
      
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(txMock.coordinator.create).toHaveBeenCalled();
    });
  });
});
