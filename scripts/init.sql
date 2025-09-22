-- PostgreSQL Production Database Initialization Script

-- Create database and user (if not exists)
-- Note: This script is for reference. In production, create these manually or via environment variables.

-- Example commands to run before starting the container:
-- CREATE DATABASE facial_recognition_prod;
-- CREATE USER facial_recognition_user WITH ENCRYPTED PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE facial_recognition_prod TO facial_recognition_user;

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create any additional indexes for performance
-- (TypeORM will handle table creation automatically)

-- Create production-specific configurations
-- Set timezone to UTC for consistency
-- ALTER DATABASE facial_recognition_prod SET timezone TO 'UTC';