import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('[OK] Redis connected successfully.');
});

redis.on('error', (err) => {
  console.error('[ERR] Redis connection error:', err);
});
