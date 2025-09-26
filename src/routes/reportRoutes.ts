import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth';
import { organizationAccess } from '../middlewares/organizationAccess';
import { ReportController } from '../controllers/ReportController';

// Initialize controller
const reportController = new ReportController();

export const reportRoutes = Router();

// All report routes require authentication and organization access
reportRoutes.use(authenticateToken);
reportRoutes.use(organizationAccess);

// Organization-filtered routes
reportRoutes.get('/attendance-frequency', reportController.getAttendanceFrequencyReport);
reportRoutes.get('/event-frequency', reportController.getEventFrequencyReport);