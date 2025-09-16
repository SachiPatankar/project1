import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});
