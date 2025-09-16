import express from 'express';
import { getAllShows, getShowById, searchShows, getShowSeats } from '../controllers/event.controller';

const router = express.Router();

/**
 * @swagger
 * /api/v1/shows:
 *   get:
 *     summary: Get all upcoming shows
 *     tags: [Shows]
 *     responses:
 *       200:
 *         description: List of shows retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShowWithDetails'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', getAllShows);

/**
 * @swagger
 * /api/v1/shows/search:
 *   get:
 *     summary: Search shows by venue, event, time range or availability
 *     tags: [Shows]
 *     parameters:
 *       - in: query
 *         name: venue
 *         schema:
 *           type: string
 *         description: Venue name to search for
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *         description: Event title to search for
 *       - in: query
 *         name: time_range
 *         schema:
 *           type: string
 *         description: Time range in format "start,end" (ISO date format)
 *       - in: query
 *         name: availability
 *         schema:
 *           type: string
 *           enum: [available]
 *         description: Filter for shows with available seats
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ShowWithDetails'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/search', searchShows);

/**
 * @swagger
 * /api/v1/shows/{show_id}:
 *   get:
 *     summary: Get show by ID
 *     tags: [Shows]
 *     parameters:
 *       - in: path
 *         name: show_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Show ID
 *     responses:
 *       200:
 *         description: Show retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 show:
 *                   $ref: '#/components/schemas/ShowWithDetails'
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
router.get('/:show_id', getShowById);

/**
 * @swagger
 * /api/v1/shows/{show_id}/seats:
 *   get:
 *     summary: Get all seats for a specific show
 *     tags: [Shows]
 *     parameters:
 *       - in: path
 *         name: show_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Show ID
 *     responses:
 *       200:
 *         description: Show seats retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 seats:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SeatWithStatus'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:show_id/seats', getShowSeats);

export default router;
