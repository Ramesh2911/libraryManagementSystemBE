import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { registerStudent, getStudents, updateStudent, deleteStudent } from '../controllers/student.controller';
import { getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');
jest.mock('bcryptjs');

describe('Student Controller', () => {
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
      student: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('registerStudent', () => {
    it('should create a new student successfully', async () => {
      mockRequest.body = {
        name: 'John Doe',
        mobile: '1234567890',
        password: 'password123'
      };

      mockPrismaTenant.student.findFirst.mockResolvedValue(null); // No existing mobile
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      const mockCreatedStudent = {
        student_id: 'student-1',
        name: 'John Doe',
        mobile: '1234567890',
        status: 'active'
      };

      mockPrismaTenant.student.create.mockResolvedValue(mockCreatedStudent);

      await registerStudent(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.student.findFirst).toHaveBeenCalledWith({
        where: { mobile: '1234567890' }
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockPrismaTenant.student.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: 'tenant-123',
          name: 'John Doe',
          mobile: '1234567890',
          password: 'hashedPassword'
        })
      }));
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Student registered successfully', student: mockCreatedStudent });
    });

    it('should return 400 if mobile already exists', async () => {
      mockRequest.body = {
        name: 'John Doe',
        mobile: '1234567890',
        password: 'password123'
      };

      mockPrismaTenant.student.findFirst.mockResolvedValue({ student_id: 'existing-id' });

      await registerStudent(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Student with this mobile already exists' });
    });
  });

  describe('deleteStudent', () => {
    it('should prevent deleting student with active seat', async () => {
      mockRequest.params = { id: 'student-1' };
      mockPrismaTenant.student.findUnique.mockResolvedValue({
        student_id: 'student-1',
        seatAssignments: [{ assignment_id: '1' }] // Active seat assignment
      });

      await deleteStudent(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cannot delete student holding an active seat. Vacate the seat first.' }));
    });

    it('should cancel student if no active seat', async () => {
      mockRequest.params = { id: 'student-1' };
      mockPrismaTenant.student.findUnique.mockResolvedValue({
        student_id: 'student-1',
        seatAssignments: []
      });

      mockPrismaTenant.student.update.mockResolvedValue({
        student_id: 'student-1',
        status: 'cancelled'
      });

      await deleteStudent(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.student.update).toHaveBeenCalledWith({
        where: { student_id: 'student-1' },
        data: { status: 'cancelled' },
        select: { student_id: true, name: true, status: true }
      });
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Student deleted (cancelled) successfully' }));
    });
  });
});
