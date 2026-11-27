import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { putPricing, getPricing } from '../controllers/librarySetup.controller';

jest.mock('../config/prisma');

describe('putPricing / getPricing', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockPrismaTenant: any;

  const RT = '932d557c-53eb-47cf-b2cb-07bebb60d676';
  const LIB = '4cb4527d-0187-4a8c-8b6b-c5cc554a940b';
  const BOGUS = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      tenantId: 'tenant-1',
      params: { id: LIB },
      body: [{ room_type_id: RT, full_day: { monthly_fee_per_seat: 1500 } }],
    };
    mockResponse = { json: jsonMock, status: statusMock };
    mockPrismaTenant = {
      library: { findFirst: jest.fn() },
      roomType: { findMany: jest.fn() },
      roomTypePricing: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (fn: any) => fn(mockPrismaTenant)),
      $executeRaw: jest.fn(),
    };
    (getTenantPrisma as jest.Mock).mockReturnValue(mockPrismaTenant);
    mockPrismaTenant.library.findFirst.mockResolvedValue({ library_id: LIB });
    mockPrismaTenant.roomTypePricing.findMany.mockResolvedValue([]);
  });

  describe('putPricing', () => {
    it('returns 400 UNKNOWN_ROOM_TYPE when room_type_id does not exist', async () => {
      mockRequest.body = [{ room_type_id: BOGUS, full_day: { monthly_fee_per_seat: 1000 } }];
      mockPrismaTenant.roomType.findMany.mockResolvedValue([]);

      await putPricing(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          statusCode: 400,
          code: 'UNKNOWN_ROOM_TYPE',
          message: expect.stringContaining(BOGUS),
        })
      );
      expect(mockPrismaTenant.$transaction).not.toHaveBeenCalled();
    });

    it('saves pricing when room_type_id exists', async () => {
      mockPrismaTenant.roomType.findMany.mockResolvedValue([{ room_type_id: RT }]);
      mockPrismaTenant.roomTypePricing.findMany.mockResolvedValue([
        {
          pricing_id: 'p1',
          library_id: LIB,
          room_type_id: RT,
          roomType: { name: 'AC' },
          full_day_monthly_fee_per_seat: 1500,
          full_day_security_deposit: 0,
          full_day_deposit_type: 'REFUNDABLE',
          full_day_advance_amount: 0,
          half_day_enabled: false,
          half_day_monthly_fee_per_seat: null,
          half_day_security_deposit: null,
          half_day_deposit_type: null,
          half_day_advance_amount: null,
        },
      ]);

      await putPricing(mockRequest as Request, mockResponse as Response);

      expect(mockPrismaTenant.$transaction).toHaveBeenCalled();
      expect(mockPrismaTenant.roomTypePricing.upsert).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, statusCode: 200 })
      );
    });

    it('maps Prisma P2003 to 400 FK_VIOLATION', async () => {
      mockPrismaTenant.roomType.findMany.mockResolvedValue([{ room_type_id: RT }]);
      const fkErr: any = new Error('FK');
      fkErr.code = 'P2003';
      mockPrismaTenant.$transaction.mockRejectedValue(fkErr);

      await putPricing(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'FK_VIOLATION' })
      );
    });

    it('returns 400 VALIDATION_FAILED on bad body', async () => {
      mockRequest.body = { not: 'an array' };

      await putPricing(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_FAILED' })
      );
    });
  });

  describe('getPricing', () => {
    it('returns 404 when library not found', async () => {
      mockPrismaTenant.library.findFirst.mockResolvedValue(null);

      await getPricing(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'NOT_FOUND' })
      );
    });

    it('returns pricing list', async () => {
      mockPrismaTenant.roomTypePricing.findMany.mockResolvedValue([]);

      await getPricing(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] })
      );
    });
  });
});
