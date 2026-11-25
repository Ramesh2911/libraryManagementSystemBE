import { PrismaClient } from '@prisma/client';
// Using interactive transactions with `SET LOCAL` is the recommended way for RLS with Prisma
// We can extend the Prisma client to accept a tenant_id and automatically wrap queries in an RLS context.

export const prisma = new PrismaClient();

/**
 * Returns a prisma instance scoped to the tenant ID using RLS.
 * It uses interactive transactions to `SET LOCAL app.tenant_id`.
 */
export function getTenantPrisma(tenantId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // Wrap all queries in an interactive transaction.
          // Render free Postgres is slow/cold - raise timeout to avoid P2028.
          return prisma.$transaction(
            async (tx) => {
              await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
              return query(args);
            },
            { timeout: 30_000, maxWait: 10_000 }
          );
        },
      },
    },
  });
}
