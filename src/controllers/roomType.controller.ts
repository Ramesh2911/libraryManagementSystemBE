import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createRoomTypeSchema, updateRoomTypeSchema } from '../validations/roomType.validation';

export const getRoomTypes = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const roomTypes = await prismaTenant.roomType.findMany({
      where: { status: { not: 'deleted' } }
    });
    res.json(roomTypes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room types' });
  }
};

export const createRoomType = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createRoomTypeSchema.parse(req.body);
    
    const newRoomType = await prismaTenant.roomType.create({
      data: {
        tenant_id: tenantId,
        ...validatedData
      }
    });
    
    res.status(201).json(newRoomType);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create room type' });
  }
};

export const updateRoomType = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const roomTypeId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateRoomTypeSchema.parse(req.body);
    
    const updatedRoomType = await prismaTenant.roomType.update({
      where: { room_type_id: roomTypeId },
      data: validatedData
    });
    
    res.json(updatedRoomType);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'RoomType not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update room type' });
  }
};

export const deleteRoomType = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const roomTypeId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const deletedRoomType = await prismaTenant.roomType.update({
      where: { room_type_id: roomTypeId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'RoomType deleted successfully', roomType: deletedRoomType });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'RoomType not found' });
    }
    res.status(500).json({ error: 'Failed to delete room type' });
  }
};
