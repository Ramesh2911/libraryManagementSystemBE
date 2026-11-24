import { Request, Response } from 'express';
import { createAdmission, cancelAdmission } from '../controllers/admission.controller';
import { getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Admission Controller', () => {
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
      user: { sub: 'actor-123', role: 'OWNER' }
    };
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };
    
    txMock = {
      student: { findUnique: jest.fn() },
      admission: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      fee: { create: jest.fn() },
      feeSnapshot: { create: jest.fn() },
      seat: { update: jest.fn(), findUnique: jest.fn() },
      seatHistory: { create: jest.fn() }
    };

    mockPrismaTenant = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(txMock);
      })
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('createAdmission', () => {
    it('should create admission and fee snapshot successfully', async () => {
      mockRequest.body = {
        student_id: '550e8400-e29b-41d4-a716-446655440000',
        plan: 'Basic Monthly',
        fee_amount: 1000,
        fee_type: 'monthly',
        due_date: '2026-08-01T00:00:00Z',
        seat_id: '123e4567-e89b-12d3-a456-426614174000'
      };

      txMock.student.findUnique.mockResolvedValue({ student_id: '550e8400-e29b-41d4-a716-446655440000', admissions: [] });
      txMock.seat.update.mockResolvedValue({ seat_id: '123e4567-e89b-12d3-a456-426614174000' });
      txMock.admission.create.mockResolvedValue({ admission_id: 'adm-1' });
      txMock.fee.create.mockResolvedValue({ fee_id: 'fee-1' });
      txMock.feeSnapshot.create.mockResolvedValue({ fee_snapshot_id: 'snap-1' });

      await createAdmission(mockRequest as Request, mockResponse as Response);

      expect(txMock.seat.update).toHaveBeenCalledWith({
        where: { seat_id: '123e4567-e89b-12d3-a456-426614174000', status: 'vacant' },
        data: { status: 'occupied', current_student_id: '550e8400-e29b-41d4-a716-446655440000' }
      });
      expect(txMock.admission.create).toHaveBeenCalled();
      expect(txMock.feeSnapshot.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Admission completed successfully' }));
    });
  });

  describe('cancelAdmission', () => {
    it('should cancel admission and vacate seat', async () => {
      mockRequest.params = { id: 'adm-1' };
      mockRequest.body = { cancellation_reason: 'Completed course' };

      txMock.admission.findUnique.mockResolvedValue({
        admission_id: 'adm-1',
        status: 'active',
        seat_id: 'seat-1',
        student_id: 'student-1'
      });
      txMock.seat.findUnique.mockResolvedValue({
        seat_id: 'seat-1',
        current_student_id: 'student-1'
      });

      await cancelAdmission(mockRequest as Request, mockResponse as Response);

      expect(txMock.admission.update).toHaveBeenCalledWith({
        where: { admission_id: 'adm-1' },
        data: { status: 'cancelled', cancellation_reason: 'Completed course' }
      });
      expect(txMock.seat.update).toHaveBeenCalledWith({
        where: { seat_id: 'seat-1' },
        data: { status: 'vacant', current_student_id: null }
      });
      expect(statusMock).not.toHaveBeenCalledWith(400);
      expect(statusMock).not.toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Admission cancelled successfully' }));
    });
  });
});
