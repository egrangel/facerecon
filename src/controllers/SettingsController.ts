import { Response } from 'express';
import { OrganizationService, UserService } from '@/services';
import { OrganizationRequest } from '@/middlewares/organizationAccess';
import { asyncHandler } from '@/middlewares/errorHandler';

export class SettingsController {
  private organizationService: OrganizationService;
  private userService: UserService;

  constructor() {
    this.organizationService = new OrganizationService();
    this.userService = new UserService();
  }

  /**
   * @swagger
   * /api/v1/settings/organization:
   *   get:
   *     summary: Get current user's organization data
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Organization data retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/Organization'
   */
  getOrganization = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const organization = await this.organizationService.findById(req.organizationId);

    res.status(200).json({
      success: true,
      data: organization,
    });
  });

  /**
   * @swagger
   * /api/v1/settings/organization:
   *   put:
   *     summary: Update current user's organization data
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *     responses:
   *       200:
   *         description: Organization updated successfully
   */
  updateOrganization = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { name, description, status } = req.body;

    const updatedOrganization = await this.organizationService.update(req.organizationId, {
      name,
      description,
      status,
    });

    res.status(200).json({
      success: true,
      message: 'Organization updated successfully',
      data: updatedOrganization,
    });
  });

  /**
   * @swagger
   * /api/v1/settings/users:
   *   get:
   *     summary: Get all users from current organization
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Users retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   */
  getOrganizationUsers = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const users = await this.userService.findByOrganizationId(req.organizationId);

    res.status(200).json({
      success: true,
      data: users.map(user => user.toJSON()),
    });
  });

  /**
   * @swagger
   * /api/v1/settings/users:
   *   post:
   *     summary: Create new user in current organization
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *               - name
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 minLength: 6
   *               name:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, user, operator]
   *                 default: user
   *     responses:
   *       201:
   *         description: User created successfully
   */
  createUser = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { email, password, name, role = 'user' } = req.body;

    const userData = {
      email,
      password,
      name,
      role,
      status: 'active',
      organizationId: req.organizationId,
    };

    const user = await this.userService.create(userData);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user.toJSON(),
    });
  });

  /**
   * @swagger
   * /api/v1/settings/users/{id}:
   *   put:
   *     summary: Update user in current organization
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               name:
   *                 type: string
   *               role:
   *                 type: string
   *                 enum: [admin, user, operator]
   *               status:
   *                 type: string
   *                 enum: [active, inactive]
   *     responses:
   *       200:
   *         description: User updated successfully
   */
  updateUser = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id);
    const { email, name, role, status } = req.body;

    // Ensure user belongs to the same organization
    const existingUser = await this.userService.findById(userId);
    if (!existingUser || existingUser.organizationId !== req.organizationId) {
      res.status(404).json({
        success: false,
        message: 'User not found in your organization',
      });
      return;
    }

    const updatedUser = await this.userService.update(userId, {
      email,
      name,
      role,
      status,
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser.toJSON(),
    });
  });

  /**
   * @swagger
   * /api/v1/settings/users/{id}:
   *   delete:
   *     summary: Delete user from current organization
   *     tags: [Settings]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User deleted successfully
   */
  deleteUser = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const userId = parseInt(req.params.id);

    // Ensure user belongs to the same organization
    const existingUser = await this.userService.findById(userId);
    if (!existingUser || existingUser.organizationId !== req.organizationId) {
      res.status(404).json({
        success: false,
        message: 'User not found in your organization',
      });
      return;
    }

    // Prevent deleting the last admin user
    if (existingUser.role === 'admin') {
      const adminUsers = await this.userService.findByOrganizationId(req.organizationId);
      const adminCount = adminUsers.filter(user => user.role === 'admin').length;

      if (adminCount <= 1) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete the last admin user in the organization',
        });
        return;
      }
    }

    await this.userService.delete(userId);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  });
}