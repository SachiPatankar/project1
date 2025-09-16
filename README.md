# Evently Backend

A high-performance, venue-based seat booking system with dual-layer locking (PostgreSQL + Redis) designed to handle concurrent seat reservations with zero overselling and virtual waiting room for traffic management.


### Deployment Link: https://evently-magb.onrender.com

## Features

- **Venue-Based Seat Management**: Individual seat tracking with row/number identification per venue
- **Dual-Layer Locking**: PostgreSQL `FOR UPDATE` + Redis distributed locks for bulletproof concurrency
- **Virtual Waiting Room**: BullMQ queue system to throttle traffic during high demand
- **Automated Lock Cleanup**: Cron-based cleanup of expired bookings every 2 minutes
- **Direct Booking Processing**: Synchronous booking for immediate user feedback
- **JWT Authentication**: Stateless authentication with user/admin role-based access
- **Complete Venue Management**: Full CRUD operations for venues, events, shows, and seats
- **Analytics**: Supports analytics: most-booked events, cancellation rates, and daily booking stats.
- **Payment Simulation**: Mock payment processing for testing booking flow
- **Health Monitoring**: Comprehensive health checks and schema validation endpoints

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Neon PostgreSQL (Serverless managed database)
- **Cache & Locks**: Render Valkey (Redis-compatible service for distributed locking)
- **Queue System**: BullMQ (for waiting room and cleanup jobs only)
- **Validation**: Joi schema validation
- **Authentication**: JWT with bcryptjs hashing
- **Cron Jobs**: node-cron for automated cleanup
- **Deployment**: Designed for Render deployment

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Neon PostgreSQL database instance
- Render Valkey Redis-compatible instance

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd evently-backend

# Install dependencies
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory with the following variables essentially:

```env
# Database connection string
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Redis connection URL
REDIS_URL="redis://username:password@host:port"

# Server configuration
PORT=3000

# JWT Configuration
JWT_SECRET="your_super_secret_jwt_key_here"
```

Copy `env.example` to `.env` and update the values according to your setup.

### 4. Database Schema Setup

The application uses **node-pg-migrate** for database migrations. Can run migrations independently if required, otherwise, server startup has them included:

```bash
  # to setup demo db
 npm db:migrate:up:test
 # to teardown demo db
 npm db:migrate:down:test

 # to initialize prod db schema
 npm db:initialize:prod
 # to teardown prod db schema
 npm db:initialize:down:prod
 # to setup prod db schema + demo data
 npm db:setup-demo:prod
  # to remove demo data from prod db
 npm db:setup-demo:down:prod
```

**Schema includes:**
- ✅ 7-table venue-based seat management schema
- ✅ ENUM types for booking/seat/user statuses
- ✅ Composite primary keys and foreign key constraints
- ✅ Strategic indexes for optimal query performance

### 5. Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Authentication Routes
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login

### Search/Discover Routes (Public)
- `GET /api/v1/shows` - Get all upcoming shows
- `GET /api/v1/shows/{show_id}` - Get show by ID
- `GET /api/v1/shows/search` - Search shows by venue, event, time range or availability
- `GET /api/v1/shows/{show_id}/seats` - Get all seats for a specific show

### Booking Routes (User Authenticated)
- `POST /api/v1/bookings/lock` - Lock seats for booking
- `POST /api/v1/bookings/{booking_id}/confirm` - Confirm booking after payment
- `POST /api/v1/bookings/payments/simulate` - Simulate payment processing
- `POST /api/v1/bookings/{booking_id}/cancel` - Cancel booking

### User Routes (User Authenticated)
- `GET /api/v1/user/bookings` - Get user's bookings

### Admin Routes (Admin Role Authenticated)

#### Venue Management
- `POST /api/v1/admin/venues` - Create venue
- `PUT /api/v1/admin/venues/{venue_id}` - Update venue
- `DELETE /api/v1/admin/venues/{venue_id}` - Delete venue

#### Event Management
- `POST /api/v1/admin/events` - Create event
- `PUT /api/v1/admin/events/{event_id}` - Update event
- `DELETE /api/v1/admin/events/{event_id}` - Delete event

#### Show Management
- `POST /api/v1/admin/shows` - Create show
- `PUT /api/v1/admin/shows/{show_id}` - Update show
- `DELETE /api/v1/admin/shows/{show_id}` - Delete show

#### Analytics & Insights
- `GET /api/v1/admin/analytics` - Get comprehensive analytics dashboard


### System Routes (Public)
- `GET /health` - Server health status

### API Documentation
- `GET /api-docs` - Interactive Swagger UI documentation

## Architecture

### System Design
The system uses dual-layer locking with direct processing for immediate user feedback:

```
[Users] → [Virtual Waiting Room] → [API Server] → [PostgreSQL + Redis]
                                       ↕
                              [Dual-Layer Locking]
```

### Virtual Waiting Room
- **Purpose**: Throttles traffic during high demand to prevent system overload
- **Implementation**: BullMQ waiting room queue with controlled access
- **Behavior**: Users wait in queue during traffic spikes, then get direct booking access

### Dual-Layer Locking Flow
1. **Show Browsing**: User requests available shows
2. **Seat Selection**: User selects specific seats from venue layout
3. **Database Lock**: PostgreSQL `FOR UPDATE` prevents race conditions
4. **Redis Lock**: Distributed locks with 10-minute TTL prevent double-booking
5. **Direct Processing**: Immediate booking confirmation with atomic transactions
6. **Lock Release**: Both database and Redis locks released on completion

### Concurrency Control
- **PostgreSQL Locks**: `FOR UPDATE` on show_seats table for atomic operations
- **Redis Locks**: `seat_lock:{show_id}:{seat_id}` with automatic expiration
- **Atomic Transactions**: All seat operations wrapped in database transactions

### Automated Cleanup
- **Purpose**: Prevents deadlocks and releases abandoned seat reservations
- **Schedule**: Cron job runs every 2 minutes
- **Process**: Cleans expired PENDING bookings and releases both DB and Redis locks

## Development

### Project Structure

```
src/
├── api/
│   ├── routes/          # API route definitions
│   ├── controllers/     # Business logic for booking, events, admin
│   └── middlewares/     # Authentication, validation, waiting room
├── config/              # Database, Redis, queue, and schema configuration
├── models/              # TypeScript type definitions and interfaces
├── workers/             # Background workers (waiting room, cleanup)
└── index.ts            # Application entry point with worker initialization
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server

## Documentation

- **[Interactive API Docs](http://localhost:3000/api-docs)** - Swagger UI with live API testing
- **[Architecture Diagram](docs/architecture-diagram.md)** - High-level system architecture
- **[ER Diagram](docs/er-diagram.md)** - Database entity relationships
- **[Design Decisions](docs/design-decisions.md)** - Architectural choices and trade-offs

## Deployment

The application is designed to be deployed on Render:

1. Connect your GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy as a web service
4. Ensure your Neon and Valkey services are accessible

## API Documentation with Swagger

The Evently backend includes comprehensive Swagger/OpenAPI documentation:

### **Interactive Documentation**
- **URL**: `http://localhost:3000/api-docs`
- **Features**: 
  - Interactive API testing
  - Request/response examples
  - Authentication testing
  - Schema validation

### **Documentation Features**
- **Complete API Coverage**: All endpoints documented
- **Authentication**: JWT bearer token support
- **Request/Response Schemas**: Detailed data models
- **Error Handling**: Comprehensive error responses
- **Examples**: Real-world usage examples

### **Usage**
1. Start the server: `npm run dev`
2. Open browser: `http://localhost:3000/api-docs`
3. Click "Authorize" to add JWT token
4. Test endpoints directly from the UI

## Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Role-based access control
- SQL injection prevention with parameterized queries
- CORS configuration

## Performance Optimizations

- PostgreSQL connection pooling for efficient resource management
- Redis distributed locks for seat-level concurrency control
- Strategic database indexes on show_id, seat_id, booking_id
- Atomic database transactions for data consistency
- Automated cleanup prevents resource leaks and deadlocks
- Direct booking processing for immediate user feedback
