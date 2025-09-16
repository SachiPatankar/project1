import { Worker, Job } from 'bullmq';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';

interface CleanupJobData {
  type: 'expired_bookings';
}

const cleanupWorker = new Worker('cleanup-queue', async (job: Job<CleanupJobData>) => {
  const { type } = job.data;
  
  if (type === 'expired_bookings') {
    await cleanupExpiredBookings();
  }
}, {
  connection: redisClient,
  concurrency: 1 // Run cleanup jobs one at a time
});

async function cleanupExpiredBookings() {
  const client = await pool.connect();
  const timeoutMinutes = 10; // 10 minutes timeout for pending bookings
  
  try {
    await client.query('BEGIN');

    // Find expired bookings (PENDING status older than timeout)
    const expiredBookings = await client.query(`
      SELECT booking_id, show_id, user_id
      FROM bookings 
      WHERE status = 'PENDING' 
      AND created_at < NOW() - INTERVAL '${timeoutMinutes} minutes'
    `);

    console.log(`Found ${expiredBookings.rows.length} expired bookings to cleanup`);

    for (const booking of expiredBookings.rows) {
      const { booking_id, show_id, user_id } = booking;

      // Get seats for this booking
      const seatsResult = await client.query(
        'SELECT seat_id FROM show_seats WHERE booking_id = $1',
        [booking_id]
      );

      // Release seats back to AVAILABLE
      await client.query(
        'UPDATE show_seats SET status = $1, booking_id = NULL, locked_at = NULL WHERE booking_id = $2',
        ['AVAILABLE', booking_id]
      );

      // Update booking status to CANCELLED
      await client.query(
        'UPDATE bookings SET status = $1 WHERE booking_id = $2',
        ['CANCELLED', booking_id]
      );

      // Release Redis locks
      for (const seat of seatsResult.rows) {
        const lockKey = `seat_lock:${show_id}:${seat.seat_id}`;
        await redisClient.del(lockKey);
      }

      console.log(`Cleaned up expired booking ${booking_id} for user ${user_id}`);
    }

    await client.query('COMMIT');
    console.log(`Cleanup completed: ${expiredBookings.rows.length} expired bookings processed`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup error:', error);
    throw error;
  } finally {
    client.release();
  }
}

cleanupWorker.on('completed', (job) => {
  console.log(`Cleanup job ${job.id} completed`);
});

cleanupWorker.on('failed', (job, err) => {
  console.error(`Cleanup job ${job?.id} failed:`, err);
});

cleanupWorker.on('error', (err) => {
  console.error('Cleanup worker error:', err);
});

// Schedule cleanup job to run every minute
import { Queue } from 'bullmq';
import cron from 'node-cron';

const cleanupQueue = new Queue('cleanup-queue', { connection: redisClient });

// Schedule cleanup every minute
cron.schedule('*/2 * * * *', async () => {
  await cleanupQueue.add('cleanup-expired-bookings', {
    type: 'expired_bookings'
  });
});

console.log('Cleanup worker started with scheduled job every minute');
