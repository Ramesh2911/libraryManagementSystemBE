import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { createAdmissionSchema, cancelAdmissionSchema } from '../validations/admission.validation';

export const createAdmission = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const data = createAdmissionSchema.parse(req.body);

    const result = await prismaTenant.$transaction(async (tx) => {
      // 1. Verify student exists and has no active admission
      const student = await tx.student.findUnique({
        where: { student_id: data.student_id },
        include: { admissions: { where: { status: 'ACTIVE' } } }
      });
      if (!student) throw new Error('Student not found');
      if (student.admissions.length > 0) throw new Error('Student already has an active admission');

      // 2. Create Admission
      const admission = await tx.admission.create({
        data: {
          tenant_id: tenantId,
          student_id: data.student_id,
          plan_id: data.plan_id || '',
          start_date: new Date(),
          end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          fee_snapshot: data.amount_total - data.discount,
          status: 'ACTIVE'
        }
      });

      // 3. Allocate seats if provided
      const createdAssignments = [];
      if (data.seat_assignments && data.seat_assignments.length > 0) {
        for (const sa of data.seat_assignments) {
          // Check concurrency
          const existing = await tx.seatAssignment.findMany({
            where: {
              seat_id: sa.seat_id,
              status: 'ACTIVE',
              ...(sa.slot_id ? { slot_id: sa.slot_id } : {})
            }
          });
          if (existing.length > 0) {
            throw new Error(`Seat ${sa.seat_id} is already occupied for the given time slot`);
          }

          const assignment = await tx.seatAssignment.create({
            data: {
              tenant_id: tenantId,
              admission_id: admission.admission_id,
              student_id: data.student_id,
              seat_id: sa.seat_id,
              slot_id: sa.slot_id || undefined,
              assigned_by: actorId,
              status: 'ACTIVE',
              start_at: new Date()
            }
          });
          createdAssignments.push(assignment);
        }
      }

      // 4. Create FeeObligation
      const amount_due = data.amount_total - data.discount;
      const obligation = await tx.feeObligation.create({
        data: {
          tenant_id: tenantId,
          student_id: data.student_id,
          admission_id: admission.admission_id,
          billing_period: data.billing_cycle || 'CURRENT',
          amount_paid: 0.0,
          amount_due: amount_due,
          due_date: new Date(data.due_date),
          status: amount_due <= 0 ? 'PAID' : 'UPCOMING'
        }
      });

      return { admission, seat_assignments: createdAssignments, obligation };
    });

    res.status(201).json({ message: 'Admission completed successfully', data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create admission' });
  }
};

export const cancelAdmission = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const admissionId = req.params.id as string;
    const actorId = req.user?.sub as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { cancellation_reason } = cancelAdmissionSchema.parse(req.body);

    const result = await prismaTenant.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { admission_id: admissionId }
      });
      if (!admission || admission.status !== 'ACTIVE') {
        throw new Error('Admission not found or already cancelled');
      }

      // 1. Cancel Admission
      const cancelledAdmission = await tx.admission.update({
        where: { admission_id: admissionId },
        data: { status: 'CANCELLED', cancellation_reason, end_date: new Date() }
      });

      // 2. Close active seat assignments
      const activeAssignments = await tx.seatAssignment.findMany({
        where: { admission_id: admissionId, status: 'ACTIVE' }
      });

      for (const assignment of activeAssignments) {
        await tx.seatAssignment.update({
          where: { assignment_id: assignment.assignment_id },
          data: { status: 'CLOSED', end_at: new Date() }
        });
      }

      // 3. Mark pending obligations as cancelled
      await tx.feeObligation.updateMany({
        where: { admission_id: admissionId, status: 'PENDING' },
        data: { status: 'CANCELLED' }
      });

      return { cancelledAdmission, closedAssignmentsCount: activeAssignments.length };
    });

    res.json({ message: 'Admission cancelled successfully', data: result });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to cancel admission' });
  }
};
