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
  // Create custom ENUM types (with conditional creation)
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('user', 'admin');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  pgm.sql(`
    DO $$ BEGIN
      CREATE TYPE seat_status AS ENUM ('AVAILABLE', 'LOCKED', 'BOOKED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create tables (if not exists)
  pgm.createTable('users', {
    user_id: {
      type: 'serial',
      primaryKey: true,
    },
    email: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    password: {
      type: 'varchar(255)',
      notNull: true,
    },
    role: {
      type: 'user_role',
      default: 'user',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createTable('venues', {
    venue_id: {
      type: 'serial',
      primaryKey: true,
    },
    venue_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    address: {
      type: 'text',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createTable('seats', {
    seat_id: {
      type: 'serial',
      primaryKey: true,
    },
    venue_id: {
      type: 'integer',
      notNull: true,
      references: 'venues(venue_id)',
      onDelete: 'CASCADE',
    },
    seat_row: {
      type: 'char(2)',
      notNull: true,
    },
    seat_number: {
      type: 'integer',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createTable('events', {
    event_id: {
      type: 'serial',
      primaryKey: true,
    },
    title: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createTable('shows', {
    show_id: {
      type: 'serial',
      primaryKey: true,
    },
    event_id: {
      type: 'integer',
      notNull: true,
      references: 'events(event_id)',
      onDelete: 'CASCADE',
    },
    venue_id: {
      type: 'integer',
      notNull: true,
      references: 'venues(venue_id)',
      onDelete: 'CASCADE',
    },
    start_time: {
      type: 'timestamptz',
      notNull: true,
    },
    end_time: {
      type: 'timestamptz',
      notNull: true,
    },
    price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createTable('bookings', {
    booking_id: {
      type: 'serial',
      primaryKey: true,
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users(user_id)',
      onDelete: 'CASCADE',
    },
    show_id: {
      type: 'integer',
      notNull: true,
      references: 'shows(show_id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'booking_status',
      default: 'PENDING',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  }, { ifNotExists: true });

  pgm.createTable('show_seats', {
    show_id: {
      type: 'integer',
      notNull: true,
      references: 'shows(show_id)',
      onDelete: 'CASCADE',
    },
    seat_id: {
      type: 'integer',
      notNull: true,
      references: 'seats(seat_id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'seat_status',
      default: 'AVAILABLE',
      notNull: true,
    },
    booking_id: {
      type: 'integer',
      references: 'bookings(booking_id)',
      onDelete: 'SET NULL',
    },
    locked_at: {
      type: 'timestamptz',
    },
  }, { ifNotExists: true });

  // Add unique constraint for seats
  pgm.addConstraint('seats', 'seats_venue_row_number_unique', {
    unique: ['venue_id', 'seat_row', 'seat_number'],
  }, { ifNotExists: true });

  // Add primary key constraint for show_seats
  pgm.addConstraint('show_seats', 'show_seats_pkey', {
    primaryKey: ['show_id', 'seat_id'],
  }, { ifNotExists: true });

  // Create indexes for performance
  pgm.createIndex('show_seats', 'show_id', { name: 'idx_show_seats_show_id' }, { ifNotExists: true });
  pgm.createIndex('show_seats', 'seat_id', { name: 'idx_show_seats_seat_id' }, { ifNotExists: true });
  pgm.createIndex('show_seats', 'status', { name: 'idx_show_seats_status' }, { ifNotExists: true });
  pgm.createIndex('show_seats', 'booking_id', { name: 'idx_show_seats_booking_id' }, { ifNotExists: true });
  pgm.createIndex('bookings', 'user_id', { name: 'idx_bookings_user_id' }, { ifNotExists: true });
  pgm.createIndex('bookings', 'show_id', { name: 'idx_bookings_show_id' }, { ifNotExists: true });
  pgm.createIndex('bookings', 'status', { name: 'idx_bookings_status' }, { ifNotExists: true });
  pgm.createIndex('seats', 'venue_id', { name: 'idx_seats_venue_id' }, { ifNotExists: true });
  pgm.createIndex('shows', 'event_id', { name: 'idx_shows_event_id' }, { ifNotExists: true });
  pgm.createIndex('shows', 'venue_id', { name: 'idx_shows_venue_id' }, { ifNotExists: true });
  pgm.createIndex('shows', 'start_time', { name: 'idx_shows_start_time' }, { ifNotExists: true });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  // Drop indexes
  pgm.dropIndex('shows', 'start_time', { name: 'idx_shows_start_time' });
  pgm.dropIndex('shows', 'venue_id', { name: 'idx_shows_venue_id' });
  pgm.dropIndex('shows', 'event_id', { name: 'idx_shows_event_id' });
  pgm.dropIndex('seats', 'venue_id', { name: 'idx_seats_venue_id' });
  pgm.dropIndex('bookings', 'status', { name: 'idx_bookings_status' });
  pgm.dropIndex('bookings', 'show_id', { name: 'idx_bookings_show_id' });
  pgm.dropIndex('bookings', 'user_id', { name: 'idx_bookings_user_id' });
  pgm.dropIndex('show_seats', 'booking_id', { name: 'idx_show_seats_booking_id' });
  pgm.dropIndex('show_seats', 'status', { name: 'idx_show_seats_status' });
  pgm.dropIndex('show_seats', 'seat_id', { name: 'idx_show_seats_seat_id' });
  pgm.dropIndex('show_seats', 'show_id', { name: 'idx_show_seats_show_id' });

  // Drop tables in reverse dependency order
  pgm.dropTable('show_seats');
  pgm.dropTable('bookings');
  pgm.dropTable('shows');
  pgm.dropTable('events');
  pgm.dropTable('seats');
  pgm.dropTable('venues');
  pgm.dropTable('users');

  // Drop ENUM types
  pgm.sql('DROP TYPE IF EXISTS seat_status');
  pgm.sql('DROP TYPE IF EXISTS booking_status');
  pgm.sql('DROP TYPE IF EXISTS user_role');
};
