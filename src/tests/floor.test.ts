import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { getFloors, createFloor, updateFloor, deleteFloor } from '../controllers/floor.controller';

jest.mock('../config/prisma');

describe('Floor Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      tenantId: 'tenant-1',
      user: { sub: 'user-1' }
    };
    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };
    mockPrismaTenant = {
      floor: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('getFloors', () => {
    it('should return floors successfully', async () => {
      mockPrismaTenant.floor.findMany.mockResolvedValue([{ floor_id: '1', name: 'Ground Floor' }]);
      await getFloors(mockRequest as Request, mockResponse as Response);
      expect(mockPrismaTenant.floor.findMany).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith([{ floor_id: '1', name: 'Ground Floor' }]);
    });
  });

  describe('createFloor', () => {
    it('should create a floor successfully', async () => {
      mockRequest.body = { library_id: 'lib-1', name: 'First Floor' };
      mockPrismaTenant.floor.create.mockResolvedValue({ floor_id: '2', name: 'First Floor' });
      await createFloor(mockRequest as Request, mockResponse as Response);
      expect(mockPrismaTenant.floor.create).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ floor_id: '2', name: 'First Floor' });
    });

    it('should return 400 on invalid input', async () => {
      mockRequest.body = { name: 'First Floor' }; // missing library_id
      await createFloor(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
    });
  });

  describe('updateFloor', () => {
    it('should update a floor successfully', async () => {
      mockRequest.params = { id: '2' };
      mockRequest.body = { name: 'Updated Floor' };
      mockPrismaTenant.floor.update.mockResolvedValue({ floor_id: '2', name: 'Updated Floor' });
      await updateFloor(mockRequest as Request, mockResponse as Response);
      expect(mockPrismaTenant.floor.update).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({ floor_id: '2', name: 'Updated Floor' });
    });
  });

  describe('deleteFloor', () => {
    it('should mark a floor as deleted', async () => {
      mockRequest.params = { id: '2' };
      mockPrismaTenant.floor.update.mockResolvedValue({ floor_id: '2', status: 'deleted' });
      await deleteFloor(mockRequest as Request, mockResponse as Response);
      expect(mockPrismaTenant.floor.update).toHaveBeenCalledWith({
        where: { floor_id: '2' },
        data: { status: 'deleted' }
      });
      expect(jsonMock).toHaveBeenCalledWith({ message: 'Floor deleted successfully' });
    });
  });
});
