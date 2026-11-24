import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } from '../controllers/timeSlot.controller';

jest.mock('../config/prisma');

describe('TimeSlot Controller', () => {
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
      timeSlot: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createTimeSlot', () => {
    it('should create a time slot', async () => {
      mockRequest.body = { library_id: 'lib-1', name: 'Morning', start_time: '08:00', end_time: '14:00' };
      mockPrismaTenant.timeSlot.create.mockResolvedValue({ slot_id: '1', name: 'Morning' });
      await createTimeSlot(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ slot_id: '1', name: 'Morning' });
    });
  });
});
