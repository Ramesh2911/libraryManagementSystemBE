import { Request, Response } from 'express';
import { getLibraries, createLibrary, updateLibrary, deleteLibrary } from '../controllers/library.controller';
import { prisma, getTenantPrisma } from '../config/prisma';

jest.mock('../config/prisma');

describe('Library Controller', () => {
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
      library: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      }
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
  });

  describe('getLibraries', () => {
    it('should return a list of active libraries', async () => {
      const mockLibraries = [{ library_id: 'lib-1', name: 'Main Lib', status: 'active' }];
      mockPrismaTenant.library.findMany.mockResolvedValue(mockLibraries);

      await getLibraries(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.library.findMany).toHaveBeenCalledWith({ where: { status: 'active' } });
      expect(jsonMock).toHaveBeenCalledWith(mockLibraries);
    });

    it('should handle errors', async () => {
      mockPrismaTenant.library.findMany.mockRejectedValue(new Error('DB Error'));

      await getLibraries(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to fetch libraries' });
    });
  });

  describe('createLibrary', () => {
    it('should create a new library and return 201', async () => {
      mockRequest.body = { name: 'New Library', address: '123 Street' };
      const createdLibrary = { library_id: 'lib-2', name: 'New Library', address: '123 Street', status: 'active' };
      mockPrismaTenant.library.create.mockResolvedValue(createdLibrary);

      await createLibrary(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.library.create).toHaveBeenCalledWith({
        data: {
          tenant_id: 'tenant-123',
          name: 'New Library',
          address: '123 Street',
        }
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(createdLibrary);
    });

    it('should return 400 if validation fails', async () => {
      mockRequest.body = { name: 'A' }; // Too short

      await createLibrary(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: 'Validation failed' }));
    });
  });

  describe('deleteLibrary', () => {
    it('should soft delete library', async () => {
      mockRequest.params = { id: 'lib-3' };
      mockPrismaTenant.library.update.mockResolvedValue({ library_id: 'lib-3', status: 'deleted' });

      await deleteLibrary(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.library.update).toHaveBeenCalledWith({
        where: { library_id: 'lib-3' },
        data: { status: 'deleted' }
      });
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'Library deleted successfully' }));
    });
  });
});
