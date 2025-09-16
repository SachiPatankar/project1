import express from 'express';
import { getUserBookings } from '../controllers/booking.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/v1/user/bookings:
 *   get:
 *     summary: Get user's bookings
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User bookings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BookingWithDetails'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/bookings', getUserBookings);

export default router;