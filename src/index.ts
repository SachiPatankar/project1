import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import database
import { pool } from './config/database';
import { ensureSchemaReady } from './config/schemaInit';

// Import routes
import authRoutes from './api/routes/auth.routes';
import eventRoutes from './api/routes/event.routes';
import bookingRoutes from './api/routes/booking.routes';
import userRoutes from './api/routes/user.routes';
import adminRoutes from './api/routes/admin.routes';

// Import middleware
import { virtualWaitingRoom, rateLimiter } from './api/middlewares/waitingRoom.middleware';

// Import workers
import './workers/waitingRoom.worker';
import './workers/cleanup.worker';

// Import Swagger
import { setupSwagger } from './config/swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Virtual Waiting Room and Rate Limiting
app.use(rateLimiter);
app.use(virtualWaitingRoom);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-01T10:00:00.000Z"
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.status(200).json({ status: 'Welcome to Evently Backend', timestamp: new Date().toISOString() });
});

// Setup Swagger documentation
setupSwagger(app);

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/shows', eventRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', adminRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await pool.end();
    console.log('✅ Database connections closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Initialize server with schema check
const startServer = async () => {
  try {
    // Ensure database schema is ready
    await ensureSchemaReady();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🎉 Evently Backend Server is running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
