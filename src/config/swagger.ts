import swaggerJsdoc from 'swagger-jsdoc';
import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Evently Backend API',
      version: '1.0.0',
      description: 'A high-performance venue-based seat booking system with dual-layer locking for concurrent seat reservations',
      contact: {
        name: 'Sachi Patankar',
        email: 'sachipatankar19@gmail.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'https://evently-magb.onrender.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            user_id: {
              type: 'integer',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        Venue: {
          type: 'object',
          properties: {
            venue_id: {
              type: 'integer',
              description: 'Venue ID'
            },
            venue_name: {
              type: 'string',
              description: 'Venue name'
            },
            address: {
              type: 'string',
              description: 'Venue address'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Venue creation timestamp'
            }
          }
        },
        Seat: {
          type: 'object',
          properties: {
            seat_id: {
              type: 'integer',
              description: 'Seat ID'
            },
            venue_id: {
              type: 'integer',
              description: 'Venue ID'
            },
            seat_row: {
              type: 'string',
              description: 'Seat row'
            },
            seat_number: {
              type: 'integer',
              description: 'Seat number'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Seat creation timestamp'
            }
          }
        },
        Event: {
          type: 'object',
          properties: {
            event_id: {
              type: 'integer',
              description: 'Event ID'
            },
            title: {
              type: 'string',
              description: 'Event title'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Event creation timestamp'
            }
          }
        },
        Show: {
          type: 'object',
          properties: {
            show_id: {
              type: 'integer',
              description: 'Show ID'
            },
            event_id: {
              type: 'integer',
              description: 'Event ID'
            },
            venue_id: {
              type: 'integer',
              description: 'Venue ID'
            },
            start_time: {
              type: 'string',
              format: 'date-time',
              description: 'Show start time'
            },
            end_time: {
              type: 'string',
              format: 'date-time',
              description: 'Show end time'
            },
            price: {
              type: 'number',
              description: 'Show price'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Show creation timestamp'
            }
          }
        },
        ShowSeat: {
          type: 'object',
          properties: {
            show_id: {
              type: 'integer',
              description: 'Show ID'
            },
            seat_id: {
              type: 'integer',
              description: 'Seat ID'
            },
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'LOCKED', 'BOOKED'],
              description: 'Seat status'
            },
            booking_id: {
              type: 'integer',
              nullable: true,
              description: 'Booking ID if seat is booked'
            },
            locked_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When seat was locked'
            }
          }
        },
        Booking: {
          type: 'object',
          properties: {
            booking_id: {
              type: 'integer',
              description: 'Booking ID'
            },
            user_id: {
              type: 'integer',
              description: 'User ID'
            },
            show_id: {
              type: 'integer',
              description: 'Show ID'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
              description: 'Booking status'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Booking creation timestamp'
            }
          }
        },
        BookingWithDetails: {
          type: 'object',
          properties: {
            booking_id: {
              type: 'integer',
              description: 'Booking ID'
            },
            user_id: {
              type: 'integer',
              description: 'User ID'
            },
            show: {
              $ref: '#/components/schemas/Show'
            },
            event: {
              $ref: '#/components/schemas/Event'
            },
            venue: {
              $ref: '#/components/schemas/Venue'
            },
            seats: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Seat'
              },
              description: 'Booked seats'
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'CONFIRMED', 'CANCELLED'],
              description: 'Booking status'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Booking creation timestamp'
            }
          }
        },
        ShowWithDetails: {
          type: 'object',
          properties: {
            show_id: {
              type: 'integer',
              description: 'Show ID'
            },
            event: {
              $ref: '#/components/schemas/Event'
            },
            venue: {
              $ref: '#/components/schemas/Venue'
            },
            start_time: {
              type: 'string',
              format: 'date-time',
              description: 'Show start time'
            },
            end_time: {
              type: 'string',
              format: 'date-time',
              description: 'Show end time'
            },
            price: {
              type: 'number',
              description: 'Show price'
            },
            available_seats: {
              type: 'integer',
              description: 'Number of available seats'
            },
            total_seats: {
              type: 'integer',
              description: 'Total number of seats'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Show creation timestamp'
            }
          }
        },
        SeatWithStatus: {
          type: 'object',
          properties: {
            seat_id: {
              type: 'integer',
              description: 'Seat ID'
            },
            venue_id: {
              type: 'integer',
              description: 'Venue ID'
            },
            seat_row: {
              type: 'string',
              description: 'Seat row'
            },
            seat_number: {
              type: 'integer',
              description: 'Seat number'
            },
            status: {
              type: 'string',
              enum: ['AVAILABLE', 'LOCKED', 'BOOKED'],
              description: 'Seat status'
            },
            booking_id: {
              type: 'integer',
              nullable: true,
              description: 'Booking ID if seat is booked'
            },
            locked_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When seat was locked'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Seat creation timestamp'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token'
            },
            user: {
              $ref: '#/components/schemas/User'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Validation error details'
            }
          }
        },
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/api/routes/*.ts', './src/api/controllers/*.ts']
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Evently API Documentation'
  }));
};
