import { Request, Response } from 'express';
import { prisma, getTenantPrisma } from '../config/prisma';
import { allocateSeatSchema, transferSeatSchema, updateSeatStatusSchema } from '../validations/seat.validation';

export const getSeatMap = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const roomId = req.query.roomId as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    if (!roomId) {
      return res.status(400).json({ error: 'roomId query parameter is required' });
    }

    const seats = await prismaTenant.seat.findMany({
      where: { room_id: roomId },
      orderBy: { seat_number: 'asc' },
      include: {
        assignments: {
          where: { status: 'ACTIVE' },
          include: { student: { select: { name: true, student_id: true } } }
        }
      }
    });
    res.json(seats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seat map' });
  }
};

export const allocateSeat = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const seatId = req.params.id as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { student_id, admission_id, slot_id } = allocateSeatSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      // Concurrency check: find active assignments for this seat and slot
      const existingAssignments = await tx.seatAssignment.findMany({
        where: {
          seat_id: seatId,
          status: 'ACTIVE',
          ...(slot_id ? { slot_id } : {})
        }
      });

      if (existingAssignments.length > 0) {
        throw new Error('Seat is already occupied for the given time slot');
      }

      const assignment = await tx.seatAssignment.create({
        data: {
          tenant_id: tenantId,
          admission_id,
          student_id,
          seat_id: seatId,
          slot_id: slot_id || null,
          start_at: new Date(),
          assigned_by: actorId,
          status: 'ACTIVE'
        }
      });
      return assignment;
    });

    res.status(200).json({ message: 'Seat allocated successfully', assignment: result });
  } catch (error: any) {
    if (error.message === 'Seat is already occupied for the given time slot') {
      return res.status(400).json({ error: error.message });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to allocate seat' });
  }
};

export const transferSeat = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const oldSeatId = req.params.id as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { student_id, new_seat_id, slot_id } = transferSeatSchema.parse(req.body);

    const result = await prismaTenant.$transaction(async (tx) => {
      const activeAssignment = await tx.seatAssignment.findFirst({
        where: { seat_id: oldSeatId, student_id, status: 'ACTIVE' }
      });
      
      if (!activeAssignment) {
        throw new Error('Student does not actively occupy the old seat');
      }

      // Concurrency check on new seat
      const existingAssignments = await tx.seatAssignment.findMany({
        where: {
          seat_id: new_seat_id,
          status: 'ACTIVE',
          ...(slot_id || activeAssignment.slot_id ? { slot_id: slot_id || activeAssignment.slot_id } : {})
        }
      });
      if (existingAssignments.length > 0) {
        throw new Error('New seat is already occupied for the given time slot');
      }

      await tx.seatAssignment.update({
        where: { assignment_id: activeAssignment.assignment_id },
        data: { status: 'TRANSFERRED', end_at: new Date() }
      });

      const newAssignment = await tx.seatAssignment.create({
        data: {
          tenant_id: tenantId,
          admission_id: activeAssignment.admission_id,
          student_id,
          seat_id: new_seat_id,
          slot_id: slot_id || activeAssignment.slot_id,
          start_at: new Date(),
          assigned_by: actorId,
          status: 'ACTIVE'
        }
      });

      return newAssignment;
    });

    res.status(200).json({ message: 'Seat transferred successfully', assignment: result });
  } catch (error: any) {
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to transfer seat' });
  }
};

export const updateSeatStatus = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const seatId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { status } = updateSeatStatusSchema.parse(req.body);

    const updatedSeat = await prismaTenant.seat.update({
      where: { seat_id: seatId },
      data: { status }
    });

    res.json({ message: `Seat status updated to ${status}`, seat: updatedSeat });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update seat status' });
  }
};

export const vacateSeat = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const seatId = req.params.id as string;
    const studentId = req.body.student_id as string; // require student_id to know who is vacating
    const prismaTenant = getTenantPrisma(tenantId);

    if (!studentId) {
      return res.status(400).json({ error: 'student_id is required to vacate' });
    }

    const updated = await prismaTenant.$transaction(async (tx) => {
      const activeAssignment = await tx.seatAssignment.findFirst({
        where: { seat_id: seatId, student_id: studentId, status: 'ACTIVE' }
      });

      if (!activeAssignment) {
        throw new Error('Student does not actively occupy this seat');
      }

      return await tx.seatAssignment.update({
        where: { assignment_id: activeAssignment.assignment_id },
        data: { status: 'CLOSED', end_at: new Date() }
      });
    });

    res.json({ message: 'Seat vacated successfully', assignment: updated });
  } catch (error: any) {
    if (error.message === 'Student does not actively occupy this seat') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to vacate seat' });
  }
};

export const getSeatHistory = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const seatId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const history = await prismaTenant.seatAssignment.findMany({
      where: { seat_id: seatId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch seat history' });
  }
};
