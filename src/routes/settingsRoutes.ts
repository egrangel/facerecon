import { Router } from 'express';
import { SettingsController } from '@/controllers/SettingsController';
import { authenticateToken } from '@/middlewares/auth';
import { organizationAccess } from '@/middlewares/organizationAccess';

const router = Router();
const settingsController = new SettingsController();

// Apply authentication and organization access middleware to all routes
router.use(authenticateToken);
router.use(organizationAccess);

// Organization management
router.get('/organization', settingsController.getOrganization);
router.put('/organization', settingsController.updateOrganization);

// Users management within organization
router.get('/users', settingsController.getOrganizationUsers);
router.post('/users', settingsController.createUser);
router.put('/users/:id', settingsController.updateUser);
router.delete('/users/:id', settingsController.deleteUser);

export { router as settingsRoutes };