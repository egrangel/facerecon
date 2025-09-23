import { Router } from 'express';
import { authenticateToken } from '@/middlewares/auth';
import { organizationAccess } from '@/middlewares/organizationAccess';
import { DashboardController } from '@/controllers';

const dashboardController = new DashboardController();

export const dashboardRoutes = Router();

// Protected routes with organization access
dashboardRoutes.use(authenticateToken);
dashboardRoutes.use(organizationAccess);

// Dashboard statistics
dashboardRoutes.get('/stats', dashboardController.getStats);

// System status
dashboardRoutes.get('/system-status', dashboardController.getSystemStatus);