import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createFloorSchema, updateFloorSchema } from '../validations/floor.validation';

export const getFloors = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.query.libraryId as string | undefined;
    const prismaTenant = getTenantPrisma(tenantId);

    const floors = await prismaTenant.floor.findMany({
      where: {
        status: { not: 'deleted' },
        ...(libraryId ? { library_id: libraryId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(floors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch floors' });
  }
};

export const createFloor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createFloorSchema.parse(req.body);
    
    const newFloor = await prismaTenant.floor.create({
      data: {
        tenant_id: tenantId,
        ...validatedData
      }
    });
    
    res.status(201).json(newFloor);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create floor' });
  }
};

export const updateFloor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const floorId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateFloorSchema.parse(req.body);
    
    const updatedFloor = await prismaTenant.floor.update({
      where: { floor_id: floorId },
      data: validatedData
    });
    
    res.json(updatedFloor);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Floor not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update floor' });
  }
};

export const deleteFloor = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const floorId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const deletedFloor = await prismaTenant.floor.update({
      where: { floor_id: floorId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'Floor deleted successfully', floor: deletedFloor });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Floor not found' });
    }
    res.status(500).json({ error: 'Failed to delete floor' });
  }
};
