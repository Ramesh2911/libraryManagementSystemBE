import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getTenantPrisma } from '../config/prisma';
import { 
  createCoordinatorSchema, 
  assignCoordinatorSchema,
  updateCoordinatorPermissionsSchema,
  updateCoordinatorStatusSchema
} from '../validations/coordinator.validation';

export const getCoordinators = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const coordinators = await prismaTenant.coordinator.findMany({
      select: {
        coordinator_id: true,
        tenant_id: true,
        name: true,
        mobile: true,
        permissions: true,
        status: true,
        assignments: {
          where: { status: 'ACTIVE' }
        },
        createdAt: true,
        updatedAt: true
      }
    });
    res.json(coordinators);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch coordinators' });
  }
};

export const createCoordinator = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = createCoordinatorSchema.parse(req.body);
    
    const existing = await prismaTenant.coordinator.findFirst({
      where: { mobile: data.mobile }
    });
    if (existing) {
      return res.status(409).json({ error: 'Mobile number already in use' });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const result = await prismaTenant.$transaction(async (tx) => {
      const coordinator = await tx.coordinator.create({
        data: {
          tenant_id: tenantId,
          name: data.name,
          mobile: data.mobile,
          password: hashedPassword,
          permissions: data.permissions || {}
        }
      });

      if (data.assignments && data.assignments.length > 0) {
        for (const assignment of data.assignments) {
          if (!assignment.library_id && !assignment.floor_id && !assignment.room_id) {
            throw new Error('Assignment must have at least one of library_id, floor_id, or room_id');
          }
          await tx.coordinatorAssignment.create({
            data: {
              tenant_id: tenantId,
              coordinator_id: coordinator.coordinator_id,
              library_id: assignment.library_id || null,
              floor_id: assignment.floor_id || null,
              room_id: assignment.room_id || null,
              start_at: new Date(),
              assigned_by: actorId
            }
          });
        }
      }

      return coordinator;
    });
    
    res.status(201).json({ message: 'Coordinator created successfully', coordinator: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create coordinator' });
  }
};

export const assignCoordinator = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const coordinatorId = req.params.id as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const data = assignCoordinatorSchema.parse(req.body);

    await prismaTenant.$transaction(async (tx) => {
      // Replace all existing assignments (Close them)
      await tx.coordinatorAssignment.updateMany({
        where: { coordinator_id: coordinatorId, status: 'ACTIVE' },
        data: { status: 'CLOSED', end_at: new Date() }
      });

      // Add new ones
      for (const assignment of data.assignments) {
        if (!assignment.library_id && !assignment.floor_id && !assignment.room_id) {
          throw new Error('Assignment must have at least one of library_id, floor_id, or room_id');
        }
        await tx.coordinatorAssignment.create({
          data: {
            tenant_id: tenantId,
            coordinator_id: coordinatorId,
            library_id: assignment.library_id || null,
            floor_id: assignment.floor_id || null,
            room_id: assignment.room_id || null,
            start_at: new Date(),
            assigned_by: actorId
          }
        });
      }
    });

    res.json({ message: 'Coordinator assignments updated' });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to assign coordinator' });
  }
};

export const updatePermissions = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const id = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = updateCoordinatorPermissionsSchema.parse(req.body);
    
    const updated = await prismaTenant.coordinator.update({
      where: { coordinator_id: id },
      data: { permissions: data.permissions },
      select: { coordinator_id: true, permissions: true }
    });
    
    res.json(updated);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Coordinator not found' });
    }
    res.status(500).json({ error: 'Failed to update permissions' });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const id = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = updateCoordinatorStatusSchema.parse(req.body);
    
    const updated = await prismaTenant.coordinator.update({
      where: { coordinator_id: id },
      data: { status: data.status },
      select: { coordinator_id: true, status: true }
    });
    
    res.json(updated);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Coordinator not found' });
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
};
