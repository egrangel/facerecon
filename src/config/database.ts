import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';

// Import all entities
import {
  Organization,
  Person,
  PersonType,
  PersonFace,
  PersonContact,
  PersonAddress,
  Event,
  Camera,
  Detection,
  EventCamera,
  User
} from '../entities';

dotenv.config();

// SQL Logging Configuration - optimized for production
const getSqlLoggingConfig = () => {
  const enableSqlLogging = process.env.ENABLE_SQL_LOGGING?.toLowerCase() === 'true';

  if (!enableSqlLogging) {
    return false;
  }

  // Configure what types of SQL to log - reduced in production
  const defaultLogTypes = process.env.NODE_ENV === 'production' ? 'error' : 'query,error';
  const logTypes = (process.env.SQL_LOG_TYPES || defaultLogTypes).split(',').map(t => t.trim());

  console.log(`🔍 SQL Logging enabled. Logging types: ${logTypes.join(', ')}`);

  return logTypes as any;
};

const databaseConfig = process.env.DB_TYPE === 'sqlite' ? {
  type: 'sqlite' as const,
  database: process.env.DB_DATABASE || './data/facial_recognition.db',
  maxQueryExecutionTime: 5000, // 5 seconds
} : {
  type: 'postgres' as const,
  host: process.env.DB_HOST || '192.168.1.2',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'facial_recognition_db',
  // PostgreSQL connection pooling for high concurrency
  poolSize: 25, // Increased for multi-camera system
  maxQueryExecutionTime: 5000, // 5 seconds
  extra: {
    connectionLimit: 25,
    acquireTimeout: 10000,
    timeout: 30000,
    reconnect: true,
  },
};

export const AppDataSource = new DataSource({
  ...databaseConfig,
  synchronize: process.env.NODE_ENV === 'development',
  logging: getSqlLoggingConfig(), // Configurable SQL logging
  entities: [
    Organization,
    Person,
    PersonType,
    PersonFace,
    PersonContact,
    PersonAddress,
    Event,
    Camera,
    Detection,
    EventCamera,
    User
  ],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  subscribers: [path.join(__dirname, '../subscribers/*.{ts,js}')],
  // Event loop protection for database operations
  cache: {
    duration: 30000, // 30 seconds cache for frequently accessed data
  },
  ...(process.env.DB_TYPE === 'postgres' && process.env.NODE_ENV === 'production'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');

    // Log connection pool info
    const driver = AppDataSource.driver as any;
    if (driver.pool) {
      console.log(`Database pool size: ${databaseConfig.poolSize || 'default'}`);
    }

    if (process.env.NODE_ENV === 'development') {
      await AppDataSource.synchronize();
      console.log('Database synchronized');
    }

    // Set up database health monitoring
    setInterval(async () => {
      try {
        await AppDataSource.query('SELECT 1');
      } catch (error) {
        console.error('Database health check failed:', error);
      }
    }, 60000); // Check every minute

  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};

/**
 * Get database connection pool health
 */
export const getDatabaseHealth = () => {
  const driver = AppDataSource.driver as any;
  return {
    isConnected: AppDataSource.isInitialized,
    poolSize: databaseConfig.poolSize || 'default',
    activeConnections: driver.pool?.numUsed || 0,
    idleConnections: driver.pool?.numFree || 0,
    pendingConnections: driver.pool?.numPendingAcquires || 0,
  };
};