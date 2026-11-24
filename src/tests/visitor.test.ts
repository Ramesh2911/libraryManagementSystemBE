import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createVisitor, updateVisitorStatus } from '../controllers/visitor.controller';

jest.mock('../config/prisma');

describe('Visitor Controller', () => {
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
      visitor: { create: jest.fn(), update: jest.fn() },
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createVisitor', () => {
    it('should log a visitor', async () => {
      mockRequest.body = { library_id: '96b16520-22c6-43d9-ab70-cc3f443b749f', name: 'John', phone: '1234567890' };
      mockPrismaTenant.visitor.create.mockResolvedValue({ visitor_id: 'v-1' });
      await createVisitor(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });
});
