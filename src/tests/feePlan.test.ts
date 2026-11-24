import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { getFeePlans, createFeePlan } from '../controllers/feePlan.controller';

jest.mock('../config/prisma');

describe('FeePlan Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = { tenantId: 'tenant-1' };
    mockResponse = { json: jsonMock, status: statusMock };
    mockPrismaTenant = {
      feePlan: {
        findMany: jest.fn(),
        create: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createFeePlan', () => {
    it('should create a fee plan', async () => {
      mockRequest.body = { library_id: 'lib-1', name: 'Monthly', billing_period: 'MONTHLY', amount: 1000 };
      mockPrismaTenant.feePlan.create.mockResolvedValue({ plan_id: '1', name: 'Monthly' });
      await createFeePlan(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });
});
