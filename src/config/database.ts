import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import path from 'path';

// Import all entities
import { Cadastro } from '@/entities/Cadastro';
import { Pessoa } from '@/entities/Pessoa';
import { PessoaTipo } from '@/entities/PessoaTipo';
import { PessoaFace } from '@/entities/PessoaFace';
import { PessoaContato } from '@/entities/PessoaContato';
import { PessoaEndereco } from '@/entities/PessoaEndereco';
import { Evento } from '@/entities/Evento';
import { Camera } from '@/entities/Camera';
import { Deteccao } from '@/entities/Deteccao';
import { User } from '@/entities/User';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_DATABASE || 'facial_recognition_db',
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