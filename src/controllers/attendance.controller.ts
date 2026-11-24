import { Request, Response } from 'express';
import { getTenantPrisma } from '../config/prisma';
import { syncAttendanceSchema } from '../validations/attendance.validation';

export const syncAttendance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { logs } = syncAttendanceSchema.parse(req.body);

    const results = {
      processed: 0,
      errors: [] as any[]
    };

    // Process each log ping
    for (const log of logs) {
      try {
        const pingTime = new Date(log.timestamp);
        // Extract just the date part (e.g. YYYY-MM-DDT00:00:00Z)
        const dateStr = pingTime.toISOString().split('T')[0];
        const dateObj = new Date(`${dateStr}T00:00:00Z`);

        // Check if a record for this student and this date already exists
        const existingLog = await prismaTenant.attendanceLog.findFirst({
          where: {
            student_id: log.student_id,
            date: dateObj
          }
        });

        if (existingLog) {
          // If the new ping is later than entry_time, update it as exit_time
          if (pingTime > existingLog.entry_time) {
            await prismaTenant.attendanceLog.update({
              where: { log_id: existingLog.log_id },
              data: { exit_time: pingTime }
            });
          } else if (pingTime < existingLog.entry_time) {
            // Unlikely, but if ping is earlier, shift entry time and make the old entry the exit
            await prismaTenant.attendanceLog.update({
              where: { log_id: existingLog.log_id },
              data: { 
                entry_time: pingTime,
                exit_time: existingLog.entry_time
              }
            });
          }
        } else {
          // First ping of the day
          await prismaTenant.attendanceLog.create({
            data: {
              tenant_id: tenantId,
              student_id: log.student_id,
              date: dateObj,
              entry_time: pingTime
            }
          });
        }
        
        results.processed++;
      } catch (err: any) {
        results.errors.push({ student_id: log.student_id, error: err.message });
      }
    }

    res.status(200).json({ message: 'Sync completed', data: results });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to sync attendance' });
  }
};

export const getStudentAttendance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId as string;
    const studentId = req.params.studentId as string;
    const prismaTenant = getTenantPrisma(tenantId);

    const logs = await prismaTenant.attendanceLog.findMany({
      where: { student_id: studentId },
      orderBy: { date: 'desc' },
      take: 30 // Last 30 days
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
};
