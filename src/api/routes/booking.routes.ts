import express from 'express';
import { lockSeats, confirmBooking, cancelBooking, simulatePayment } from '../controllers/booking.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateLockSeats, validateConfirmBooking, validateCancelBooking, validatePaymentSimulate } from '../middlewares/validation.middleware';

const router = express.Router();

// Protected booking routes
router.use(authenticateToken); // All booking routes require authentication

/**
 * @swagger
 * /api/v1/bookings/lock:
 *   post:
 *     summary: Lock seats for booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - show_id
 *               - seat_ids
 *             properties:
 *               show_id:
 *                 type: integer
 *                 example: 1
 *               seat_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Seats locked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Seats locked successfully"
 *                 booking_id:
 *                   type: integer
 *                 locked_seats:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 expires_in:
 *                   type: integer
 *                   description: Lock timeout in seconds
 *       409:
 *         description: Some seats are no longer available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 failed_seats:
 *                   type: array
 *                   items:
 *                     type: integer
 *       404:
 *         description: Show not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/lock', validateLockSeats, lockSeats);

/**
 * @swagger
 * /api/v1/bookings/{booking_id}/confirm:
 *   post:
 *     summary: Confirm a booking after payment
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - booking_id
 *             properties:
 *               booking_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Booking confirmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Booking confirmed successfully"
 *                 booking_id:
 *                   type: integer
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Booking is not in pending status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:booking_id/confirm', validateConfirmBooking, confirmBooking);

/**
 * @swagger
 * /api/v1/bookings/{booking_id}/cancel:
 *   post:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: booking_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Booking ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - booking_id
 *             properties:
 *               booking_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Booking cancelled successfully"
 *                 booking_id:
 *                   type: integer
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Booking is already cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:booking_id/cancel', validateCancelBooking, cancelBooking);

/**
 * @swagger
 * /api/v1/bookings/payments/simulate:
 *   post:
 *     summary: Simulate payment processing
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - booking_id
 *               - amount
 *             properties:
 *               booking_id:
 *                 type: integer
 *                 example: 1
 *               amount:
 *                 type: number
 *                 example: 150.00
 *     responses:
 *       200:
 *         description: Payment successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment successful"
 *                 transaction_id:
 *                   type: string
 *                 amount:
 *                   type: number
 *       402:
 *         description: Payment failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment failed"
 *                 error:
 *                   type: string
 *                   example: "Insufficient funds"
 *       500:
 *         description: Payment processing failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/payments/simulate', validatePaymentSimulate, simulatePayment);


export default router;
