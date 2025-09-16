import express from 'express';
import { 
  createVenue,
  updateVenue,
  deleteVenue,
  addSeatsToVenue,
  deleteSeatsFromVenue,
  createEvent,
  updateEvent,
  deleteEvent,
  createShow,
  updateShow,
  deleteShow,
  getAdvancedAnalytics
} from '../controllers/admin.controller';
import { authenticateToken, isAdmin } from '../middlewares/auth.middleware';
import { 
  validateCreateVenue, 
  validateUpdateVenue, 
  validateCreateEvent, 
  validateUpdateEvent, 
  validateCreateShow, 
  validateUpdateShow,
  validateBulkAddSeats,
  validateBulkDeleteSeats
} from '../middlewares/validation.middleware';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(isAdmin);

// Venue Management Routes
/**
 * @swagger
 * /api/v1/admin/venues:
 *   post:
 *     summary: Create a new venue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - venue_name
 *               - address
 *             properties:
 *               venue_name:
 *                 type: string
 *                 example: "Pune Convention Center"
 *               address:
 *                 type: string
 *                 example: "123 Main Street, Pune, Maharashtra"
 *     responses:
 *       201:
 *         description: Venue created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 venue:
 *                   $ref: '#/components/schemas/Venue'
 *       403:
 *         description: Admin access required
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
router.post('/venues', validateCreateVenue, createVenue);

/**
 * @swagger
 * /api/v1/admin/venues/{venue_id}:
 *   put:
 *     summary: Update a venue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: venue_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Venue ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               venue_name:
 *                 type: string
 *                 example: "Updated Pune Convention Center"
 *               address:
 *                 type: string
 *                 example: "456 New Street, Pune, Maharashtra"
 *     responses:
 *       200:
 *         description: Venue updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 venue:
 *                   $ref: '#/components/schemas/Venue'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Venue not found
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
router.put('/venues/:venue_id', validateUpdateVenue, updateVenue);

/**
 * @swagger
 * /api/v1/admin/venues/{venue_id}:
 *   delete:
 *     summary: Delete a venue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: venue_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Venue ID
 *     responses:
 *       200:
 *         description: Venue deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Venue deleted successfully"
 *       400:
 *         description: Cannot delete venue with existing shows
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Venue not found
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
router.delete('/venues/:venue_id', deleteVenue);

// Seat Management Routes
/**
 * @swagger
 * /api/v1/admin/venues/{venue_id}/seats:
 *   post:
 *     summary: Add seats to a venue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: venue_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Venue ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seats
 *             properties:
 *               seats:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - seat_row
 *                     - seat_number
 *                   properties:
 *                     seat_row:
 *                       type: string
 *                       example: "A"
 *                     seat_number:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       201:
 *         description: Seats added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bulk seat addition complete. 5 new seats were added."
 *                 added_count:
 *                   type: integer
 *                   example: 5
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Venue not found
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
router.post('/venues/:venue_id/seats', validateBulkAddSeats, addSeatsToVenue);

/**
 * @swagger
 * /api/v1/admin/venues/{venue_id}/seats:
 *   delete:
 *     summary: Delete seats from a venue (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: venue_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Venue ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - seats
 *             properties:
 *               seats:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - seat_row
 *                     - seat_number
 *                   properties:
 *                     seat_row:
 *                       type: string
 *                       example: "A"
 *                     seat_number:
 *                       type: integer
 *                       example: 1
 *     responses:
 *       200:
 *         description: Seats deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bulk seat deletion complete. 3 seats were deleted."
 *                 deleted_count:
 *                   type: integer
 *                   example: 3
 *                 deleted_seats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       seat_row:
 *                         type: string
 *                         example: "A"
 *                       seat_number:
 *                         type: integer
 *                         example: 1
 *       400:
 *         description: Cannot delete seats that are part of existing shows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Cannot delete seats that are part of an existing show. Please delete the shows first."
 *                 conflicting_seats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       seat_row:
 *                         type: string
 *                         example: "A"
 *                       seat_number:
 *                         type: integer
 *                         example: 1
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Venue not found or no matching seats found
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
router.delete('/venues/:venue_id/seats', validateBulkDeleteSeats, deleteSeatsFromVenue);

// Event Management Routes
/**
 * @swagger
 * /api/v1/admin/events:
 *   post:
 *     summary: Create a new event (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Tech Conference 2024"
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   $ref: '#/components/schemas/Event'
 *       403:
 *         description: Admin access required
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
router.post('/events', validateCreateEvent, createEvent);

/**
 * @swagger
 * /api/v1/admin/events/{event_id}:
 *   put:
 *     summary: Update an event (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Tech Conference 2024"
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 event:
 *                   $ref: '#/components/schemas/Event'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event not found
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
router.put('/events/:event_id', validateUpdateEvent, updateEvent);

/**
 * @swagger
 * /api/v1/admin/events/{event_id}:
 *   delete:
 *     summary: Delete an event (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: event_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Event deleted successfully"
 *       400:
 *         description: Cannot delete event with existing shows
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Event not found
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
router.delete('/events/:event_id', deleteEvent);

// Show Management Routes
/**
 * @swagger
 * /api/v1/admin/shows:
 *   post:
 *     summary: Create a new show (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event_id
 *               - venue_id
 *               - start_time
 *               - end_time
 *               - price
 *             properties:
 *               event_id:
 *                 type: integer
 *                 example: 1
 *               venue_id:
 *                 type: integer
 *                 example: 1
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T10:00:00Z"
 *               end_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T12:00:00Z"
 *               price:
 *                 type: number
 *                 example: 150.00
 *     responses:
 *       201:
 *         description: Show created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 show:
 *                   $ref: '#/components/schemas/Show'
 *       404:
 *         description: Event or venue not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
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
router.post('/shows', validateCreateShow, createShow);

/**
 * @swagger
 * /api/v1/admin/shows/{show_id}:
 *   put:
 *     summary: Update a show (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: show_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Show ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event_id:
 *                 type: integer
 *                 example: 1
 *               venue_id:
 *                 type: integer
 *                 example: 1
 *               start_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T10:00:00Z"
 *               end_time:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-06-15T12:00:00Z"
 *               price:
 *                 type: number
 *                 example: 175.00
 *     responses:
 *       200:
 *         description: Show updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 show:
 *                   $ref: '#/components/schemas/Show'
 *       400:
 *         description: Cannot update show with existing bookings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.put('/shows/:show_id', validateUpdateShow, updateShow);

/**
 * @swagger
 * /api/v1/admin/shows/{show_id}:
 *   delete:
 *     summary: Delete a show (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: show_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Show ID
 *     responses:
 *       200:
 *         description: Show deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Show deleted successfully"
 *       400:
 *         description: Cannot delete show with existing bookings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
router.delete('/shows/:show_id', deleteShow);

/**
 * @swagger
 * /api/v1/admin/analytics:
 *   get:
 *     summary: Get advanced analytics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 most_booked_events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event_id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       total_bookings:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       average_booking_value:
 *                         type: number
 *                 cancellation_rates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       show_id:
 *                         type: integer
 *                       event_title:
 *                         type: string
 *                       venue_name:
 *                         type: string
 *                       total_bookings:
 *                         type: integer
 *                       cancelled_bookings:
 *                         type: integer
 *                       cancellation_rate:
 *                         type: number
 *                 daily_booking_stats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       total_bookings:
 *                         type: integer
 *                       confirmed_bookings:
 *                         type: integer
 *                       cancelled_bookings:
 *                         type: integer
 *                       pending_bookings:
 *                         type: integer
 *                       total_revenue:
 *                         type: number
 *                       average_booking_value:
 *                         type: number
 *                 generated_at:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/analytics', getAdvancedAnalytics);

export default router;
