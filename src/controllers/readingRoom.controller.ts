import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createReadingRoomSchema, updateReadingRoomSchema } from '../validations/readingRoom.validation';

export const getReadingRooms = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const libraryId = req.query.libraryId as string;
    const floorId = req.query.floorId as string | undefined;
    const prismaTenant = getTenantPrisma(tenantId);
    
    if (!libraryId) {
      return res.status(400).json({ error: 'libraryId query parameter is required' });
    }

    const rooms = await prismaTenant.readingRoom.findMany({
      where: {
        library_id: libraryId,
        status: 'active',
        ...(floorId ? { floor_id: floorId } : {}),
      },
      include: {
        roomType: { select: { room_type_id: true, name: true } },
      },
    });
    res.json(
      rooms.map((r: any) => ({
        ...r,
        room_number: r.name ?? null,
        total_seats: r.capacity,
        room_type_name: r.roomType?.name ?? null,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reading rooms' });
  }
};

export const createReadingRoom = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createReadingRoomSchema.parse(req.body);
    
    // Verify library belongs to tenant
    const library = await prismaTenant.library.findFirst({
      where: { library_id: validatedData.library_id, status: 'active' }
    });
    if (!library) {
      return res.status(404).json({ error: 'Library not found or does not belong to this tenant' });
    }

    const newRoom = await prismaTenant.readingRoom.create({
      data: { tenant_id: tenantId, ...validatedData }
    });
    
    // According to PRD, creating a Reading Room should optionally auto-generate seats.
    // For now, we just create the room. Seats generation could be a separate utility endpoint.

    res.status(201).json(newRoom);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create reading room' });
  }
};

export const updateReadingRoom = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const roomId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = updateReadingRoomSchema.parse(req.body);
    
    // Ideally, if capacity is reduced, we should check against occupied seats.
    if (validatedData.capacity) {
      const occupiedSeatsCount = await prismaTenant.seatAssignment.count({
        where: { seat: { room_id: roomId }, status: 'ACTIVE' }
      });
      if (validatedData.capacity < occupiedSeatsCount) {
        return res.status(400).json({ error: 'Cannot reduce capacity below currently occupied seats' });
      }
    }

    const updatedRoom = await prismaTenant.readingRoom.update({
      where: { room_id: roomId },
      data: validatedData
    });
    
    res.json(updatedRoom);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Reading room not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update reading room' });
  }
};

export const deleteReadingRoom = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const roomId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    // Prevent deletion if there are any occupied seats
    const occupiedSeatsCount = await prismaTenant.seatAssignment.count({
      where: { seat: { room_id: roomId }, status: 'ACTIVE' }
    });
    if (occupiedSeatsCount > 0) {
      return res.status(400).json({ error: 'Cannot delete reading room with occupied seats' });
    }

    // Soft delete: update status
    const deletedRoom = await prismaTenant.readingRoom.update({
      where: { room_id: roomId },
      data: { status: 'deleted' }
    });
    
    res.json({ message: 'Reading room deleted successfully', room: deletedRoom });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Reading room not found' });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete reading room' });
  }
};
