import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';

// Import all entities
import {
  Cadastro,
  Pessoa,
  PessoaTipo,
  PessoaFace,
  PessoaContato,
  PessoaEndereco,
  Evento,
  Camera,
  Deteccao,
  User
} from '@/entities';

dotenv.config();

const databaseConfig = process.env.DB_TYPE === 'sqlite' ? {
  type: 'sqlite' as const,
  database: process.env.DB_DATABASE || './data/facial_recognition.db',
} : {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'facial_recognition_db',
};

export const AppDataSource = new DataSource({
  ...databaseConfig,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Cadastro,
    Pessoa,
    PessoaTipo,
    PessoaFace,
    PessoaContato,
    PessoaEndereco,
    Evento,
    Camera,
    Deteccao,
    User
  ],
  migrations: [path.join(__dirname, '../migrations/*.{ts,js}')],
  subscribers: [path.join(__dirname, '../subscribers/*.{ts,js}')],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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