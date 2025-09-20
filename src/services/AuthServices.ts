import jwt from 'jsonwebtoken';
import { User } from '@/entities/User';
import { UserRepository } from '@/repositories';
import { createError } from '@/middlewares/errorHandler';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nome: string;
  role?: 'admin' | 'user' | 'operator';
}

export class AuthService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: TokenPair }> {
    const { email, password } = credentials;

    // Buscar usuário por email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw createError('Credenciais inválidas', 401);
    }

    // Verificar se o usuário está ativo
    if (user.status !== 'ativo') {
      throw createError('Usuário inativo', 401);
    }

    // Validar senha
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      throw createError('Credenciais inválidas', 401);
    }

    // Gerar tokens
    const tokens = this.generateTokens(user);

    // Salvar refresh token
    await this.userRepository.update(user.id, {
      refreshToken: tokens.refreshToken,
    });

    // Atualizar senha
    await this.userRepository.update(userId, {
      password: newPassword,
    });
  }

  private generateTokens(user: User): TokenPair {
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error('JWT secrets não configurados');
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, jwtSecret, {
      expiresIn: jwtExpiresIn,
    });

    const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
      expiresIn: jwtRefreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<any> {
    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET não configurado');
      }

      return jwt.verify(token, jwtSecret);
    } catch (error) {
      throw createError('Token inválido', 401);
    }
  }
} último login
    await this.userRepository.updateLastLogin(user.id);

    return { user, tokens };
  }

  async register(registerData: RegisterData): Promise<{ user: User; tokens: TokenPair }> {
    const { email, password, nome, role = 'user' } = registerData;

    // Verificar se o usuário já existe
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw createError('Usuário já existe com este email', 409);
    }

    // Criar novo usuário
    const userData = {
      email,
      password,
      nome,
      role,
      status: 'ativo',
    };

    const user = await this.userRepository.create(userData);

    // Gerar tokens
    const tokens = this.generateTokens(user);

    // Salvar refresh token
    await this.userRepository.update(user.id, {
      refreshToken: tokens.refreshToken,
    });

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
      if (!jwtRefreshSecret) {
        throw new Error('JWT_REFRESH_SECRET não configurado');
      }

      // Verificar refresh token
      const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as any;

      // Buscar usuário
      const user = await this.userRepository.findByRefreshToken(refreshToken);
      if (!user || user.id !== decoded.id) {
        throw createError('Refresh token inválido', 401);
      }

      // Verificar se o usuário está ativo
      if (user.status !== 'ativo') {
        throw createError('Usuário inativo', 401);
      }

      // Gerar novos tokens
      const tokens = this.generateTokens(user);

      // Atualizar refresh token no banco
      await this.userRepository.update(user.id, {
        refreshToken: tokens.refreshToken,
      });

      return tokens;
    } catch (error) {
      throw createError('Refresh token inválido', 401);
    }
  }

  async logout(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
    });
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createError('Usuário não encontrado', 404);
    }

    // Verificar senha atual
    const isCurrentPasswordValid = await user.validatePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw createError('Senha atual incorreta', 400);
    }

    // Atualizar