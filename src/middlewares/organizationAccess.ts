import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { createError } from './errorHandler';

export interface OrganizationRequest extends AuthenticatedRequest {
  organizationId: number;
}

export const organizationAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw createError('User not authenticated', 401);
  }

  if (!req.user.organizationId) {
    throw createError('User has no organization assigned', 403);
  }

  // Add organizationId to request for easy access
  (req as OrganizationRequest).organizationId = req.user.organizationId;

  next();
};

export const ensureOrganizationOwnership = (
  resourceOrganizationId: number,
  userOrganizationId: number
): void => {
  if (resourceOrganizationId !== userOrganizationId) {
    throw createError('Access denied: Resource belongs to different organization', 403);
  }
};