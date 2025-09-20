# Facial Recognition Backend API

A comprehensive backend application for facial recognition systems with client management, built with Node.js, TypeScript, Express, and PostgreSQL.

## 🚀 Features

- **Clean Architecture**: Well-structured codebase following SOLID principles
- **RESTful API**: Complete CRUD operations for all entities
- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Database Management**: TypeORM with PostgreSQL, migrations support
- **API Documentation**: Swagger/OpenAPI documentation
- **Security**: Helmet, CORS, rate limiting, input validation
- **Containerization**: Docker and Docker Compose ready
- **Error Handling**: Comprehensive error handling and logging
- **Scalability**: Load balancing with Nginx, Redis caching ready

## 📋 Entities

### Core Entities
- **Cadastro**: Main client registration
- **Pessoa**: Person registry (individuals/organizations)
- **PessoaTipo**: Person type definitions (member, employee, etc.)
- **PessoaFace**: Facial recognition data
- **PessoaContato**: Contact information
- **PessoaEndereco**: Address information

### Event & Detection
- **Evento**: Event management
- **Camera**: Camera configuration
- **Deteccao**: Face detection records

### System
- **User**: System users with authentication

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15+
- **ORM**: TypeORM
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose
- **Load Balancer**: Nginx

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd facial-recognition-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database setup**
```bash
# Create database
createdb facial_recognition_db

# Run migrations
npm run migrate
```

5. **Start development server**
```bash
npm run dev
```

### Docker Development

1. **Start services**
```bash
docker-compose up -d
```

2. **View logs**
```bash
docker-compose logs -f api
```

3. **Stop services**
```bash
docker-compose down
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Server
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=facial_recognition_db

# JWT
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Features
SWAGGER_ENABLED=true

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
CORS_CREDENTIALS=true
```

## 📚 API Documentation

### Endpoints Overview

**Authentication**
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - User logout
- `GET /api/v1/auth/me` - Get current user

**Cadastros**
- `GET /api/v1/cadastros` - List all cadastros
- `POST /api/v1/cadastros` - Create cadastro
- `GET /api/v1/cadastros/:id` - Get cadastro by ID
- `PUT /api/v1/cadastros/:id` - Update cadastro
- `DELETE /api/v1/cadastros/:id` - Delete cadastro

**Pessoas**
- `GET /api/v1/pessoas` - List all pessoas
- `POST /api/v1/pessoas` - Create pessoa
- `GET /api/v1/pessoas/:id` - Get pessoa by ID
- `GET /api/v1/pessoas/documento/:documento` - Get by document
- `POST /api/v1/pessoas/:id/faces` - Add face data
- `POST /api/v1/pessoas/:id/contatos` - Add contact
- `POST /api/v1/pessoas/:id/enderecos` - Add address

**Events & Detection**
- `GET /api/v1/eventos` - List events
- `GET /api/v1/cameras` - List cameras
- `GET /api/v1/deteccoes` - List detections
- `GET /api/v1/deteccoes/recent` - Recent detections
- `GET /api/v1/deteccoes/stats` - Detection statistics

### Swagger Documentation

When running the server, visit:
- **Local**: http://localhost:3000/api/docs
- **Docker**: http://localhost/api/docs

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication:

1. **Register** or **Login** to get access tokens
2. **Include** the token in the Authorization header:
   ```
   Authorization: Bearer <your-jwt-token>
   ```
3. **Refresh** tokens when they expire

### User Roles
- **admin**: Full access to all resources
- **operator**: Can create/update most resources
- **user**: Read-only access to most resources

## 🗄 Database Schema

### Core Relationships
```
Cadastro (1) ←→ (N) Pessoa
Pessoa (1) ←→ (N) PessoaTipo
Pessoa (1) ←→ (N) PessoaFace
Pessoa (1) ←→ (N) PessoaContato
Pessoa (1) ←→ (N) PessoaEndereco

Cadastro (1) ←→ (N) Evento
Cadastro (1) ←→ (N) Camera

Evento (1) ←→ (N) Deteccao
PessoaFace (1) ←→ (N) Deteccao
Camera (1) ←→ (N) Deteccao
```

### Migration Commands
```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migrate

# Revert migration
npm run migrate:revert
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Docker Production
```bash
# Build production image
docker build -t facial-recognition-api .

# Run container
docker run -p 3000:3000 --env-file .env facial-recognition-api
```

### Environment-specific configs
- **Development**: Full logging, Swagger enabled
- **Production**: Optimized logging, security headers, rate limiting

## 📊 Performance & Monitoring

### Health Checks
- **Endpoint**: `GET /api/v1/health`
- **Docker**: Built-in health check
- **Load Balancer**: Nginx health check integration

### Monitoring
- Request logging with Morgan
- Error tracking and reporting
- Database connection monitoring
- Memory and CPU usage tracking

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Request throttling
- **Input Validation**: Data sanitization
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt encryption
- **SQL Injection Prevention**: TypeORM protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the API documentation at `/api/docs`
- Review the logs for debugging information

## 🔄 API Versioning

Current version: **v1**
- Base URL: `/api/v1`
- Versioning strategy: URL path versioning
- Backward compatibility maintained

---

**Happy Coding! 🎉**