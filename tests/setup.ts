import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import IORedis from 'ioredis';

const execAsync = promisify(exec);

dotenv.config({ path: '.env.test' });


export const redisClient = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});


// Test database configuration
const testDbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 50000,
  connectionTimeoutMillis: 10000,
};

// Global test database pool
export const testPool = new Pool(testDbConfig);

// Track if Redis is already connected
let redisConnected = false;
let dbConnected = false;

// Setup function to be called from test files
export const setupTestEnvironment = async () => {
  console.log('🚀 Setting up test environment...');
  
  try {
    // Run database migrations first
    console.log('🔄 Running database migrations...');
    const { stdout, stderr } = await execAsync('npm run db:migrate:up:test');
    if (stderr && !stderr.includes('warn')) {
      console.warn('⚠️ Migration warnings:', stderr);
    }
    console.log('✅ Database migrations completed');
    
    // Connect to test database
    const client = await testPool.connect();
    client.release(); 
    dbConnected = true;
    console.log('✅ Connected to test database');

    // Connect to Redis only if not already connected
    if (!redisConnected) {
      try {
        await redisClient.connect();
        redisConnected = true;
        console.log('✅ Connected to Redis');
      } catch (error: any) {
        if (error.message.includes('already connecting/connected')) {
          console.log('✅ Redis already connected');
          redisConnected = true;
        } else {
          throw error;
        }
      }
    }

    // Clear Redis cache
    await redisClient.flushall();
    console.log('✅ Cleared Redis cache');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
};

// Teardown function to be called from test files
export const teardownTestEnvironment = async () => {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Skip migration rollback for tests
    console.log('⏭️ Skipping migration rollback (assuming database cleanup not needed)');
    
    // Close database connections with timeout
    const dbCleanup = testPool.end().catch((error) => {
      console.warn('⚠️ Database pool cleanup warning:', error.message);
    });
    
    // Close Redis connection with timeout
    let redisCleanup = Promise.resolve();
    if (redisConnected) {
      redisCleanup = redisClient.quit().then(() => {
        // Redis quit() returns "OK" string, we ignore it
      }).catch((error) => {
        console.warn('⚠️ Redis cleanup warning:', error.message);
      });
      redisConnected = false;
    }
    
    // Wait for both cleanups with a timeout
    await Promise.race([
      Promise.all([dbCleanup, redisCleanup]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cleanup timeout')), 10000)
      )
    ]);
    
    console.log('✅ Test environment cleaned up');
    
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
    // Force cleanup even if there are errors
    try {
      if (redisConnected) {
        await redisClient.disconnect();
        redisConnected = false;
      }
    } catch (disconnectError) {
      console.warn('⚠️ Force disconnect warning:', disconnectError);
    }
  }
};

// Clean up Redis cache
export const clearRedisCache = async () => {
  try {
    if (redisConnected) {
      await redisClient.flushall();
    }
  } catch (error) {
    console.error('Error clearing Redis cache:', error);
  }
};