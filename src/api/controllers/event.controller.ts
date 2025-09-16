import { Request, Response } from 'express';
import { pool } from '../../config/database';
import { redisClient } from '../../config/redis';
import { ShowWithDetails } from '../../models';

export const getAllShows = async (req: Request, res: Response) => {
  try {
    // Try to get from cache first
    const cacheKey = 'shows:all';
    const cachedShows = await redisClient.get(cacheKey);
    
    if (cachedShows) {
      return res.status(200).json({ shows: JSON.parse(cachedShows) });
    }

    // If not in cache, fetch from database
    const result = await pool.query(`
      SELECT 
        s.show_id,
        s.event_id,
        s.venue_id,
        s.start_time,
        s.end_time,
        s.price,
        s.created_at,
        e.title as event_title,
        v.venue_name,
        v.address,
        COUNT(ss.seat_id) as total_seats,
        COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) as available_seats
      FROM shows s
      JOIN events e ON s.event_id = e.event_id
      JOIN venues v ON s.venue_id = v.venue_id
      LEFT JOIN show_seats ss ON s.show_id = ss.show_id
      WHERE s.start_time > NOW()
      GROUP BY s.show_id, e.title, v.venue_name, v.address
      ORDER BY s.start_time ASC
    `);

    const shows: ShowWithDetails[] = result.rows.map(row => ({
      show_id: row.show_id,
      event_id: row.event_id,
      venue_id: row.venue_id,
      start_time: row.start_time,
      end_time: row.end_time,
      price: parseFloat(row.price),
      created_at: row.created_at,
      event: {
        event_id: row.event_id,
        title: row.event_title
      },
      venue: {
        venue_id: row.venue_id,
        venue_name: row.venue_name,
        address: row.address
      },
      available_seats: parseInt(row.available_seats) || 0,
      total_seats: parseInt(row.total_seats) || 0
    }));

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(shows));

    res.status(200).json({ shows });
  } catch (error) {
    console.error('Error fetching shows:', error);
    res.status(500).json({ message: 'Failed to fetch shows' });
  }
};

export const getShowById = async (req: Request, res: Response) => {
  const { show_id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        s.show_id,
        s.event_id,
        s.venue_id,
        s.start_time,
        s.end_time,
        s.price,
        s.created_at,
        e.title as event_title,
        v.venue_name,
        v.address,
        COUNT(ss.seat_id) as total_seats,
        COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) as available_seats
      FROM shows s
      JOIN events e ON s.event_id = e.event_id
      JOIN venues v ON s.venue_id = v.venue_id
      LEFT JOIN show_seats ss ON s.show_id = ss.show_id
      WHERE s.show_id = $1
      GROUP BY s.show_id, e.title, v.venue_name, v.address
    `, [show_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Show not found' });
    }

    const row = result.rows[0];
    const show: ShowWithDetails = {
      show_id: row.show_id,
      event_id: row.event_id,
      venue_id: row.venue_id,
      start_time: row.start_time,
      end_time: row.end_time,
      price: parseFloat(row.price),
      created_at: row.created_at,
      event: {
        event_id: row.event_id,
        title: row.event_title
      },
      venue: {
        venue_id: row.venue_id,
        venue_name: row.venue_name,
        address: row.address
      },
      available_seats: parseInt(row.available_seats) || 0,
      total_seats: parseInt(row.total_seats) || 0
    };

    res.status(200).json({ show });
  } catch (error) {
    console.error('Error fetching show:', error);
    res.status(500).json({ message: 'Failed to fetch show' });
  }
};

export const searchShows = async (req: Request, res: Response) => {
  const { venue, event, time_range, availability } = req.query;

  try {
    let query = `
      SELECT 
        s.show_id,
        s.event_id,
        s.venue_id,
        s.start_time,
        s.end_time,
        s.price,
        s.created_at,
        e.title as event_title,
        v.venue_name,
        v.address,
        COUNT(ss.seat_id) as total_seats,
        COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) as available_seats
      FROM shows s
      JOIN events e ON s.event_id = e.event_id
      JOIN venues v ON s.venue_id = v.venue_id
      LEFT JOIN show_seats ss ON s.show_id = ss.show_id
      WHERE s.start_time > NOW()
    `;

    const params: any[] = [];
    let paramCount = 0;

    if (venue) {
      paramCount++;
      query += ` AND v.venue_name ILIKE $${paramCount}`;
      params.push(`%${venue}%`);
    }

    if (event) {
      paramCount++;
      query += ` AND e.title ILIKE $${paramCount}`;
      params.push(`%${event}%`);
    }

    if (time_range) {
      const [start, end] = (time_range as string).split(',');
      if (start) {
        paramCount++;
        query += ` AND s.start_time >= $${paramCount}`;
        params.push(start);
      }
      if (end) {
        paramCount++;
        query += ` AND s.start_time <= $${paramCount}`;
        params.push(end);
      }
    }

    query += ` GROUP BY s.show_id, e.title, v.venue_name, v.address`;

    if (availability === 'available') {
      query += ` HAVING COUNT(CASE WHEN ss.status = 'AVAILABLE' THEN 1 END) > 0`;
    }

    query += ` ORDER BY s.start_time ASC`;

    const result = await pool.query(query, params);

    const shows: ShowWithDetails[] = result.rows.map(row => ({
      show_id: row.show_id,
      event_id: row.event_id,
      venue_id: row.venue_id,
      start_time: row.start_time,
      end_time: row.end_time,
      price: parseFloat(row.price),
      created_at: row.created_at,
      event: {
        event_id: row.event_id,
        title: row.event_title
      },
      venue: {
        venue_id: row.venue_id,
        venue_name: row.venue_name,
        address: row.address
      },
      available_seats: parseInt(row.available_seats) || 0,
      total_seats: parseInt(row.total_seats) || 0
    }));

    res.status(200).json({ shows });
  } catch (error) {
    console.error('Error searching shows:', error);
    res.status(500).json({ message: 'Failed to search shows' });
  }
};

export const getShowSeats = async (req: Request, res: Response) => {
  const { show_id } = req.params;

  try {
    const result = await pool.query(`
      SELECT 
        s.seat_id,
        s.seat_row,
        s.seat_number,
        s.venue_id,
        ss.status,
        ss.booking_id,
        ss.locked_at
      FROM seats s
      LEFT JOIN show_seats ss ON s.seat_id = ss.seat_id AND ss.show_id = $1
      WHERE s.venue_id = (
        SELECT venue_id FROM shows WHERE show_id = $1
      )
      ORDER BY s.seat_row, s.seat_number
    `, [show_id]);

    const seats = result.rows.map(row => ({
      seat_id: row.seat_id,
      venue_id: row.venue_id,
      seat_row: row.seat_row,
      seat_number: row.seat_number,
      status: row.status || 'AVAILABLE',
      booking_id: row.booking_id,
      locked_at: row.locked_at
    }));

    res.status(200).json({ seats });
  } catch (error) {
    console.error('Error fetching show seats:', error);
    res.status(500).json({ message: 'Failed to fetch show seats' });
  }
};
