import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getTenantPrisma } from '../config/prisma';
import { verifyOtp } from '../services/otp.service';
import { createStudentSchema, updateStudentSchema } from '../validations/student.validation';

export const registerStudent = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const validatedData = createStudentSchema.parse(req.body);

    // Phone must be OTP-verified at account creation (OTP sent to student's phone)
    const otpCheck = await verifyOtp(validatedData.mobile, validatedData.otp);
    if (!otpCheck.ok) {
      const status = otpCheck.code === 'OTP_EXPIRED' ? 400 : 401;
      return res.status(status).json({ error: otpCheck.message, code: otpCheck.code });
    }

    // Check if mobile already exists for this tenant
    const existingStudent = await prismaTenant.student.findFirst({
      where: { mobile: validatedData.mobile }
    });

    if (existingStudent) {
      return res.status(400).json({ error: 'Student with this mobile already exists' });
    }

    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    const student = await prismaTenant.student.create({
      data: {
        tenant_id: tenantId,
        name: validatedData.name,
        mobile: validatedData.mobile,
        parent_mobile: validatedData.parent_mobile,
        address: validatedData.address,
        college: validatedData.college,
        emergency_contact: validatedData.emergency_contact,
        password: hashedPassword,
        photo_url: validatedData.photo_url,
        aadhaar_ref: validatedData.aadhaar_ref
      },
      select: {
        student_id: true,
        name: true,
        mobile: true,
        status: true,
        createdAt: true
      }
    });

    res.status(201).json({ message: 'Student registered successfully', student });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to register student' });
  }
};

export const getStudents = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } }
      ];
    }

    const students = await prismaTenant.student.findMany({
      where: whereClause,
      select: {
        student_id: true,
        name: true,
        mobile: true,
        college: true,
        status: true,
        createdAt: true,
        seatAssignments: {
          where: { status: 'ACTIVE' },
          select: { seat_id: true, seat: { select: { seat_number: true, room_id: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const studentId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const validatedData = updateStudentSchema.parse(req.body);

    const student = await prismaTenant.student.update({
      where: { student_id: studentId },
      data: validatedData,
      select: {
        student_id: true,
        name: true,
        mobile: true,
        status: true
      }
    });

    res.json({ message: 'Student updated successfully', student });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to update student' });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const studentId = req.params.id as string;
    const prismaTenant = getTenantPrisma(tenantId);

    // Ensure student does not have an active seat
    const student = await prismaTenant.student.findUnique({
      where: { student_id: studentId },
      include: { seatAssignments: { where: { status: 'ACTIVE' } } }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (student.seatAssignments.length > 0) {
      return res.status(400).json({ error: 'Cannot delete student holding an active seat. Vacate the seat first.' });
    }

    const updatedStudent = await prismaTenant.student.update({
      where: { student_id: studentId },
      data: { status: 'cancelled' },
      select: { student_id: true, name: true, status: true }
    });

    res.json({ message: 'Student deleted (cancelled) successfully', student: updatedStudent });
  } catch (error: any) {
    if (error.message) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete student' });
  }
};
