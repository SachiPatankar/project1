import { Queue } from 'bullmq';
import { redisClient } from './redis';

// Virtual Waiting Room Queue - handles traffic throttling
export const waitingRoomQueue = new Queue('waiting-room-queue', { 
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  }
});


console.log('Queues initialized: waiting-room-queue, booking-queue');
