import { Request, Response } from 'express';
import { allocateSeat, transferSeat, vacateSeat } from '../controllers/seat.controller';
import { getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Seat Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;
  let txMock: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = { tenantId: 'tenant-123', user: { sub: 'actor-1' } };
    mockResponse = { json: jsonMock, status: statusMock };
    txMock = {
      seatAssignment: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() }
    };
    mockPrismaTenant = {
      $transaction: jest.fn().mockImplementation(cb => cb(txMock))
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('allocateSeat', () => {
    it('should allocate a vacant seat', async () => {
      mockRequest.params = { id: 'seat-1' };
      mockRequest.body = { student_id: 's-1', admission_id: 'adm-1' };
      
      txMock.seatAssignment.findMany.mockResolvedValue([]);
      txMock.seatAssignment.create.mockResolvedValue({ assignment_id: '1' });

      await allocateSeat(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(txMock.seatAssignment.create).toHaveBeenCalled();
    });

    it('should return 400 if seat is not vacant', async () => {
      mockRequest.params = { id: 'seat-1' };
      mockRequest.body = { student_id: 's-1', admission_id: 'adm-1' };
      
      txMock.seatAssignment.findMany.mockResolvedValue([{ assignment_id: 'active-1' }]);

      await allocateSeat(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Seat is already occupied for the given time slot' });
    });
  });

  describe('vacateSeat', () => {
    it('should throw if student does not occupy seat', async () => {
      mockRequest.params = { id: 'seat-1' };
      mockRequest.body = { student_id: 's-1' };
      txMock.seatAssignment.findFirst.mockResolvedValue(null);

      await vacateSeat(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Student does not actively occupy this seat' });
    });
  });
});
