import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createFeePlanSchema, updateFeePlanSchema } from '../validations/feePlan.validation';

export const getFeePlans = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const feePlans = await prismaTenant.feePlan.findMany({
      where: { status: 'active' }
    });
    res.json(feePlans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch fee plans' });
  }
};

export const createFeePlan = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createFeePlanSchema.parse(req.body);
    
    const newFeePlan = await prismaTenant.feePlan.create({
      data: {
        tenant_id: tenantId,
        ...validatedData
      }
    });
    
    res.status(201).json(newFeePlan);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create fee plan' });
  }
};

export const updateFeePlan = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const planId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateFeePlanSchema.parse(req.body);
    
    const updatedFeePlan = await prismaTenant.feePlan.update({
      where: { plan_id: planId },
      data: validatedData
    });
    
    res.json(updatedFeePlan);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Fee plan not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update fee plan' });
  }
};

export const deleteFeePlan = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const planId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const deletedFeePlan = await prismaTenant.feePlan.update({
      where: { plan_id: planId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'Fee plan deleted successfully', plan: deletedFeePlan });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Fee plan not found' });
    }
    res.status(500).json({ error: 'Failed to delete fee plan' });
  }
};
