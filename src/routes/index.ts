import { Router } from 'express';
import { authenticateToken, authorize } from '@/middlewares/auth';
import { AuthController } from '@/controllers/AuthController';
import {
  CadastroController,
  PessoaController,
  EventoController,
  CameraController,
  DeteccaoController,
} from '@/controllers';

// Initialize controllers
const authController = new AuthController();
const cadastroController = new CadastroController();
const pessoaController = new PessoaController();
const eventoController = new EventoController();
const cameraController = new CameraController();
const deteccaoController = new DeteccaoController();

// Auth Routes
export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.post('/register', authController.register);
authRoutes.post('/refresh', authController.refreshToken);
authRoutes.post('/logout', authenticateToken, authController.logout);
authRoutes.post('/change-password', authenticateToken, authController.changePassword);
authRoutes.get('/me', authenticateToken, authController.me);

// Cadastro Routes
export const cadastroRoutes = Router();

// Public routes (with optional auth)
cadastroRoutes.get('/', cadastroController.findAll);
cadastroRoutes.get('/count', cadastroController.count);
cadastroRoutes.get('/status/:status', cadastroController.findByStatus);
cadastroRoutes.get('/:id', cadastroController.findById);
cadastroRoutes.get('/:id/full', cadastroController.findWithRelations);

// Protected routes
cadastroRoutes.use(authenticateToken);
cadastroRoutes.post('/', authorize(['admin', 'operator']), cadastroController.create);
cadastroRoutes.put('/:id', authorize(['admin', 'operator']), cadastroController.update);
cadastroRoutes.delete('/:id', authorize(['admin']), cadastroController.delete);
cadastroRoutes.delete('/:id/hard', authorize(['admin']), cadastroController.hardDelete);

// Pessoa Routes
export const pessoaRoutes = Router();

// Public routes
pessoaRoutes.get('/', pessoaController.findAll);
pessoaRoutes.get('/count', pessoaController.count);
pessoaRoutes.get('/documento/:documento', pessoaController.findByDocumento);
pessoaRoutes.get('/cadastro/:cadastroId', pessoaController.findByCadastroId);
pessoaRoutes.get('/:id', pessoaController.findById);
pessoaRoutes.get('/:id/full', pessoaController.findWithFullRelations);

// Protected routes
pessoaRoutes.use(authenticateToken);
pessoaRoutes.post('/', authorize(['admin', 'operator']), pessoaController.create);
pessoaRoutes.put('/:id', authorize(['admin', 'operator']), pessoaController.update);
pessoaRoutes.delete('/:id', authorize(['admin']), pessoaController.delete);

// Nested resources
pessoaRoutes.post('/:id/tipos', authorize(['admin', 'operator']), pessoaController.addTipo);
pessoaRoutes.post('/:id/faces', authorize(['admin', 'operator']), pessoaController.addFace);
pessoaRoutes.post('/:id/contatos', authorize(['admin', 'operator']), pessoaController.addContato);
pessoaRoutes.post('/:id/enderecos', authorize(['admin', 'operator']), pessoaController.addEndereco);

// Evento Routes
export const eventoRoutes = Router();

// Public routes
eventoRoutes.get('/', eventoController.findAll);
eventoRoutes.get('/count', eventoController.count);
eventoRoutes.get('/cadastro/:cadastroId', eventoController.findByCadastroId);
eventoRoutes.get('/date-range', eventoController.findByDateRange);
eventoRoutes.get('/:id', eventoController.findById);

// Protected routes
eventoRoutes.use(authenticateToken);
eventoRoutes.post('/', authorize(['admin', 'operator']), eventoController.create);
eventoRoutes.put('/:id', authorize(['admin', 'operator']), eventoController.update);
eventoRoutes.delete('/:id', authorize(['admin']), eventoController.delete);

// Camera Routes
export const cameraRoutes = Router();

// Public routes
cameraRoutes.get('/', cameraController.findAll);
cameraRoutes.get('/count', cameraController.count);
cameraRoutes.get('/cadastro/:cadastroId', cameraController.findByCadastroId);
cameraRoutes.get('/status/:status', cameraController.findByStatus);
cameraRoutes.get('/:id', cameraController.findById);

// Protected routes
cameraRoutes.use(authenticateToken);
cameraRoutes.post('/', authorize(['admin', 'operator']), cameraController.create);
cameraRoutes.put('/:id', authorize(['admin', 'operator']), cameraController.update);
cameraRoutes.delete('/:id', authorize(['admin']), cameraController.delete);
cameraRoutes.post('/:id/test-connection', authorize(['admin', 'operator']), cameraController.testConnection);

// Deteccao Routes
export const deteccaoRoutes = Router();

// Public routes
deteccaoRoutes.get('/', deteccaoController.findAll);
deteccaoRoutes.get('/count', deteccaoController.count);
deteccaoRoutes.get('/stats', deteccaoController.getStats);
deteccaoRoutes.get('/recent', deteccaoController.findRecentDetections);
deteccaoRoutes.get('/evento/:eventoId', deteccaoController.findByEventoId);
deteccaoRoutes.get('/pessoa-face/:pessoaFaceId', deteccaoController.findByPessoaFaceId);
deteccaoRoutes.get('/:id', deteccaoController.findById);

// Protected routes
deteccaoRoutes.use(authenticateToken);
deteccaoRoutes.post('/', authorize(['admin', 'operator']), deteccaoController.create);
deteccaoRoutes.put('/:id', authorize(['admin', 'operator']), deteccaoController.update);
deteccaoRoutes.delete('/:id', authorize(['admin']), deteccaoController.delete);

// Main router combining all routes
export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/cadastros', cadastroRoutes);
apiRoutes.use('/pessoas', pessoaRoutes);
apiRoutes.use('/eventos', eventoRoutes);
apiRoutes.use('/cameras', cameraRoutes);
apiRoutes.use('/deteccoes', deteccaoRoutes);

// Health check route
apiRoutes.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API está funcionando corretamente',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
  });
});