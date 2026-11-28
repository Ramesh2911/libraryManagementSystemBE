import { Request, Response } from 'express';
import { getReadingRooms, createReadingRoom, updateReadingRoom, deleteReadingRoom } from '../controllers/readingRoom.controller';
import { prisma, getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Reading Room Controller', () => {
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
      readingRoom: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      library: {
        findFirst: jest.fn(),
      },
      seat: {
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      seatAssignment: {
        count: jest.fn(),
      },
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('getReadingRooms', () => {
    it('should return 400 if libraryId is missing', async () => {
      mockRequest.query = {};
      await getReadingRooms(mockRequest as Request, mockResponse as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'libraryId query parameter is required' });
    });

    it('should return reading rooms for valid libraryId', async () => {
      mockRequest.query = { libraryId: 'lib-1' };
      const rooms = [{ room_id: 'room-1', type: 'AC' }];
      mockPrismaTenant.readingRoom.findMany.mockResolvedValue(rooms);

      await getReadingRooms(mockRequest as Request, mockResponse as Response);
      expect(mockPrismaTenant.readingRoom.findMany).toHaveBeenCalledWith({
        where: { library_id: 'lib-1', status: 'active' },
        include: {
          roomType: { select: { room_type_id: true, name: true } },
        },
      });
      expect(jsonMock).toHaveBeenCalledWith([
        expect.objectContaining({ room_id: 'room-1', type: 'AC' }),
      ]);
    });
  });

  describe('createReadingRoom', () => {
    it('should create room when library exists', async () => {
      mockRequest.body = { library_id: '00000000-0000-0000-0000-000000000000', type: 'AC', capacity: 50 };
      mockPrismaTenant.library.findFirst.mockResolvedValue({ library_id: '00000000-0000-0000-0000-000000000000' });
      const createdRoom = { room_id: 'room-1', type: 'AC', capacity: 50 };
      mockPrismaTenant.readingRoom.create.mockResolvedValue(createdRoom);

      await createReadingRoom(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdRoom);
      expect(mockPrismaTenant.seat.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ room_id: 'room-1', seat_number: '1', status: 'ACTIVE' }),
          expect.objectContaining({ room_id: 'room-1', seat_number: '50', status: 'ACTIVE' }),
        ]),
        skipDuplicates: true,
      });
      expect(mockPrismaTenant.seat.createMany.mock.calls[0][0].data).toHaveLength(50);
    });

    it('should return 404 if library does not exist', async () => {
      mockRequest.body = { library_id: '00000000-0000-0000-0000-000000000000', type: 'AC', capacity: 50 };
      mockPrismaTenant.library.findFirst.mockResolvedValue(null);

      await createReadingRoom(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Library not found or does not belong to this tenant' }));
    });
  });

  describe('updateReadingRoom', () => {
    it('should return 400 if reducing capacity below occupied seats', async () => {
      mockRequest.params = { id: 'room-1' };
      mockRequest.body = { capacity: 10 }; // trying to reduce to 10
      mockPrismaTenant.seatAssignment.count.mockResolvedValue(15); // 15 occupied seats

      await updateReadingRoom(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cannot reduce capacity below currently occupied seats' }));
    });
  });

  describe('deleteReadingRoom', () => {
    it('should return 400 if room has occupied seats', async () => {
      mockRequest.params = { id: 'room-1' };
      mockPrismaTenant.seatAssignment.count.mockResolvedValue(5);

      await deleteReadingRoom(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Cannot delete reading room with occupied seats' }));
    });

    it('should soft delete room if no occupied seats', async () => {
      mockRequest.params = { id: 'room-1' };
      mockPrismaTenant.seatAssignment.count.mockResolvedValue(0);
      mockPrismaTenant.readingRoom.update.mockResolvedValue({ room_id: 'room-1', status: 'deleted' });

      await deleteReadingRoom(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.readingRoom.update).toHaveBeenCalledWith({
        where: { room_id: 'room-1' },
        data: { status: 'deleted' }
      });
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Reading room deleted successfully' }));
    });
  });
});
