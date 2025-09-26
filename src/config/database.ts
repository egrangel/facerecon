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

const databaseConfig = process.env.DB_TYPE === 'sqlite' ? {
  type: 'sqlite' as const,
  database: process.env.DB_DATABASE || './data/facial_recognition.db',
} : {
  type: 'postgres' as const,
  host: process.env.DB_HOST || '192.168.1.2',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'facial_recognition_db',
};

export const AppDataSource = new DataSource({
  ...databaseConfig,
  synchronize: process.env.NODE_ENV === 'development',
  logging: false, // Disabled to prevent embedding data from appearing in logs
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
  ...(process.env.DB_TYPE === 'postgres' && process.env.NODE_ENV === 'production'
    ? { ssl: { rejectUnauthorized: false } }
    : {}),
});

export const initializeDatabase = async (): Promise<void> => {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established successfully');
    
    if (process.env.NODE_ENV === 'development') {
      await AppDataSource.synchronize();
      console.log('Database synchronized');
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
};