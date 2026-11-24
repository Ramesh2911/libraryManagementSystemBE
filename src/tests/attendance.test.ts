import { Request, Response } from 'express';
import { syncAttendance } from '../controllers/attendance.controller';
import { getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Attendance Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;

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
    
    mockPrismaTenant = {
      attendanceLog: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('syncAttendance', () => {
    it('should create a new log for the first ping of the day', async () => {
      mockRequest.body = {
        logs: [
          { student_id: '550e8400-e29b-41d4-a716-446655440000', timestamp: '2026-08-24T09:00:00Z' }
        ]
      };

      mockPrismaTenant.attendanceLog.findFirst.mockResolvedValue(null);
      
      await syncAttendance(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.attendanceLog.create).toHaveBeenCalled();
      expect(mockPrismaTenant.attendanceLog.update).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sync completed' }));
    });

    it('should update exit_time for subsequent pings on the same day', async () => {
      mockRequest.body = {
        logs: [
          { student_id: '550e8400-e29b-41d4-a716-446655440000', timestamp: '2026-08-24T17:00:00Z' }
        ]
      };

      mockPrismaTenant.attendanceLog.findFirst.mockResolvedValue({
        log_id: 'log-1',
        entry_time: new Date('2026-08-24T09:00:00Z')
      });
      
      await syncAttendance(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.attendanceLog.create).not.toHaveBeenCalled();
      expect(mockPrismaTenant.attendanceLog.update).toHaveBeenCalledWith({
        where: { log_id: 'log-1' },
        data: { exit_time: new Date('2026-08-24T17:00:00Z') }
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
