import { Request, Response } from 'express';
import { AuthService, LoginCredentials, RegisterData } from '@/services/AuthServices';
import { AuthenticatedRequest } from '@/middlewares/auth';
import { asyncHandler } from '@/middlewares/errorHandler';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     summary: User login
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *               password:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: Login realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *                     tokens:
   *                       $ref: '#/components/schemas/TokenPair'
   *       401:
   *         description: Credenciais inválidas
   */
  login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const credentials: LoginCredentials = req.body;
    
    const result = await this.authService.login(credentials);
    
    res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        user: result.user.toJSON(),
        tokens: result.tokens,
      },
    });
  });

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     summary: Register new user with organization
   *     tags: [Authentication]
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
   *               - organization
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
   *               organization:
   *                 type: object
   *                 required:
   *                   - name
   *                 properties:
   *                   name:
   *                     type: string
   *                   description:
   *                     type: string
   *     responses:
   *       201:
   *         description: User and organization created successfully
   *       409:
   *         description: Email already in use
   */
  register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const registerData: RegisterData = req.body;
    
    const result = await this.authService.register(registerData);
    
    res.status(201).json({
      success: true,
      message: 'User and organization created successfully',
      data: {
        user: result.user.toJSON(),
        tokens: result.tokens,
      },
    });
  });

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     summary: Renovar token de acesso
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *     responses:
   *       200:
   *         description: Tokens renovados com sucesso
   *       401:
   *         description: Refresh token inválido
   */
  refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    
    const tokens = await this.authService.refreshToken(refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Tokens renovados com sucesso',
      data: { tokens },
    });
  });

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     summary: Logout do usuário
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout realizado com sucesso
   */
  logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
      return;
    }

    await this.authService.logout(req.user.id);
    
    res.status(200).json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  });

  /**
   * @swagger
   * /api/v1/auth/change-password:
   *   post:
   *     summary: Alterar senha do usuário
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - currentPassword
   *               - newPassword
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: Senha alterada com sucesso
   *       400:
   *         description: Senha atual incorreta
   */
  changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    
    await this.authService.changePassword(req.user.id, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Senha alterada com sucesso',
    });
  });

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     summary: Obter dados do usuário autenticado
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dados do usuário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   */
  me = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: req.user,
    });
  });

  /**
   * @swagger
   * /api/v1/auth/me:
   *   put:
   *     summary: Atualizar dados do usuário autenticado
   *     tags: [Authentication]
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
   *               email:
   *                 type: string
   *                 format: email
   *               preferences:
   *                 type: string
   *                 description: JSON string containing user preferences
   *     responses:
   *       200:
   *         description: Dados do usuário atualizados com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       400:
   *         description: Dados inválidos
   */
  updateMe = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado',
      });
      return;
    }

    const updateData = req.body;

    const updatedUser = await this.authService.updateUser(req.user.id, updateData);

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  });
}