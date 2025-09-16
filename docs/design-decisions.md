# Evently Backend - Design Decisions & Trade-offs

## Executive Summary

This document outlines the major design decisions, trade-offs, and architectural choices made in building the Evently backend system. The system is designed to handle high-concurrency booking scenarios while maintaining data consistency and providing excellent user experience.

## 1. Concurrency & Race Condition Handling

### **Decision: Dual-Layer Locking with Direct Processing**
**Approach**: PostgreSQL `FOR UPDATE` locks + Redis distributed locks with synchronous processing

**Rationale**:
- **No Message Queue for Bookings**: Direct processing provides immediate feedback to users
- **Dual-Layer Locking**: Database locks prevent race conditions, Redis locks provide distributed coordination
- **Seat-Level Granularity**: Individual seat locking prevents overselling at the finest level

**Trade-offs**:
- ✅ **Pros**: Immediate user feedback, prevents overselling, fine-grained locking, data consistency
- ❌ **Cons**: More complex locking logic
- 🔄 **Alternative Considered**: Message queue processing - rejected for poor user experience

### **Implementation Details**:
```sql
-- Atomic seat locking with row-level locking
SELECT seat_id, status FROM show_seats WHERE show_id = $1 AND seat_id = ANY($2) FOR UPDATE;
-- Combined with Redis distributed locks
SET seat_lock:${show_id}:${seat_id} ${user_id} EX 600 NX
```

## 2. Database Design & Modeling

### **Decision: Venue-Based Seat Management Architecture**
**Approach**: 7-table normalized design with individual seat tracking and show-based availability

**Rationale**:
- **Seat-Level Granularity**: Individual seats tracked for precise booking control
- **Venue Separation**: Events can have multiple shows at different venues
- **Junction Table**: `show_seats` manages seat availability per show with status tracking
- **ENUM Types**: Strong typing for statuses (booking_status, seat_status, user_role)

**Trade-offs**:
- ✅ **Pros**: Precise seat control, flexible venue management, strong data consistency
- ❌ **Cons**: More complex queries, higher storage overhead
- 🔄 **Alternative Considered**: Simple event capacity - rejected for lack of seat selection

### **Key Design Choices**:
- **Composite Primary Keys**: `show_seats(show_id, seat_id)` for efficient junction table operations
- **Status Tracking**: Seat states (AVAILABLE, LOCKED, BOOKED) with temporal locking
- **CASCADE DELETE**: Maintains referential integrity across all relationships
- **Strategic Indexes**: Optimized for seat selection and booking workflows

## 3. Scalability & Performance

### **Decision: Redis-Based State Management with Connection Pooling**
**Approach**: Redis for distributed locks and waiting room + PostgreSQL connection pooling

**Components**:
1. **Redis Distributed Locks**: Seat locking with 10-minute expiration
2. **Connection Pooling**: Efficient PostgreSQL connection management
3. **Strategic Indexes**: Optimized for seat selection queries
4. **Waiting Room**: Traffic throttling via Redis-backed queue

**Trade-offs**:
- ✅ **Pros**: Prevents overselling, handles concurrent access, efficient resource usage
- ❌ **Cons**: Redis dependency for core functionality, lock management complexity
- 🔄 **Alternative Considered**: Database-only locking - rejected for distributed coordination needs

### **Performance Optimizations**:
- **Seat Lock Caching**: Redis locks prevent double-booking without database hits
- **Connection Pooling**: Reuses PostgreSQL connections efficiently
- **Query Optimization**: Indexes on show_id, seat_id, booking_id for fast lookups
- **Batch Operations**: Multiple seat updates in single transactions

## 4. Queue System Design

### **Decision: Selective Queue Usage for Non-Blocking Operations**
**Approach**: Two queues - waiting room traffic throttling and cleanup automation

**Rationale**:
- **Waiting Room Queue**: Throttles traffic during high demand without blocking API
- **Cleanup Queue**: Automated expired booking cleanup via cron jobs
- **No Booking Queue**: Direct booking processing for immediate user feedback

**Trade-offs**:
- ✅ **Pros**: Immediate booking feedback, efficient traffic throttling, automated cleanup
- ❌ **Cons**: Higher API load during peaks, more complex direct processing
- 🔄 **Alternative Considered**: Queue all operations - rejected for poor user experience

### **Implementation Details**:
- **Waiting Room Queue**: `waiting-room-queue` with BullMQ, processes up to 10 users concurrently
- **Cleanup Queue**: `cleanup-queue` with BullMQ, runs cleanup jobs sequentially
- **Smart Waiting Room**: Only activates when queue size exceeds 500 concurrent users (configurable)
- **Cleanup Schedule**: Cron job runs every 2 minutes, not every minute as originally stated

### **Implementation Flow**:
1. **Waiting Room**: High traffic → Queue → Controlled access → Direct booking
2. **Cleanup**: Cron (every 2 min) → Queue job → Clean expired locks → Release seats

## 5. Authentication & Security

### **Decision: JWT + Role-based Access Control**
**Approach**: Stateless JWT tokens with role-based permissions

**Rationale**:
- **Stateless**: Enables horizontal scaling without session storage
- **Security**: JWT with expiration and role-based access
- **Performance**: No database lookups for authentication

**Trade-offs**:
- ✅ **Pros**: Scalable, secure, fast authentication
- ❌ **Cons**: Token revocation complexity, stateless nature
- 🔄 **Alternative Considered**: Session-based auth - rejected for scaling limitations

### **Security Features**:
- **Password Hashing**: Bcrypt with 10 salt rounds
- **Input Validation**: Comprehensive Joi schema validation on all endpoints
- **SQL Injection Prevention**: Parameterized queries throughout
- **CORS Configuration**: Controlled cross-origin access
- **Rate Limiting**: Route-specific rate limiting (60 req/min general, 30 req/min for booking operations)
- **Token Verification**: Database lookup on each request to verify user still exists
- **Role-based Access**: Admin middleware for protected admin routes

## 6. Error Handling & Resilience

### **Decision: Comprehensive Error Handling with Graceful Degradation**
**Approach**: Multi-level error handling with fallback mechanisms

**Components**:
1. **Input Validation**: Joi schema validation
2. **Database Transactions**: Atomic operations with rollback
3. **Queue Error Handling**: BullMQ retry mechanisms
4. **API Error Responses**: Consistent error format

**Trade-offs**:
- ✅ **Pros**: Robust error handling, graceful degradation, user-friendly messages
- ❌ **Cons**: Increased code complexity, multiple error handling paths
- 🔄 **Alternative Considered**: Simple error handling - rejected for production readiness

## 7. Lock Management & Cleanup

### **Decision: Automated Lock Cleanup with Cron Jobs**
**Approach**: Scheduled cleanup of expired bookings and Redis locks

**Rationale**:
- **Prevent Deadlocks**: Automatic cleanup of expired locks prevents system deadlocks
- **Resource Recovery**: Releases seats back to available pool automatically
- **Dual Cleanup**: Cleans both database state and Redis locks consistently

**Trade-offs**:
- ✅ **Pros**: Automatic resource recovery, prevents deadlocks, consistent state
- ❌ **Cons**: Additional background processing, potential race conditions
- 🔄 **Alternative Considered**: Manual cleanup - rejected for operational overhead

### **Implementation Details**:
- **Schedule**: Every 2 minutes via node-cron (not every minute as originally stated)
- **Timeout**: 10-minute expiration for pending bookings
- **Cleanup**: Atomically updates database and clears Redis locks
- **Queue-based**: Uses BullMQ cleanup queue for reliable job processing
- **Concurrency**: Single cleanup job at a time to prevent race conditions

## 8. Deployment & Infrastructure

### **Decision: Managed Services for Database and Redis**
**Approach**: Neon PostgreSQL + Render Valkey for data persistence and caching

**Rationale**:
- **Neon PostgreSQL**: Serverless PostgreSQL with automatic scaling and branching
- **Render Valkey**: Managed Redis-compatible service for locks and queues
- **Simplified Architecture**: Only two external dependencies for easier management
- **Connection Pooling**: PostgreSQL connection pooling for efficient resource usage

**Trade-offs**:
- ✅ **Pros**: Minimal operational overhead, automatic scaling, managed backups
- ❌ **Cons**: Vendor lock-in for database, limited Redis configuration control
- 🔄 **Alternative Considered**: Self-hosted - rejected for operational complexity

## 9. API Design

### **Decision: RESTful API with Clear Resource Modeling**
**Approach**: Resource-based URLs with proper HTTP methods

**Design Principles**:
- **RESTful**: Clear resource modeling and HTTP semantics
- **Consistent**: Uniform response formats and error handling
- **Documented**: Comprehensive Swagger/OpenAPI documentation
- **Versioned**: API versioned at `/api/v1/`

**Trade-offs**:
- ✅ **Pros**: Standard conventions, easy to understand, tool-friendly
- ❌ **Cons**: Some operations don't fit REST perfectly
- 🔄 **Alternative Considered**: GraphQL - rejected for complexity vs. benefits

## 10. Middleware Architecture

### **Decision: Layered Middleware with Smart Traffic Management**
**Approach**: Multiple middleware layers for different concerns

**Implementation**:
- **Rate Limiting**: Route-specific limits (60 req/min general, 30 req/min booking)
- **Smart Waiting Room**: Only activates when queue exceeds 500 concurrent users
- **Authentication**: JWT verification with database user validation
- **Validation**: Comprehensive Joi schema validation on all endpoints
- **Error Handling**: Graceful degradation with consistent error responses

**Trade-offs**:
- ✅ **Pros**: Comprehensive protection, smart resource management, good UX
- ❌ **Cons**: Multiple middleware layers, potential performance overhead
- 🔄 **Alternative Considered**: Simple middleware - rejected for production needs

## Future Considerations

### **Potential Improvements**:
1. **Microservices**: Split into domain-specific services
2. **Event Sourcing**: For audit trails and complex business logic
3. **CQRS**: Separate read/write models for better performance
4. **Real-time Updates**: WebSocket connections for live updates
5. **Advanced Caching**: Multi-level caching strategies
6. **Monitoring**: Comprehensive observability and alerting

### **Scaling Strategies**:
1. **Database Sharding**: By event or user for very large scale
2. **Read Replicas**: For analytics and reporting workloads
3. **CDN**: For static content and API responses
4. **Load Balancing**: Multiple API instances with health checks

## Conclusion

The Evently backend system successfully balances correctness, performance, and user experience through careful architectural decisions. The combination of dual-layer locking (PostgreSQL + Redis), direct booking processing, smart queue usage, and managed services provides a robust foundation for handling high-concurrency seat booking scenarios while maintaining data consistency.

**Key Implementation Highlights**:
- **Dual-Layer Locking**: PostgreSQL `FOR UPDATE` + Redis distributed locks prevent race conditions
- **Smart Waiting Room**: Only activates when needed (500+ concurrent users), uses BullMQ for processing
- **Automated Cleanup**: Cron-scheduled cleanup every 2 minutes via BullMQ queue
- **Comprehensive Security**: JWT auth, rate limiting, input validation, and role-based access
- **Layered Middleware**: Rate limiting, waiting room, authentication, and validation layers

The system prioritizes immediate user feedback through synchronous booking processing while using queues strategically for traffic throttling and automated maintenance. The venue-based seat management architecture provides precise control over bookings with automatic lock cleanup ensuring system reliability.
