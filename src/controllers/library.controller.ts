import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createLibrarySchema, updateLibrarySchema } from '../validations/library.validation';

export const getLibraries = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    // Only return active libraries (soft-delete filter)
    const libraries = await prismaTenant.library.findMany({
      where: { status: 'active' }
    });
    res.json(libraries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch libraries' });
  }
};

export const createLibrary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    // Validate request body
    const validatedData = createLibrarySchema.parse(req.body);
    
    const newLibrary = await prismaTenant.library.create({
      data: {
        tenant_id: tenantId,
        ...validatedData
      }
    });
    
    res.status(201).json(newLibrary);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create library' });
  }
};

export const updateLibrary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const libraryId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateLibrarySchema.parse(req.body);
    
    const updatedLibrary = await prismaTenant.library.update({
      where: { library_id: libraryId },
      data: validatedData
    });
    
    res.json(updatedLibrary);
  } catch (error: any) {
    if (error.code === 'P2025') { // Prisma RecordNotFound
      return res.status(404).json({ error: 'Library not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update library' });
  }
};

export const deleteLibrary = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const libraryId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    // Soft delete: update status to 'deleted'
    const deletedLibrary = await prismaTenant.library.update({
      where: { library_id: libraryId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'Library deleted successfully', library: deletedLibrary });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Library not found' });
    }
    res.status(500).json({ error: 'Failed to delete library' });
  }
};
