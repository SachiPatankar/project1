# Evently Backend Tests

This directory contains comprehensive tests for the Evently backend API, including concurrent booking scenarios, waiting room functionality, and rate limiting.

## Test Structure

- `setup.ts` - Global test setup, teardown, and database migration management
- `evently.test.ts` - Main test suite covering all API endpoints and advanced scenarios
- `jest-setup.ts` - Jest configuration setup
- `README.md` - This documentation file

## Test Coverage

The test suite covers:

1. **Authentication Setup**
   - User registration for multiple test users
   - JWT token generation and validation
   - User role management

2. **Event Controller GET Endpoints**
   - Get all shows
   - Get show by ID with detailed information
   - Handle 404 for non-existent shows
   - Search shows by venue name
   - Search shows by event name
   - Filter shows with available seats only
   - Get show seats with availability status

3. **Complete Booking Flow**
   - Lock seats with timeout mechanism
   - Simulate payment processing
   - Confirm booking after successful payment
   - Get user bookings history
   - Handle booking failures and rollbacks

4. **Overlapping Seat Booking Test**
   - Test concurrent seat booking by 3 users with overlapping seat selections
   - Verify seat locking mechanism prevents double booking
   - Test payment simulation with different outcomes
   - Validate final booking status and seat assignments
   - Log detailed booking results for debugging

5. **True Concurrent Booking Test**
   - Simulate simultaneous seat booking attempts using Promise.all
   - Test race condition handling in seat reservation
   - Verify only one user can successfully book contested seats
   - Test system behavior under high concurrency

6. **Waiting Room Load Test**
   - Test virtual waiting room activation under high load
   - Verify waiting room token generation and management
   - Test user queue processing and release mechanism
   - Handle multiple users in waiting room queue simultaneously

7. **Rate Limiting Test**
   - Test rate limiting for booking operations
   - Verify different rate limits for different endpoint types
   - Test rate limit reset and recovery

## Prerequisites

1. **Database Setup**
   - PostgreSQL database running
   - Test database created (e.g., `evently_test`)
   - **No manual schema setup required** - migrations run automatically during test setup

2. **Redis Setup**
   - Redis server running (local or cloud instance)
   - Accessible via REDIS_URL configuration

3. **Environment Configuration**
   - Copy `env.test.example` to `.env.test`
   - Configure database and Redis connection strings
   - Set JWT secret and other required environment variables

4. **Node.js Dependencies**
   - Node.js 16+ installed
   - All npm dependencies installed (`npm install`)

## Running Tests

### Setup Environment

1. Copy the test environment file:
   ```bash
   cp env.test.example .env.test
   ```

2. Update `.env.test` with your test database and Redis configuration:
   ```env
   # Database Configuration
   DATABASE_URL="postgresql://username:password@host:port/evently_test?sslmode=require"
   
   # Redis Configuration  
   REDIS_URL="redis://username:password@host:port"
   
   # Server Configuration
   PORT=3000
   ```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# After tests optionally can clean database by
npm run db:migrate:down:test
```

## Test Data & Database Management

The tests automatically:
1. **Run database migrations** using `npm run db:migrate:up:test` before tests start
2. **Create demo data** from the second migration (venues, events, shows, seats)
3. **Register test users** dynamically during authentication setup
4. **Clear Redis cache** between test cases to ensure isolation
5. **Clean up connections** after tests complete (database and Redis)

## Test Scenarios

### 1. Overlapping Seat Booking Test

Simulates a realistic scenario where 3 users try to book overlapping seats:

- **User 1**: Attempts to book seats 1A, 1B
- **User 2**: Attempts to book seats 1B, 1C (overlaps with User 1)  
- **User 3**: Attempts to book seats 1A, 1B, 1C (overlaps with both users)

**Verifies:**
- Seat locking mechanism prevents double booking
- Payment simulation with different outcomes (success/failure)
- Proper booking confirmation process
- Final seat status accurately reflects actual bookings
- Detailed logging of each user's booking journey

### 2. True Concurrent Booking Test

Tests real concurrency using `Promise.all()` to simulate simultaneous requests:

- **Multiple users** attempt to book the same seats simultaneously
- **Race condition handling** ensures only one user succeeds
- **System stability** under high concurrency load
- **Proper error handling** for failed booking attempts

### 3. Waiting Room Load Test

Tests the virtual waiting room system:

- **High load simulation** to trigger waiting room activation
- **Token generation** and queue management
- **User processing** and release from waiting room
- **Multiple users** in queue with proper ordering
- **System behavior** when waiting room is active vs inactive

### 4. Rate Limiting Test

Tests the rate limiting middleware:

- **Different rate limits** for booking vs general endpoints
- **Rate limit enforcement** and proper HTTP 429 responses
- **Rate limit reset** after time window expires
- **System protection** against abuse and DoS attacks

## Expected Output

The tests provide detailed console output including:

- **🚀 Test environment setup** with migration progress
- **🔑 User registration** with token generation logs
- **📊 API endpoint responses** with detailed request/response data
- **🎫 Booking flow steps** showing lock → payment → confirmation
- **💳 Payment simulation results** with success/failure outcomes
- **👥 Concurrent booking results** showing which user succeeded
- **⏳ Waiting room activation** and queue processing logs
- **🚦 Rate limiting** enforcement and recovery
- **📋 Final seat status** and booking summaries
- **✅ Test cleanup** and connection closure

## Available Test Scripts

```bash
# Run all tests with standard output
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Verify test setup (database/Redis connections)
npm run test:setup
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify PostgreSQL server is running
   - Check `DATABASE_URL` in `.env.test`
   - Ensure test database exists and is accessible
   - Verify database user has proper permissions

2. **Redis Connection Error**
   - Verify Redis server is running (local or cloud)
   - Check `REDIS_URL` format in `.env.test`
   - Test Redis connection manually if needed

3. **Migration Errors**
   - Ensure `node-pg-migrate` is installed
   - Check migration files in `migrations/` directory
   - Verify database user has CREATE/DROP permissions

4. **Test Timeouts**
   - Default timeout is 60 seconds for cleanup
   - Individual tests have 30-second timeouts
   - Increase timeouts in `jest.config.js` if needed for slower systems

5. **Port Conflicts**
   - Tests don't start a server (use supertest directly)
   - If port issues occur, check for running processes on test ports

### Debug Mode

Run tests with verbose output and debugging:
```bash
# Verbose Jest output
npm test -- --verbose

# Run specific test file
npm test -- evently.test.ts

# Run specific test case
npm test -- --testNamePattern="should handle overlapping seat bookings"
```

## Test Environment Isolation

Each test run ensures complete isolation:

- **🔄 Database migrations** run fresh before each test session
- **🧹 Redis cache cleared** between individual test cases  
- **👤 Dynamic user creation** prevents user conflicts
- **🔐 Separate JWT tokens** for each test user
- **💾 Connection cleanup** after all tests complete
- **⏱️ Timeout handling** prevents hanging processes

This ensures tests are completely independent and can be run in any order.
