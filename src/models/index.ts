// Core Database Models
export interface User {
  user_id: number;
  email: string;
  password: string;
  role: 'user' | 'admin';
  created_at?: Date;
}

export interface Venue {
  venue_id: number;
  venue_name: string;
  address: string;
  created_at?: Date;
}

export interface Seat {
  seat_id: number;
  venue_id: number;
  seat_row: string;
  seat_number: number;
  created_at?: Date;
}

export interface Event {
  event_id: number;
  title: string;
  created_at?: Date;
}

export interface Show {
  show_id: number;
  event_id: number;
  venue_id: number;
  start_time: Date;
  end_time: Date;
  price: number;
  created_at?: Date;
}

export interface Booking {
  booking_id: number;
  user_id: number;
  show_id: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  created_at?: Date;
}

export interface ShowSeat {
  show_id: number;
  seat_id: number;
  status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
  booking_id?: number;
  locked_at?: Date;
}

// Request/Response types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

export interface LockSeatsRequest {
  show_id: number;
  seat_ids: number[];
}

export interface ConfirmBookingRequest {
  booking_id: number;
}

export interface CancelBookingRequest {
  booking_id: number;
}

export interface PaymentSimulateRequest {
  booking_id: number;
  amount: number;
}

// Admin Request types
export interface CreateVenueRequest {
  venue_name: string;
  address: string;
}

export interface UpdateVenueRequest {
  venue_name?: string;
  address?: string;
}

export interface CreateEventRequest {
  title: string;
}

export interface UpdateEventRequest {
  title?: string;
}

export interface CreateShowRequest {
  event_id: number;
  venue_id: number;
  start_time: string;
  end_time: string;
  price: number;
}

export interface UpdateShowRequest {
  event_id?: number;
  venue_id?: number;
  start_time?: string;
  end_time?: string;
  price?: number;
}

export interface BulkAddSeatsRequest {
  seats: Array<{
    seat_row: string;
    seat_number: number;
  }>;
}

export interface BulkDeleteSeatsRequest {
  seats: Array<{
    seat_row: string;
    seat_number: number;
  }>;
}

// Response types
export interface ShowWithDetails extends Show {
  event: Event;
  venue: Venue;
  available_seats: number;
  total_seats: number;
}

export interface SeatWithStatus extends Seat {
  status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
  booking_id?: number;
}

export interface BookingWithDetails extends Booking {
  show: ShowWithDetails;
  seats: SeatWithStatus[];
}
