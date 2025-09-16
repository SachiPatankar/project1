import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'admin').optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const lockSeatsSchema = Joi.object({
  show_id: Joi.number().integer().positive().required(),
  seat_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required()
});

const confirmBookingSchema = Joi.object({
  booking_id: Joi.number().integer().positive().required()
});

const cancelBookingSchema = Joi.object({
  booking_id: Joi.number().integer().positive().required()
});

const paymentSimulateSchema = Joi.object({
  booking_id: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required()
});

// Admin schemas
const createVenueSchema = Joi.object({
  venue_name: Joi.string().min(1).max(255).required(),
  address: Joi.string().min(1).required()
});

const updateVenueSchema = Joi.object({
  venue_name: Joi.string().min(1).max(255).optional(),
  address: Joi.string().min(1).optional()
});

const createEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).required()
});

const updateEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).optional()
});

const createShowSchema = Joi.object({
  event_id: Joi.number().integer().positive().required(),
  venue_id: Joi.number().integer().positive().required(),
  start_time: Joi.string().isoDate().required(),
  end_time: Joi.string().isoDate().required(),
  price: Joi.number().positive().required()
});

const updateShowSchema = Joi.object({
  event_id: Joi.number().integer().positive().optional(),
  venue_id: Joi.number().integer().positive().optional(),
  start_time: Joi.string().isoDate().optional(),
  end_time: Joi.string().isoDate().optional(),
  price: Joi.number().positive().optional()
});

// Bulk seat operation schemas
const bulkAddSeatsSchema = Joi.object({
  seats: Joi.array().items(
    Joi.object({
      seat_row: Joi.string().max(2).required(),
      seat_number: Joi.number().integer().positive().required()
    })
  ).min(1).required()
});

const bulkDeleteSeatsSchema = Joi.object({
  seats: Joi.array().items(
    Joi.object({
      seat_row: Joi.string().max(2).required(),
      seat_number: Joi.number().integer().positive().required()
    })
  ).min(1).required()
});

// Validation middleware factory
const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Export validation middlewares
export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateLockSeats = validate(lockSeatsSchema);
export const validateConfirmBooking = validate(confirmBookingSchema);
export const validateCancelBooking = validate(cancelBookingSchema);
export const validatePaymentSimulate = validate(paymentSimulateSchema);

// Admin validation middlewares
export const validateCreateVenue = validate(createVenueSchema);
export const validateUpdateVenue = validate(updateVenueSchema);
export const validateCreateEvent = validate(createEventSchema);
export const validateUpdateEvent = validate(updateEventSchema);
export const validateCreateShow = validate(createShowSchema);
export const validateUpdateShow = validate(updateShowSchema);
export const validateBulkAddSeats = validate(bulkAddSeatsSchema);
export const validateBulkDeleteSeats = validate(bulkDeleteSeatsSchema);
