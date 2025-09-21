import { Router } from 'express';
import { authenticateToken } from '@/middlewares/auth';
import { DashboardController } from '@/controllers';

const dashboardController = new DashboardController();

export const dashboardRoutes = Router();

// Protected routes
dashboardRoutes.use(authenticateToken);

// Dashboard statistics
dashboardRoutes.get('/stats', dashboardController.getStats);

// System status
dashboardRoutes.get('/system-status', dashboardController.getSystemStatus);