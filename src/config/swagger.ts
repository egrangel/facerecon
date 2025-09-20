import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Facial Recognition API',
      version: '1.0.0',
      description: 'API para sistema de reconhecimento facial com gerenciamento de clientes',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api/v1`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string', format: 'email' },
            nome: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'user', 'operator'] },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
        Cadastro: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            descricao: { type: 'string' },
            status: { type: 'string' },
            configuracoes: { type: 'object' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Pessoa: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            tipoPessoa: { type: 'string', enum: ['fisica', 'juridica'] },
            documento: { type: 'string' },
            rg: { type: 'string' },
            dataNascimento: { type: 'string', format: 'date' },
            sexo: { type: 'string', enum: ['M', 'F', 'Outro'] },
            status: { type: 'string' },
            observacoes: { type: 'string' },
            metadados: { type: 'object' },
            cadastroId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PessoaTipo: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            tipo: { type: 'string' },
            descricao: { type: 'string' },
            status: { type: 'string' },
            pessoaId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PessoaFace: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            faceId: { type: 'string' },
            parametrosBiometricos: { type: 'object' },
            confiabilidade: { type: 'number' },
            status: { type: 'string' },
            observacoes: { type: 'string' },
            pessoaId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PessoaContato: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            tipo: { type: 'string' },
            valor: { type: 'string' },
            principal: { type: 'boolean' },
            status: { type: 'string' },
            pessoaId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PessoaEndereco: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            tipo: { type: 'string' },
            logradouro: { type: 'string' },
            numero: { type: 'string' },
            complemento: { type: 'string' },
            bairro: { type: 'string' },
            cidade: { type: 'string' },
            uf: { type: 'string' },
            cep: { type: 'string' },
            pais: { type: 'string' },
            principal: { type: 'boolean' },
            status: { type: 'string' },
            pessoaId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Evento: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            descricao: { type: 'string' },
            tipo: { type: 'string' },
            dataHoraOcorrencia: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
            local: { type: 'string' },
            metadados: { type: 'object' },
            cadastroId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Camera: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            descricao: { type: 'string' },
            ip: { type: 'string' },
            porta: { type: 'integer' },
            usuario: { type: 'string' },
            senha: { type: 'string' },
            urlStream: { type: 'string' },
            protocolo: { type: 'string' },
            localizacao: { type: 'string' },
            status: { type: 'string' },
            configuracoes: { type: 'object' },
            cadastroId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Deteccao: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            dataHoraDeteccao: { type: 'string', format: 'date-time' },
            confiabilidade: { type: 'number' },
            status: { type: 'string' },
            imagemUrl: { type: 'string' },
            coordenadas: { type: 'object' },
            observacoes: { type: 'string' },
            eventoId: { type: 'integer' },
            pessoaFaceId: { type: 'integer' },
            cameraId: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './src/controllers/*.ts',
    './src/routes/*.ts',
  ],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  if (process.env.SWAGGER_ENABLED === 'true') {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Facial Recognition API Documentation',
    }));

    console.log('Swagger documentation available at: /api/docs');
  }
};