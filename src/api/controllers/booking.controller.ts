import { Request, Response } from 'express';
import { pool } from '../../config/database';
import { redisClient } from '../../config/redis';
import { LockSeatsRequest, ConfirmBookingRequest, CancelBookingRequest, PaymentSimulateRequest, BookingWithDetails } from '../../models';

export const lockSeats = async (req: Request, res: Response) => {
  const { show_id, seat_ids }: LockSeatsRequest = req.body;
  const userId = (req as any).user.user_id;

  if (!seat_ids || seat_ids.length === 0) {
    return res.status(400).json({ message: 'At least one seat must be selected' });
  }

  const client = await pool.connect();
  const lockTimeout = 10 * 60; // 10 minutes in seconds

  try {
    await client.query('BEGIN');

    // Verify show exists
    const showResult = await client.query('SELECT show_id FROM shows WHERE show_id = $1', [show_id]);
    if (showResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Show not found' });
    }

    // CRITICAL FIX: Check database first with FOR UPDATE to prevent race conditions
    const seatStatusResult = await client.query(
      'SELECT seat_id, status FROM show_seats WHERE show_id = $1 AND seat_id = ANY($2) FOR UPDATE',
      [show_id, seat_ids]
    );

    // Check if all requested seats are available
    const unavailableSeats = seatStatusResult.rows.filter(row => row.status !== 'AVAILABLE');

    if (unavailableSeats.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        message: 'Some seats are no longer available', 
        failed_seats: unavailableSeats.map(row => row.seat_id)
      });
    }

    // For new seats, verify they exist in the seats table first
    const existingSeatIds = seatStatusResult.rows.map(row => row.seat_id);
    const newSeats = seat_ids.filter(seatId => !existingSeatIds.includes(seatId));

    if (newSeats.length > 0) {
      const validSeatsResult = await client.query(
        'SELECT seat_id FROM seats WHERE seat_id = ANY($1)',
        [newSeats]
      );
      
      const validNewSeats = validSeatsResult.rows.map(row => row.seat_id);
      const invalidSeats = newSeats.filter(id => !validNewSeats.includes(id));
      
      if (invalidSeats.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          message: 'Invalid seat IDs', 
          invalid_seats: invalidSeats 
        });
      }
    }

    const allAvailableSeats = [...seatStatusResult.rows.map(row => row.seat_id), ...newSeats];

    // Now acquire Redis locks for confirmed available seats
    const lockedSeats: number[] = [];
    const redisLockKeys: string[] = [];

    for (const seatId of allAvailableSeats) {
      const lockKey = `seat_lock:${show_id}:${seatId}`;
      
      // Try to acquire lock in Redis
      const lockResult = await redisClient.set(lockKey, userId, 'EX', lockTimeout, 'NX');
      
      if (lockResult === 'OK') {
        lockedSeats.push(seatId);
        redisLockKeys.push(lockKey);
      } else {
        // If Redis lock fails, we need to rollback everything
        // Release any locks we acquired
        for (const key of redisLockKeys) {
          await redisClient.del(key);
        }
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          message: 'Some seats are no longer available', 
          failed_seats: allAvailableSeats.filter(id => !lockedSeats.includes(id))
        });
      }
    }

    // Create booking record
    const bookingResult = await client.query(
      'INSERT INTO bookings (user_id, show_id, status) VALUES ($1, $2, $3) RETURNING booking_id',
      [userId, show_id, 'PENDING']
    );

    const bookingId = bookingResult.rows[0].booking_id;

    // Update show_seats table to mark seats as LOCKED (batch operation for efficiency)
    if (lockedSeats.length > 0) {
      const values = lockedSeats.map((seatId, index) => 
        `($1, $${index + 3}, 'LOCKED', $2, NOW())`
      ).join(',');
      
      const params = [show_id, bookingId, ...lockedSeats];
      
      await client.query(`
        INSERT INTO show_seats (show_id, seat_id, status, booking_id, locked_at)
        VALUES ${values}
        ON CONFLICT (show_id, seat_id)
        DO UPDATE SET 
          status = 'LOCKED',
          booking_id = $2,
          locked_at = NOW()
      `, params);
    }

    await client.query('COMMIT');

    // Get seat details for the response
    const seatDetailsResult = await client.query(`
      SELECT s.seat_id, s.seat_row, s.seat_number
      FROM seats s
      WHERE s.seat_id = ANY($1)
    `, [lockedSeats]);

    const seatDetails = seatDetailsResult.rows.map(row => ({
      seat_id: row.seat_id,
      seat_row: row.seat_row,
      seat_number: row.seat_number
    }));

    res.status(200).json({
      message: 'Seats locked successfully',
      booking_id: bookingId,
      locked_seats: seatDetails,
      expires_in: lockTimeout
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error locking seats:', error);
    res.status(500).json({ message: 'Failed to lock seats' });
  } finally {
    client.release();
  }
};

export const confirmBooking = async (req: Request, res: Response) => {
  const { booking_id }: ConfirmBookingRequest = req.body;
  const userId = (req as any).user.user_id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify booking exists and belongs to user
    const bookingResult = await client.query(
      'SELECT booking_id, show_id, status FROM bookings WHERE booking_id = $1 AND user_id = $2',
      [booking_id, userId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Booking is not in pending status' });
    }

    // Get locked seats for this booking with lock timestamp
    const seatsResult = await client.query(
      'SELECT seat_id, locked_at FROM show_seats WHERE booking_id = $1 AND status = $2',
      [booking_id, 'LOCKED']
    );

    if (seatsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'No locked seats found for this booking' });
    }

    // Check if any seats have expired (10 minute timeout)
    const lockTimeout = 10 * 60; // 10 minutes in seconds
    const now = new Date();
    const expiredSeats = seatsResult.rows.filter(seat => {
      const lockedAt = new Date(seat.locked_at);
      const lockExpiry = new Date(lockedAt.getTime() + lockTimeout * 1000);
      return now > lockExpiry;
    });

    if (expiredSeats.length > 0) {
      // Clean up expired locks
      const expiredSeatIds = expiredSeats.map(seat => seat.seat_id);
      
      // Update expired seats back to AVAILABLE
      await client.query(
        'UPDATE show_seats SET status = $1, booking_id = NULL, locked_at = NULL WHERE booking_id = $2 AND seat_id = ANY($3)',
        ['AVAILABLE', booking_id, expiredSeatIds]
      );
      
      // Release Redis locks for expired seats
      const expiredLockKeys = expiredSeats.map(seat => `seat_lock:${booking.show_id}:${seat.seat_id}`);
      if (expiredLockKeys.length > 0) {
        await redisClient.del(...expiredLockKeys);
      }
      
      // Update booking status to CANCELLED since locks expired
      await client.query(
        'UPDATE bookings SET status = $1 WHERE booking_id = $2',
        ['CANCELLED', booking_id]
      );
      
      await client.query('ROLLBACK');
      return res.status(410).json({ 
        message: 'Seat locks have expired. Booking has been cancelled.', 
        expired_seats: expiredSeatIds
      });
    }

    // Update booking status to CONFIRMED
    await client.query(
      'UPDATE bookings SET status = $1 WHERE booking_id = $2',
      ['CONFIRMED', booking_id]
    );

    // Update seat status to BOOKED
    await client.query(
      'UPDATE show_seats SET status = $1 WHERE booking_id = $2',
      ['BOOKED', booking_id]
    );

    // Release Redis locks (batch delete for efficiency)
    const lockKeys = seatsResult.rows.map(seat => `seat_lock:${booking.show_id}:${seat.seat_id}`);
    if (lockKeys.length > 0) {
      await redisClient.del(...lockKeys);
    }

    // Get seat details for the response
    const confirmedSeatsResult = await client.query(`
      SELECT s.seat_id, s.seat_row, s.seat_number
      FROM seats s
      JOIN show_seats ss ON s.seat_id = ss.seat_id
      WHERE ss.booking_id = $1
    `, [booking_id]);

    const confirmedSeats = confirmedSeatsResult.rows.map(row => ({
      seat_id: row.seat_id,
      seat_row: row.seat_row,
      seat_number: row.seat_number
    }));

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Booking confirmed successfully',
      booking_id: booking_id,
      confirmed_seats: confirmedSeats
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error confirming booking:', error);
    res.status(500).json({ message: 'Failed to confirm booking' });
  } finally {
    client.release();
  }
};

export const simulatePayment = async (req: Request, res: Response) => {
  const { booking_id, amount }: PaymentSimulateRequest = req.body;

  try {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate payment success (in real implementation, integrate with payment gateway)
    const paymentSuccess = Math.random() > 0.1; // 90% success rate

    if (paymentSuccess) {
      res.status(200).json({
        message: 'Payment successful',
        transaction_id: `txn_${Date.now()}`,
        amount: amount
      });
    } else {
      res.status(402).json({
        message: 'Payment failed',
        error: 'Insufficient funds'
      });
    }

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Payment processing failed' });
  }
};

export const cancelBooking = async (req: Request, res: Response) => {
  const { booking_id }: CancelBookingRequest = req.body;
  const userId = (req as any).user.user_id;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Verify booking exists and belongs to user
    const bookingResult = await client.query(
      'SELECT booking_id, show_id, status FROM bookings WHERE booking_id = $1 AND user_id = $2',
      [booking_id, userId]
    );

    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'CANCELLED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    // Get seats for this booking with details
    const seatsResult = await client.query(`
      SELECT s.seat_id, s.seat_row, s.seat_number
      FROM seats s
      JOIN show_seats ss ON s.seat_id = ss.seat_id
      WHERE ss.booking_id = $1
    `, [booking_id]);

    // Update booking status to CANCELLED
    await client.query(
      'UPDATE bookings SET status = $1 WHERE booking_id = $2',
      ['CANCELLED', booking_id]
    );

    // Release seats back to AVAILABLE
    await client.query(
      'UPDATE show_seats SET status = $1, booking_id = NULL, locked_at = NULL WHERE booking_id = $2',
      ['AVAILABLE', booking_id]
    );

    // Release Redis locks if any (batch delete for efficiency)
    const lockKeys = seatsResult.rows.map(seat => `seat_lock:${booking.show_id}:${seat.seat_id}`);
    if (lockKeys.length > 0) {
      await redisClient.del(...lockKeys);
    }

    const cancelledSeats = seatsResult.rows.map(row => ({
      seat_id: row.seat_id,
      seat_row: row.seat_row,
      seat_number: row.seat_number
    }));

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Booking cancelled successfully',
      booking_id: booking_id,
      cancelled_seats: cancelledSeats
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Failed to cancel booking' });
  } finally {
    client.release();
  }
};

export const getUserBookings = async (req: Request, res: Response) => {
  const userId = (req as any).user.user_id;

  try {
    const result = await pool.query(`
      SELECT 
        b.booking_id,
        b.status,
        b.created_at,
        s.show_id,
        s.start_time,
        s.end_time,
        s.price,
        e.title as event_title,
        v.venue_name,
        v.address,
        array_agg(
          json_build_object(
            'seat_id', st.seat_id,
            'seat_row', st.seat_row,
            'seat_number', st.seat_number
          )
        ) as seats
      FROM bookings b
      JOIN shows s ON b.show_id = s.show_id
      JOIN events e ON s.event_id = e.event_id
      JOIN venues v ON s.venue_id = v.venue_id
      LEFT JOIN show_seats ss ON b.booking_id = ss.booking_id
      LEFT JOIN seats st ON ss.seat_id = st.seat_id
      WHERE b.user_id = $1
      GROUP BY b.booking_id, s.show_id, e.title, v.venue_name, v.address
      ORDER BY b.created_at DESC
    `, [userId]);

    const bookings: BookingWithDetails[] = result.rows.map(row => ({
      booking_id: row.booking_id,
      user_id: userId,
      show_id: row.show_id,
      status: row.status,
      created_at: row.created_at,
      show: {
        show_id: row.show_id,
        event_id: 0, // Will be filled from join
        venue_id: 0, // Will be filled from join
        start_time: row.start_time,
        end_time: row.end_time,
        price: parseFloat(row.price),
        event: {
          event_id: 0,
          title: row.event_title
        },
        venue: {
          venue_id: 0,
          venue_name: row.venue_name,
          address: row.address
        },
        available_seats: 0,
        total_seats: 0
      },
      seats: (row.seats || []).map((seat: any) => ({
        seat_id: seat.seat_id,
        venue_id: 0, // Will be filled from join
        seat_row: seat.seat_row,
        seat_number: seat.seat_number,
        status: 'BOOKED' as const, // Seats in confirmed bookings are booked
        booking_id: row.booking_id
      }))
    }));

    res.status(200).json({ bookings });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
};
