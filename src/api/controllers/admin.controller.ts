import { Request, Response } from 'express';
import { pool } from '../../config/database';
import { redisClient } from '../../config/redis';
import { 
  CreateVenueRequest, 
  UpdateVenueRequest, 
  CreateEventRequest, 
  UpdateEventRequest, 
  CreateShowRequest, 
  UpdateShowRequest,
  BulkAddSeatsRequest, 
  BulkDeleteSeatsRequest 
} from '../../models';

// Venue Management
export const createVenue = async (req: Request, res: Response) => {
  const { venue_name, address }: CreateVenueRequest = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO venues (venue_name, address) VALUES ($1, $2) RETURNING *',
      [venue_name, address]
    );

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(201).json({ venue: result.rows[0] });
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({ message: 'Failed to create venue' });
  }
};

export const updateVenue = async (req: Request, res: Response) => {
  const { venue_id } = req.params;
  const { venue_name, address }: UpdateVenueRequest = req.body;

  try {
    const result = await pool.query(
      'UPDATE venues SET venue_name = COALESCE($1, venue_name), address = COALESCE($2, address) WHERE venue_id = $3 RETURNING *',
      [venue_name, address, venue_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ venue: result.rows[0] });
  } catch (error) {
    console.error('Error updating venue:', error);
    res.status(500).json({ message: 'Failed to update venue' });
  }
};

export const deleteVenue = async (req: Request, res: Response) => {
  const { venue_id } = req.params;

  try {
    // Check if venue has any shows
    const showsCheck = await pool.query('SELECT COUNT(*) FROM shows WHERE venue_id = $1', [venue_id]);
    if (parseInt(showsCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete venue with existing shows' });
    }

    const result = await pool.query('DELETE FROM venues WHERE venue_id = $1 RETURNING *', [venue_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error('Error deleting venue:', error);
    res.status(500).json({ message: 'Failed to delete venue' });
  }
};

export const addSeatsToVenue = async (req: Request, res: Response) => {
  const { venue_id } = req.params;
  const { seats }: BulkAddSeatsRequest = req.body;

  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ message: 'Request body must contain a non-empty array of seats.' });
  }

  const client = await pool.connect();
  try {
    // Check if venue exists
    const venueCheck = await client.query('SELECT venue_id FROM venues WHERE venue_id = $1', [venue_id]);
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }
    
    // Using a single, efficient query to insert multiple rows.
    // ON CONFLICT ensures that we don't get an error if a seat already exists.
    const insertQuery = `
      INSERT INTO seats (venue_id, seat_row, seat_number)
      SELECT $1, (seat->>'seat_row')::text, (seat->>'seat_number')::integer
      FROM unnest($2::jsonb[]) AS seat
      ON CONFLICT (venue_id, seat_row, seat_number) DO NOTHING
      RETURNING seat_id;
    `;
    
    const result = await client.query(insertQuery, [venue_id, seats.map(s => JSON.stringify(s))]);

    res.status(201).json({ 
      message: `Bulk seat addition complete. ${result.rowCount} new seats were added.`,
      added_count: result.rowCount
    });

  } catch (error) {
    console.error('Error adding seats in bulk:', error);
    res.status(500).json({ message: 'Failed to add seats' });
  } finally {
    client.release();
  }
};

export const deleteSeatsFromVenue = async (req: Request, res: Response) => {
  const { venue_id } = req.params;
  const { seats }: BulkDeleteSeatsRequest = req.body;

  if (!seats || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ message: 'Request body must contain a non-empty array of seats.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if venue exists
    const venueCheck = await client.query('SELECT venue_id FROM venues WHERE venue_id = $1', [venue_id]);
    if (venueCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Venue not found' });
    }

    // Get seat_ids for the given seat row/number combinations
    // Build a more robust query using ANY with arrays
    const seatRows = seats.map(seat => seat.seat_row);
    const seatNumbers = seats.map(seat => seat.seat_number);
    
    const seatQuery = `
      SELECT seat_id, seat_row, seat_number 
      FROM seats 
      WHERE venue_id = $1 
      AND (seat_row, seat_number) IN (
        SELECT unnest($2::text[]) as row, unnest($3::int[]) as num
      )
    `;
    
    const seatResult = await client.query(seatQuery, [venue_id, seatRows, seatNumbers]);
    
    if (seatResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'No matching seats found for the given venue' });
    }

    const seatIds = seatResult.rows.map(r => r.seat_id);
    
    // Safety Check: Ensure none of the seats are part of any show
    const showsCheck = await client.query(
      `SELECT DISTINCT seat_id FROM show_seats WHERE seat_id = ANY($1::int[])`,
      [seatIds]
    );

    if (showsCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Cannot delete seats that are part of an existing show. Please delete the shows first.',
        conflicting_seats: showsCheck.rows.map(r => {
          const seat = seatResult.rows.find(s => s.seat_id === r.seat_id);
          return { seat_row: seat?.seat_row, seat_number: seat?.seat_number };
        })
      });
    }

    // Proceed with deletion
    const result = await client.query(
      'DELETE FROM seats WHERE seat_id = ANY($1::int[]) RETURNING seat_id, seat_row, seat_number',
      [seatIds]
    );

    await client.query('COMMIT');
    
    res.status(200).json({ 
      message: `Bulk seat deletion complete. ${result.rowCount} seats were deleted.`,
      deleted_count: result.rowCount,
      deleted_seats: result.rows.map(r => ({ seat_row: r.seat_row, seat_number: r.seat_number }))
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting seats in bulk:', error);
    res.status(500).json({ message: 'Failed to delete seats' });
  } finally {
    client.release();
  }
};

// Event Management
export const createEvent = async (req: Request, res: Response) => {
  const { title }: CreateEventRequest = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO events (title) VALUES ($1) RETURNING *',
      [title]
    );

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(201).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Failed to create event' });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  const { event_id } = req.params;
  const { title }: UpdateEventRequest = req.body;

  try {
    const result = await pool.query(
      'UPDATE events SET title = COALESCE($1, title) WHERE event_id = $2 RETURNING *',
      [title, event_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ event: result.rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Failed to update event' });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  const { event_id } = req.params;

  try {
    // Check if event has any shows
    const showsCheck = await pool.query('SELECT COUNT(*) FROM shows WHERE event_id = $1', [event_id]);
    if (parseInt(showsCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete event with existing shows' });
    }

    const result = await pool.query('DELETE FROM events WHERE event_id = $1 RETURNING *', [event_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Failed to delete event' });
  }
};

// Show Management
export const createShow = async (req: Request, res: Response) => {
  const { event_id, venue_id, start_time, end_time, price }: CreateShowRequest = req.body;

  try {
    // Verify event and venue exist
    const eventCheck = await pool.query('SELECT event_id FROM events WHERE event_id = $1', [event_id]);
    const venueCheck = await pool.query('SELECT venue_id FROM venues WHERE venue_id = $1', [venue_id]);

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Venue not found' });
    }

    const result = await pool.query(
      'INSERT INTO shows (event_id, venue_id, start_time, end_time, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [event_id, venue_id, start_time, end_time, price]
    );

    const show = result.rows[0];

    // Create show_seats entries for all seats in the venue
    const seatsResult = await pool.query('SELECT seat_id FROM seats WHERE venue_id = $1', [venue_id]);
    
    for (const seat of seatsResult.rows) {
      await pool.query(
        'INSERT INTO show_seats (show_id, seat_id, status) VALUES ($1, $2, $3)',
        [show.show_id, seat.seat_id, 'AVAILABLE']
      );
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(201).json({ show });
  } catch (error) {
    console.error('Error creating show:', error);
    res.status(500).json({ message: 'Failed to create show' });
  }
};

export const updateShow = async (req: Request, res: Response) => {
  const { show_id } = req.params;
  const { event_id, venue_id, start_time, end_time, price }: UpdateShowRequest = req.body;

  try {
    // Check if show has any bookings
    const bookingsCheck = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE show_id = $1 AND status IN ($2, $3)',
      [show_id, 'PENDING', 'CONFIRMED']
    );
    
    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot update show with existing bookings' });
    }

    const result = await pool.query(
      'UPDATE shows SET event_id = COALESCE($1, event_id), venue_id = COALESCE($2, venue_id), start_time = COALESCE($3, start_time), end_time = COALESCE($4, end_time), price = COALESCE($5, price) WHERE show_id = $6 RETURNING *',
      [event_id, venue_id, start_time, end_time, price, show_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ show: result.rows[0] });
  } catch (error) {
    console.error('Error updating show:', error);
    res.status(500).json({ message: 'Failed to update show' });
  }
};

export const deleteShow = async (req: Request, res: Response) => {
  const { show_id } = req.params;

  try {
    // Check if show has any bookings
    const bookingsCheck = await pool.query(
      'SELECT COUNT(*) FROM bookings WHERE show_id = $1 AND status IN ($2, $3)',
      [show_id, 'PENDING', 'CONFIRMED']
    );
    
    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({ message: 'Cannot delete show with existing bookings' });
    }

    const result = await pool.query('DELETE FROM shows WHERE show_id = $1 RETURNING *', [show_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Show not found' });
    }

    // Invalidate shows cache
    await redisClient.del('shows:all');

    res.status(200).json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    res.status(500).json({ message: 'Failed to delete show' });
  }
};

export const getAdvancedAnalytics = async (req: Request, res: Response) => {
  try {
    // Most booked events
    const mostBookedEvents = await pool.query(`
      SELECT 
        e.event_id,
        e.title,
        COUNT(b.booking_id) as total_bookings,
        SUM(s.price) as total_revenue,
        AVG(s.price) as average_booking_value
      FROM events e
      JOIN shows s ON e.event_id = s.event_id
      JOIN bookings b ON s.show_id = b.show_id
      WHERE b.status = 'CONFIRMED'
      GROUP BY e.event_id, e.title
      ORDER BY total_bookings DESC
      LIMIT 10
    `);

    // Cancellation rates by show
    const cancellationRates = await pool.query(`
      SELECT 
        s.show_id,
        e.title as event_title,
        v.venue_name,
        COUNT(b.booking_id) as total_bookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END) as cancelled_bookings,
        ROUND(
          (COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END)::DECIMAL / COUNT(b.booking_id)) * 100, 2
        ) as cancellation_rate
      FROM shows s
      JOIN events e ON s.event_id = e.event_id
      JOIN venues v ON s.venue_id = v.venue_id
      LEFT JOIN bookings b ON s.show_id = b.show_id
      WHERE b.booking_id IS NOT NULL
      GROUP BY s.show_id, e.title, v.venue_name
      HAVING COUNT(b.booking_id) > 0
      ORDER BY cancellation_rate DESC
    `);

    // Daily booking stats for the last 30 days
    const dailyBookingStats = await pool.query(`
      SELECT 
        DATE(b.created_at) as date,
        COUNT(b.booking_id) as total_bookings,
        COUNT(CASE WHEN b.status = 'CONFIRMED' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN b.status = 'CANCELLED' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN b.status = 'PENDING' THEN 1 END) as pending_bookings,
        SUM(CASE WHEN b.status = 'CONFIRMED' THEN s.price ELSE 0 END) as total_revenue,
        AVG(CASE WHEN b.status = 'CONFIRMED' THEN s.price ELSE NULL END) as average_booking_value
      FROM bookings b
      JOIN shows s ON b.show_id = s.show_id
      WHERE b.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(b.created_at)
      ORDER BY date DESC
    `);

    res.status(200).json({
      most_booked_events: mostBookedEvents.rows,
      cancellation_rates: cancellationRates.rows,
      daily_booking_stats: dailyBookingStats.rows,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};
