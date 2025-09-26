import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

import { initializeDatabase } from '@/config/database';
import { setupSwagger } from '@/config/swagger';
import { apiRoutes } from '@/routes';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { streamService } from '@/services/StreamService';
import { webSocketStreamService } from '@/services/WebSocketStreamService';
import { eventSchedulerService } from '@/services/EventSchedulerService';
import { faceIndexService } from '@/services/FaceIndexService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const API_VERSION = process.env.API_VERSION || 'v1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust proxy in production (for SSL termination, load balancers)
if (IS_PRODUCTION && process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Rate limiting
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10000'),
//   message: {
//     success: false,
//     message: 'Too many requests. Please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
//   skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true',
//   keyGenerator: (req) => {
//     // Use X-Forwarded-For in production behind proxy
//     return req.ip || req.connection.remoteAddress || 'unknown';
//   },
// });

// Security middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: IS_PRODUCTION ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  } : false,
  hsts: IS_PRODUCTION ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://192.168.1.2:3000'];

    // Allow requests with no origin (mobile apps, Postman, etc.) only in development
    if (!origin && !IS_PRODUCTION) return callback(null, true);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Basic middlewares
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rate limiting
// app.use(limiter);

// Static file serving for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use(`/api/${API_VERSION}`, apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Facial Recognition API',
    version: API_VERSION,
    documentation: process.env.SWAGGER_ENABLED === 'true' ? '/api/docs' : 'Disabled',
    timestamp: new Date().toISOString(),
  });
});

// Setup Swagger documentation
setupSwagger(app);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();
    console.log('✅ Database initialized successfully');

    // Initialize Face Recognition ANN Index
    try {
      await faceIndexService.initialize();
      const stats = faceIndexService.getStats();
      console.log(`✅ Face Recognition ANN Index initialized with ${stats.totalFaces} faces`);
    } catch (indexError) {
      console.error('❌ Face Recognition ANN Index initialization failed:', indexError);
      console.log('⚠️ Face recognition will work with reduced performance');
    }
  } catch (error: unknown) {
    // Type guard to check if error is an Error object
    const errorMessage = error instanceof Error
      ? error.message
      : 'Unknown error occurred';

    console.error('❌ Database connection failed:', errorMessage);
    console.log('⚠︝ Server will start without database connection (some features may be unavailable)');
  }

  // Start the server regardless of database connection status
  const host = '0.0.0.0';

  // Create HTTP server
  const server = createServer(app);

  // Initialize WebSocket streaming service
  webSocketStreamService.initialize(server);

  server.listen(PORT, host, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 WebSocket streaming service initialized`);

    // Start the event scheduler for automatic facial recognition
    eventSchedulerService.start();
    console.log(`❰ Event scheduler started - facial recognition will activate automatically based on scheduled events`);

    if (IS_PRODUCTION) {
      console.log(`📡 Production API running on port ${PORT}`);
      console.log(`🔒 Security features enabled`);
    } else {
      console.log(`📡 API base URL: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/${API_VERSION}`}`);
      console.log(`🌝 Network API URL: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/${API_VERSION}`}`);
      console.log(`🔝 Health check: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/${API_VERSION}/health`}`);
      console.log(`🎥 Streaming health: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/${API_VERSION}/streams/health`}`);
      console.log(`📡 WebSocket endpoint: ${process.env.REACT_APP_API_URL || `ws://192.168.1.2:${PORT}/ws/stream`}`);

      if (process.env.SWAGGER_ENABLED === 'true') {
        console.log(`📚 API Documentation: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/docs`}`);
        console.log(`🌝 Network Documentation: ${process.env.REACT_APP_API_URL || `http://192.168.1.2:${PORT}/api/docs`}`);
      }
    }
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  console.log('🎥 Stopping all streams...');
  streamService.stopAllStreams();
  console.log('❰ Stopping event scheduler...');
  eventSchedulerService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  console.log('🎥 Stopping all streams...');
  streamService.stopAllStreams();
  console.log('❰ Stopping event scheduler...');
  eventSchedulerService.stop();
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
startServer();