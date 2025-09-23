import { Router } from 'express';
import { authenticateToken, authorize } from '../middlewares/auth';
import { organizationAccess } from '../middlewares/organizationAccess';
import { AuthController } from '../controllers/AuthController';
import {
  OrganizationController,
  PersonController,
  EventController,
  CameraController,
  DetectionController,
  UserController,
} from '../controllers';
import { settingsRoutes } from './settingsRoutes';
import streamRoutes from './streamRoutes';
import { dashboardRoutes } from './dashboardRoutes';

// Initialize controllers
const authController = new AuthController();
const organizationController = new OrganizationController();
const personController = new PersonController();
const eventController = new EventController();
const cameraController = new CameraController();
const detectionController = new DetectionController();
const userController = new UserController();

// Auth Routes
export const authRoutes = Router();

authRoutes.post('/login', authController.login);
authRoutes.post('/register', authController.register);
authRoutes.post('/refresh', authController.refreshToken);
authRoutes.post('/logout', authenticateToken, authController.logout);
authRoutes.post('/change-password', authenticateToken, authController.changePassword);
authRoutes.get('/me', authenticateToken, authController.me);

// Organization Routes
export const organizationRoutes = Router();

// Public routes (with optional auth)
organizationRoutes.get('/', organizationController.findAll);
organizationRoutes.get('/count', organizationController.count);
organizationRoutes.get('/status/:status', organizationController.findByStatus);
organizationRoutes.get('/:id', organizationController.findById);
organizationRoutes.get('/:id/full', organizationController.findWithRelations);

// Protected routes
organizationRoutes.use(authenticateToken);
organizationRoutes.post('/', authorize(['admin', 'operator']), organizationController.create);
organizationRoutes.put('/:id', authorize(['admin', 'operator']), organizationController.update);
organizationRoutes.delete('/:id', authorize(['admin']), organizationController.delete);
organizationRoutes.delete('/:id/hard', authorize(['admin']), organizationController.hardDelete);

// Person Routes
export const personRoutes = Router();

// All person routes require authentication and organization access
personRoutes.use(authenticateToken);
personRoutes.use(organizationAccess);

// Organization-filtered routes
personRoutes.get('/', personController.findAll);
personRoutes.get('/count', personController.count);
personRoutes.get('/:id', personController.findById);
personRoutes.get('/:id/full', personController.findWithFullRelations);
personRoutes.post('/', authorize(['admin', 'operator']), personController.create);
personRoutes.put('/:id', authorize(['admin', 'operator']), personController.update);
personRoutes.delete('/:id', authorize(['admin']), personController.delete);

// Nested resources
personRoutes.post('/:id/types', authorize(['admin', 'operator']), personController.addType);
personRoutes.post('/:id/faces', authorize(['admin', 'operator']), personController.addFace);
personRoutes.post('/:id/contacts', authorize(['admin', 'operator']), personController.addContact);
personRoutes.post('/:id/addresses', authorize(['admin', 'operator']), personController.addAddress);

// Event Routes
export const eventRoutes = Router();

// All event routes require authentication and organization access
eventRoutes.use(authenticateToken);
eventRoutes.use(organizationAccess);

// Organization-filtered routes
eventRoutes.get('/', eventController.findAll);
eventRoutes.get('/count', eventController.count);
eventRoutes.get('/date-range', eventController.findByDateRange);
eventRoutes.get('/:id', eventController.findById);
eventRoutes.post('/', authorize(['admin', 'operator']), eventController.create);
eventRoutes.put('/:id', authorize(['admin', 'operator']), eventController.update);
eventRoutes.delete('/:id', authorize(['admin']), eventController.delete);

// Camera-Event Association routes
eventRoutes.get('/:eventId/cameras', authorize(['admin', 'operator']), eventController.getEventCameras);
eventRoutes.get('/:eventId/cameras/active', authorize(['admin', 'operator']), eventController.getActiveEventCameras);
eventRoutes.post('/:eventId/cameras/:cameraId', authorize(['admin', 'operator']), eventController.addCameraToEvent);
eventRoutes.delete('/:eventId/cameras/:cameraId', authorize(['admin', 'operator']), eventController.removeCameraFromEvent);
eventRoutes.patch('/:eventId/cameras/:cameraId/toggle', authorize(['admin', 'operator']), eventController.toggleCameraInEvent);

// Event Scheduler Management routes
eventRoutes.get('/scheduler/health', authorize(['admin', 'operator']), eventController.getSchedulerHealth);
eventRoutes.get('/scheduler/sessions', authorize(['admin', 'operator']), eventController.getActiveSessions);
eventRoutes.get('/scheduled', authorize(['admin', 'operator']), eventController.findScheduledEvents);
eventRoutes.post('/:eventId/start', authorize(['admin', 'operator']), eventController.manuallyStartEvent);
eventRoutes.post('/:eventId/stop', authorize(['admin', 'operator']), eventController.manuallyStopEvent);
eventRoutes.patch('/:eventId/toggle-status', authorize(['admin', 'operator']), eventController.toggleEventStatus);

// Camera Routes
export const cameraRoutes = Router();

// All camera routes require authentication and organization access
cameraRoutes.use(authenticateToken);
cameraRoutes.use(organizationAccess);

// Organization-filtered routes
cameraRoutes.get('/', cameraController.findAll);
cameraRoutes.get('/count', cameraController.count);
cameraRoutes.get('/:id', cameraController.findById);
cameraRoutes.post('/', authorize(['admin', 'operator']), cameraController.create);
cameraRoutes.put('/:id', authorize(['admin', 'operator']), cameraController.update);
cameraRoutes.delete('/:id', authorize(['admin']), cameraController.delete);
cameraRoutes.post('/:id/test-connection', authorize(['admin', 'operator']), cameraController.testConnection);

// Detection Routes
export const detectionRoutes = Router();

// All detection routes require authentication and organization access
detectionRoutes.use(authenticateToken);
detectionRoutes.use(organizationAccess);

// Organization-filtered routes
detectionRoutes.get('/', detectionController.findAll);
detectionRoutes.get('/count', detectionController.count);
detectionRoutes.get('/stats', detectionController.getStats);
detectionRoutes.get('/recent', detectionController.findRecentDetections);
detectionRoutes.get('/event/:eventId', detectionController.findByEventId);
detectionRoutes.get('/person-face/:personFaceId', detectionController.findByPersonFaceId);
detectionRoutes.get('/:id', detectionController.findById);
detectionRoutes.post('/', authorize(['admin', 'operator']), detectionController.create);
detectionRoutes.put('/:id', authorize(['admin', 'operator']), detectionController.update);
detectionRoutes.delete('/:id', authorize(['admin']), detectionController.delete);

// User Routes
export const userRoutes = Router();

// Public routes
userRoutes.get('/', userController.findAll);
userRoutes.get('/count', userController.count);
userRoutes.get('/role/:role', userController.findByRole);
userRoutes.get('/status/:status', userController.findByStatus);
userRoutes.get('/email/:email', userController.findByEmail);
userRoutes.get('/:id', userController.findById);

// Protected routes
userRoutes.use(authenticateToken);
userRoutes.post('/', authorize(['admin']), userController.create);
userRoutes.put('/:id', authorize(['admin']), userController.update);
userRoutes.delete('/:id', authorize(['admin']), userController.delete);

// Main router combining all routes
export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/organizations', organizationRoutes);
apiRoutes.use('/people', personRoutes);
apiRoutes.use('/events', eventRoutes);
apiRoutes.use('/cameras', cameraRoutes);
apiRoutes.use('/detections', detectionRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/settings', settingsRoutes);
apiRoutes.use('/streams', streamRoutes);
apiRoutes.use('/dashboard', dashboardRoutes);


// Health check route
apiRoutes.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || 'v1',
  });
});