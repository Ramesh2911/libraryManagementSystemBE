import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

import { prisma, getTenantPrisma } from '../config/prisma';

// Mock the Prisma module
jest.mock('../config/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
  getTenantPrisma: jest.fn(),
}));

// Setup global before each test
beforeEach(() => {
  mockReset(prisma as unknown as DeepMockProxy<PrismaClient>);
  // Default getTenantPrisma mock behavior
  (getTenantPrisma as jest.Mock).mockReturnValue(prisma);
});
