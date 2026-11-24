import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createTimeSlotSchema, updateTimeSlotSchema } from '../validations/timeSlot.validation';

export const getTimeSlots = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const timeSlots = await prismaTenant.timeSlot.findMany({
      where: { status: { not: 'deleted' } }
    });
    res.json(timeSlots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
};

export const createTimeSlot = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createTimeSlotSchema.parse(req.body);
    
    const newTimeSlot = await prismaTenant.timeSlot.create({
      data: {
        tenant_id: tenantId,
        ...validatedData
      }
    });
    
    res.status(201).json(newTimeSlot);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create time slot' });
  }
};

export const updateTimeSlot = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const timeSlotId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateTimeSlotSchema.parse(req.body);
    
    const updatedTimeSlot = await prismaTenant.timeSlot.update({
      where: { slot_id: timeSlotId },
      data: validatedData
    });
    
    res.json(updatedTimeSlot);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'TimeSlot not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update time slot' });
  }
};

export const deleteTimeSlot = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const timeSlotId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const deletedTimeSlot = await prismaTenant.timeSlot.update({
      where: { slot_id: timeSlotId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'TimeSlot deleted successfully', timeSlot: deletedTimeSlot });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'TimeSlot not found' });
    }
    res.status(500).json({ error: 'Failed to delete time slot' });
  }
};
