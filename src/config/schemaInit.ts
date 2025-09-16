import { pool } from './database';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if the database schema is initialized by checking for key tables
 * We'll check for the 'users' table as it's created in the first migration
 */
export const checkSchemaInitialized = async (): Promise<boolean> => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error('Error checking schema initialization:', error);
    return false;
  }
};

/**
 * Initialize the database schema by running migrations
 */
export const initializeSchema = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing database schema...');
    
    // Run the first migration (initial schema)
    const { stdout, stderr } = await execAsync('npm run db:initialize:prod');
    
    if (stderr && !stderr.includes('warn')) {
      console.warn('⚠️ Schema initialization warnings:', stderr);
    }
    
    console.log('✅ Database schema initialized successfully');
  } catch (error: any) {
    console.error('❌ Failed to initialize database schema:', error.message);
    throw error;
  }
};

/**
 * Ensure database schema is ready
 * Checks if schema is initialized, and initializes it if not
 */
export const ensureSchemaReady = async (): Promise<void> => {
  try {
    const isInitialized = await checkSchemaInitialized();
    
    if (!isInitialized) {
      console.log('📋 Database schema not found, initializing...');
      await initializeSchema();
    } else {
      console.log('✅ Database schema already initialized');
    }
  } catch (error) {
    console.error('❌ Error ensuring schema is ready:', error);
    throw error;
  }
};
