// import { Request, Response, NextFunction } from 'express';
// import { waitingRoomQueue } from '../../config/queue';
// import { redisClient } from '../../config/redis';

// interface WaitingRoomRequest extends Request {
//   waitingRoomToken?: string;
// }

// export const virtualWaitingRoom = async (req: WaitingRoomRequest, res: Response, next: NextFunction) => {
//   // Skip waiting room for health checks and admin routes
//   if (req.path === '/health' || req.path.startsWith('/api/v1/admin')) {
//     return next();
//   }

//   try {
//     const clientId = req.ip || 'unknown';
//     const waitingRoomKey = `waiting_room:${clientId}`;
    
//     // Check if client is already in the waiting room
//     const existingToken = await redisClient.get(waitingRoomKey);
    
//     if (existingToken) {
//       // Client is in waiting room, check if they can proceed
//       const canProceed = await redisClient.get(`can_proceed:${existingToken}`);
      
//       if (canProceed) {
//         // Remove the token and allow request to proceed
//         await redisClient.del(waitingRoomKey);
//         await redisClient.del(`can_proceed:${existingToken}`);
//         req.waitingRoomToken = existingToken;
//         return next();
//       } else {
//         // Still in waiting room
//         return res.status(429).json({
//           message: 'Please wait, you are in the virtual waiting room',
//           estimated_wait_time: '2-5 minutes',
//           position: 'in_queue'
//         });
//       }
//     }

//     // Check current queue size
//     const queueSize = await waitingRoomQueue.getWaiting();
//     const maxConcurrentUsers = parseInt(process.env.MAX_CONCURRENT_USERS || '1000');
    
//     if (queueSize.length >= maxConcurrentUsers) {
//       // Add to waiting room queue
//       const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
//       await waitingRoomQueue.add('process-waiting-user', {
//         token,
//         clientId,
//         timestamp: Date.now()
//       }, {
//         delay: Math.random() * 30000, // Random delay up to 30 seconds
//         priority: Math.floor(Math.random() * 10) // Random priority
//       });

//       // Store token for this client
//       await redisClient.setex(waitingRoomKey, 600, token); // 10 minutes expiry

//       return res.status(429).json({
//         message: 'High traffic detected. You have been placed in the virtual waiting room.',
//         estimated_wait_time: '2-5 minutes',
//         position: 'in_queue',
//         token: token
//       });
//     }

//     // Allow request to proceed immediately
//     next();
//   } catch (error) {
//     console.error('Waiting room error:', error);
//     // If waiting room fails, allow request to proceed to avoid blocking users
//     next();
//   }
// };

// export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
//   const clientId = req.ip || 'unknown';
//   const rateLimitKey = `rate_limit:${clientId}`;
  
//   try {
//     const current = await redisClient.incr(rateLimitKey);
    
//     if (current === 1) {
//       await redisClient.expire(rateLimitKey, 60); // 1 minute window
//     }
    
//     const maxRequests = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60');
    
//     if (current > maxRequests) {
//       return res.status(429).json({
//         message: 'Too many requests. Please slow down.',
//         retry_after: 60
//       });
//     }
    
//     next();
//   } catch (error) {
//     console.error('Rate limiter error:', error);
//     next();
//   }
// };


import { Request, Response, NextFunction } from 'express';
import { waitingRoomQueue } from '../../config/queue';
import { redisClient } from '../../config/redis';

interface WaitingRoomRequest extends Request {
  waitingRoomToken?: string;
}

// Enhanced rate limiter with route-specific limits
export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const rateLimitKey = `rate_limit:${clientId}`;
  
  try {
    const current = await redisClient.incr(rateLimitKey);
    
    if (current === 1) {
      await redisClient.expire(rateLimitKey, 60); // 1 minute window
    }
    
    // Different limits for different route types
    let maxRequests = parseInt(process.env.RATE_LIMIT_PER_MINUTE || '60');
    
    // Lower limits for booking-related endpoints
    if (req.path.includes('/booking/') || req.path.includes('/lock') || req.path.includes('/confirm')) {
      maxRequests = 30; // More restrictive for booking operations
    }
    
    if (current > maxRequests) {
      return res.status(429).json({
        message: 'Too many requests. Please slow down.',
        retry_after: 60
      });
    }
    
    next();
  } catch (error) {
    console.error('Rate limiter error:', error);
    next();
  }
};

// NEW: Smart waiting room that only activates when needed
export const smartWaitingRoom = async (req: WaitingRoomRequest, res: Response, next: NextFunction) => {
  // Skip waiting room for health checks and admin routes
  if (req.path === '/health' || req.path.startsWith('/api/v1/admin')) {
    return next();
  }

  // Only apply waiting room to booking and show-related routes
  const isBookingRoute = req.path.includes('/booking/') || 
                        req.path.includes('/shows/') || 
                        req.path.includes('/lock') || 
                        req.path.includes('/confirm');
  
  if (!isBookingRoute) {
    return next();
  }

  try {
    const clientId = req.ip || 'unknown';
    
    // Extract show_id from various sources
    const showId = req.params.show_id || req.body.show_id || req.query.show_id;
    
    // If we have a show_id, check if this specific show is under high demand
    if (showId) {
      const shouldActivateWaitingRoom = await checkHighDemandShow(showId);
      if (!shouldActivateWaitingRoom) {
        return next(); // Skip waiting room for normal demand shows
      }
    } else {
      // For general booking routes without specific show_id, check overall system load
      const shouldActivateWaitingRoom = await checkSystemLoad();
      if (!shouldActivateWaitingRoom) {
        return next();
      }
    }

    // Existing waiting room logic (unchanged)
    const waitingRoomKey = `waiting_room:${clientId}`;
    const existingToken = await redisClient.get(waitingRoomKey);
    
    if (existingToken) {
      const canProceed = await redisClient.get(`can_proceed:${existingToken}`);
      
      if (canProceed) {
        await redisClient.del(waitingRoomKey);
        await redisClient.del(`can_proceed:${existingToken}`);
        req.waitingRoomToken = existingToken;
        return next();
      } else {
        return res.status(429).json({
          message: 'Please wait, you are in the virtual waiting room',
          estimated_wait_time: '1-3 minutes', // Reduced estimate
          position: 'in_queue'
        });
      }
    }

    // Check current queue size
    const queueSize = await waitingRoomQueue.getWaiting();
    const maxConcurrentUsers = parseInt(process.env.MAX_CONCURRENT_USERS || '500'); // Reduced default
    
    if (queueSize.length >= maxConcurrentUsers) {
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await waitingRoomQueue.add('process-waiting-user', {
        token,
        clientId,
        timestamp: Date.now()
      }, {
        delay: Math.random() * 15000 + 5000, // 5-20 seconds (reduced from 30s)
        priority: Math.floor(Math.random() * 10)
      });

      await redisClient.setex(waitingRoomKey, 300, token); // Reduced to 5 minutes

      return res.status(429).json({
        message: 'High traffic detected. You have been placed in the virtual waiting room.',
        estimated_wait_time: '1-3 minutes',
        position: 'in_queue',
        token: token
      });
    }

    next();
  } catch (error) {
    console.error('Waiting room error:', error);
    next();
  }
};

// Helper function to check if a specific show is under high demand
async function checkHighDemandShow(showId: string): Promise<boolean> {
  try {
    const demandKey = `show_demand:${showId}`;
    const currentDemand = await redisClient.get(demandKey) || '0';
    const demandCount = parseInt(currentDemand);
    
    // Activate waiting room if more than 50 requests for this show in last 5 minutes
    if (demandCount > 50) {
      console.log(`High demand detected for show ${showId}: ${demandCount} requests`);
      return true;
    }
    
    // Track this request
    await redisClient.multi()
      .incr(demandKey)
      .expire(demandKey, 300) // 5-minute sliding window
      .exec();
    
    return false;
  } catch (error) {
    console.error('Error checking show demand:', error);
    return false; // Default to not activating waiting room on error
  }
}

// Helper function to check overall system load
async function checkSystemLoad(): Promise<boolean> {
  try {
    const systemLoadKey = 'system_load';
    const currentLoad = await redisClient.get(systemLoadKey) || '0';
    const loadCount = parseInt(currentLoad);
    
    // Activate waiting room if more than 200 booking requests system-wide in last 2 minutes
    if (loadCount > 200) {
      console.log(`High system load detected: ${loadCount} booking requests`);
      return true;
    }
    
    await redisClient.multi()
      .incr(systemLoadKey)
      .expire(systemLoadKey, 120) // 2-minute sliding window
      .exec();
    
    return false;
  } catch (error) {
    console.error('Error checking system load:', error);
    return false;
  }
}

// DEPRECATED: Keep this for backward compatibility but don't use
export const virtualWaitingRoom = smartWaitingRoom;