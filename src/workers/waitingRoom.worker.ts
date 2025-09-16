import { Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';

interface WaitingRoomJobData {
  token: string;
  clientId: string;
  timestamp: number;
}

export const waitingRoomWorker = new Worker('waiting-room-queue', async (job: Job<WaitingRoomJobData>) => {
  const { token, clientId } = job.data;
  
  try {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 1000));
    
    // Check if client is still waiting
    const waitingRoomKey = `waiting_room:${clientId}`;
    const isStillWaiting = await redisClient.get(waitingRoomKey);
    
    if (isStillWaiting) {
      // Allow client to proceed
      await redisClient.setex(`can_proceed:${token}`, 300, 'true'); // 5 minutes to proceed
      
      console.log(`User ${clientId} can now proceed with token ${token}`);
    }
    
  } catch (error) {
    console.error('Waiting room worker error:', error);
    throw error;
  }
}, {
  connection: redisClient,
  concurrency: 10, // Process up to 10 users concurrently
});

waitingRoomWorker.on('completed', (job) => {
  console.log(`Waiting room job ${job.id} completed for user ${job.data.clientId}`);
});

waitingRoomWorker.on('failed', (job, err) => {
  console.error(`Waiting room job ${job?.id} failed:`, err);
});

waitingRoomWorker.on('error', (err) => {
  console.error('Waiting room worker error:', err);
});

console.log('Waiting room worker started');
