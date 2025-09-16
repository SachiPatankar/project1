/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Clear existing demo data (in reverse dependency order)
  pgm.sql('DELETE FROM show_seats');
  pgm.sql('DELETE FROM bookings');
  pgm.sql('DELETE FROM shows');
  pgm.sql('DELETE FROM events');
  pgm.sql('DELETE FROM seats');
  pgm.sql('DELETE FROM venues');
  pgm.sql('DELETE FROM users WHERE role = \'user\''); // Keep admin user

  // Reset sequences
  pgm.sql('ALTER SEQUENCE users_user_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE venues_venue_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE seats_seat_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE events_event_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE shows_show_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE bookings_booking_id_seq RESTART WITH 1');

  // Create demo venues
  pgm.sql(`
    INSERT INTO venues (venue_name, address) VALUES
    ('Grand Cinema Hall', '123 Movie Lane, Downtown'),
    ('Cityplex Theater', '456 Silver Screen Avenue, Uptown')
  `);

  // Create seats for Venue 1 (Grand Cinema Hall): 3 rows, 5 seats each
  pgm.sql(`
    INSERT INTO seats (venue_id, seat_row, seat_number) VALUES
    (1, 'A', 1), (1, 'A', 2), (1, 'A', 3), (1, 'A', 4), (1, 'A', 5),
    (1, 'B', 1), (1, 'B', 2), (1, 'B', 3), (1, 'B', 4), (1, 'B', 5),
    (1, 'C', 1), (1, 'C', 2), (1, 'C', 3), (1, 'C', 4), (1, 'C', 5)
  `);

  // Create seats for Venue 2 (Cityplex Theater): 2 rows, 10 seats each
  pgm.sql(`
    INSERT INTO seats (venue_id, seat_row, seat_number) VALUES
    (2, 'A', 1), (2, 'A', 2), (2, 'A', 3), (2, 'A', 4), (2, 'A', 5), (2, 'A', 6), (2, 'A', 7), (2, 'A', 8), (2, 'A', 9), (2, 'A', 10),
    (2, 'B', 1), (2, 'B', 2), (2, 'B', 3), (2, 'B', 4), (2, 'B', 5), (2, 'B', 6), (2, 'B', 7), (2, 'B', 8), (2, 'B', 9), (2, 'B', 10)
  `);

  // Create demo events
  pgm.sql(`
    INSERT INTO events (title) VALUES
    ('Galactic Odyssey'),
    ('Echoes of Time'),
    ('Midnight Serenade')
  `);

  // Create demo shows (using future dates)
  pgm.sql(`
    INSERT INTO shows (event_id, venue_id, start_time, end_time, price) VALUES
    (1, 1, '2025-09-20T20:00:00+05:30', '2025-09-20T22:30:00+05:30', 450.00),
    (2, 1, '2025-09-20T23:00:00+05:30', '2025-09-21T01:15:00+05:30', 400.00),
    (3, 2, '2025-09-21T21:00:00+05:30', '2025-09-21T23:00:00+05:30', 380.00),
    (1, 2, '2025-09-22T14:00:00+05:30', '2025-09-22T16:30:00+05:30', 350.00)
  `);

  // Create show_seats for all shows
  pgm.sql(`
    INSERT INTO show_seats (show_id, seat_id, status)
    SELECT 1, seat_id, 'AVAILABLE' FROM seats WHERE venue_id = 1
  `);
  
  pgm.sql(`
    INSERT INTO show_seats (show_id, seat_id, status)
    SELECT 2, seat_id, 'AVAILABLE' FROM seats WHERE venue_id = 1
  `);
  
  pgm.sql(`
    INSERT INTO show_seats (show_id, seat_id, status)
    SELECT 3, seat_id, 'AVAILABLE' FROM seats WHERE venue_id = 2
  `);
  
  pgm.sql(`
    INSERT INTO show_seats (show_id, seat_id, status)
    SELECT 4, seat_id, 'AVAILABLE' FROM seats WHERE venue_id = 2
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Remove demo data (in reverse dependency order)
  pgm.sql('DELETE FROM show_seats');
  pgm.sql('DELETE FROM bookings');
  pgm.sql('DELETE FROM shows');
  pgm.sql('DELETE FROM events');
  pgm.sql('DELETE FROM seats');
  pgm.sql('DELETE FROM venues');
  pgm.sql('DELETE FROM users WHERE role = \'user\''); // Keep admin user

  // Reset sequences
  pgm.sql('ALTER SEQUENCE users_user_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE venues_venue_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE seats_seat_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE events_event_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE shows_show_id_seq RESTART WITH 1');
  pgm.sql('ALTER SEQUENCE bookings_booking_id_seq RESTART WITH 1');
};
