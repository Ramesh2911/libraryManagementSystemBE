import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { redis } from './config/redis';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Global Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

import authRoutes from './routes/auth.routes';
import libraryRoutes from './routes/library.routes';
import feePlanRoutes from './routes/feePlan.routes';
import floorRoutes from './routes/floor.routes';
import roomTypeRoutes from './routes/roomType.routes';
import timeSlotRoutes from './routes/timeSlot.routes';
import readingRoomRoutes from './routes/readingRoom.routes';
import seatRoutes from './routes/seat.routes';
import studentRoutes from './routes/student.routes';
import admissionRoutes from './routes/admission.routes';
import paymentRoutes from './routes/payment.routes';
import depositRoutes from './routes/deposit.routes';
import attendanceRoutes from './routes/attendance.routes';
import lockerRoutes from './routes/locker.routes';
import visitorRoutes from './routes/visitor.routes';
import coordinatorRoutes from './routes/coordinator.routes';
import aiRoutes from './routes/ai.routes';
import adminRoutes from './routes/admin.routes';
import { swaggerUi, openapiSpec, swaggerUiOptions } from './swagger';
import './jobs/cron'; // Start cron jobs

app.use('/api/auth', authRoutes);
app.use('/api/libraries', libraryRoutes);
app.use('/api/fee-plans', feePlanRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/room-types', roomTypeRoutes);
app.use('/api/time-slots', timeSlotRoutes);
app.use('/api/reading-rooms', readingRoomRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/admissions', admissionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/deposits', depositRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/lockers', lockerRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, swaggerUiOptions));
app.get('/openapi.yaml', (_req: Request, res: Response) => {
  res.type('yaml').send(fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8'));
});

// Health Check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: redis.status
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
