import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createLockerSchema, assignLockerSchema } from '../validations/locker.validation';

export const getLockers = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const lockers = await prisma.locker.findMany({ 
      include: { assignments: { where: { status: 'ACTIVE' } } } 
    });
    res.json(lockers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lockers' });
  }
};

export const createLocker = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prisma = getTenantPrisma(tenantId);
    const data = createLockerSchema.parse(req.body);
    const locker = await prisma.locker.create({ data: { tenant_id: tenantId, ...data } });
    res.status(201).json(locker);
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: error.issues });
    res.status(500).json({ error: 'Failed to create locker' });
  }
};

export const assignLocker = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user?.sub as string;
    const lockerId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);
    const data = assignLockerSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const locker = await tx.locker.findUnique({ where: { locker_id: lockerId } });
      if (!locker || locker.status !== 'AVAILABLE') throw new Error('Locker is not available');

      const assignment = await tx.lockerAssignment.create({
        data: {
          tenant_id: tenantId,
          locker_id: lockerId,
          student_id: data.student_id,
          start_at: new Date(),
          assigned_by: actorId
        }
      });

      await tx.locker.update({ where: { locker_id: lockerId }, data: { status: 'ASSIGNED' } });
      return assignment;
    });

    res.status(201).json({ message: 'Locker assigned successfully', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign locker' });
  }
};

export const releaseLocker = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const lockerId = req.params.id as string;
    const prisma = getTenantPrisma(tenantId);

    const result = await prisma.$transaction(async (tx) => {
      const activeAssignments = await tx.lockerAssignment.findMany({
        where: { locker_id: lockerId, status: 'ACTIVE' }
      });
      if (!activeAssignments.length) throw new Error('Locker has no active assignment');

      for (const assignment of activeAssignments) {
        await tx.lockerAssignment.update({
          where: { assignment_id: assignment.assignment_id },
          data: { status: 'RELEASED', end_at: new Date() }
        });
      }

      const locker = await tx.locker.update({
        where: { locker_id: lockerId },
        data: { status: 'AVAILABLE' }
      });

      return locker;
    });

    res.json({ message: 'Locker released successfully', data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to release locker' });
  }
};
