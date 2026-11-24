import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { getRoomTypes, createRoomType, updateRoomType, deleteRoomType } from '../controllers/roomType.controller';

jest.mock('../config/prisma');

describe('RoomType Controller', () => {
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
      roomType: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('getRoomTypes', () => {
    it('should return room types successfully', async () => {
      mockPrismaTenant.roomType.findMany.mockResolvedValue([{ room_type_id: '1', name: 'AC' }]);
      await getRoomTypes(mockRequest as Request, mockResponse as Response);
      expect(jsonMock).toHaveBeenCalledWith([{ room_type_id: '1', name: 'AC' }]);
    });
  });

  describe('createRoomType', () => {
    it('should create a room type', async () => {
      mockRequest.body = { name: 'Non-AC' };
      mockPrismaTenant.roomType.create.mockResolvedValue({ room_type_id: '2', name: 'Non-AC' });
      await createRoomType(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({ room_type_id: '2', name: 'Non-AC' });
    });
  });
});
