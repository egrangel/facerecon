import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initializeDatabase } from '@/config/database';
import { setupSwagger } from '@/config/swagger';
import { apiRoutes } from '@/routes';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { streamService } from '@/services/StreamService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust proxy in production (for SSL termination, load balancers)
if (IS_PRODUCTION && process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true',
  keyGenerator: (req) => {
    // Use X-Forwarded-For in production behind proxy
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

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
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

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
app.use(limiter);

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
  } catch (error: unknown) {
    // Type guard to check if error is an Error object
    const errorMessage = error instanceof Error 
      ? error.message
      : 'Unknown error occurred';
    
    console.error('?? Database connection failed:', errorMessage);
    console.log('?? Server will start without database connection (some features may be unavailable)');
  }

  // Start the server regardless of database connection status
  const host = '0.0.0.0';

  app.listen(PORT, host, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`🌝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎥 Streaming service initialized`);

    if (IS_PRODUCTION) {
      console.log(`📡 Production API running on port ${PORT}`);
      console.log(`🔒 Security features enabled`);
    } else {
      console.log(`📡 API base URL: http://localhost:${PORT}/api/${API_VERSION}`);
      console.log(`🌐 Network API URL: http://192.168.1.2:${PORT}/api/${API_VERSION}`);
      console.log(`🔝 Health check: http://localhost:${PORT}/api/${API_VERSION}/health`);
      console.log(`🎥 Streaming health: http://localhost:${PORT}/api/${API_VERSION}/streams/health`);

      if (process.env.SWAGGER_ENABLED === 'true') {
        console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
        console.log(`🌐 Network Documentation: http://192.168.1.2:${PORT}/api/docs`);
      }
    }
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  console.log('🎥 Stopping all streams...');
  streamService.stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  console.log('🎥 Stopping all streams...');
  streamService.stopAllStreams();
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