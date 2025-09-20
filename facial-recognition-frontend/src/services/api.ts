import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  ApiResponse,
  PaginatedResponse,
  QueryParams,
  User,
  Cadastro,
  Pessoa,
  PessoaFace,
  PessoaContato,
  PessoaEndereco,
  Evento,
  Camera,
  Deteccao,
  BaseEntity
} from '../types/api';

class ApiClient {
  private client: AxiosInstance;
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

  constructor() {
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Try to refresh token
          try {
            await this.refreshToken();
            // Retry original request
            return this.client.request(error.config);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth methods
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.client.post('/auth/login', credentials);
    const { tokens } = response.data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    return response.data;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.client.post('/auth/register', data);
    const { tokens } = response.data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    return response.data;
  }

  async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const response: AxiosResponse<{ accessToken: string; refreshToken: string }> =
      await this.client.post('/auth/refresh', { refreshToken });

    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response: AxiosResponse<User> = await this.client.get('/auth/me');
    return response.data;
  }

  // Generic CRUD methods
  private async get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    const response: AxiosResponse<T> = await this.client.get(endpoint, { params });
    return response.data;
  }

  private async getPaginated<T>(endpoint: string, params?: QueryParams): Promise<PaginatedResponse<T>> {
    const response: AxiosResponse<PaginatedResponse<T>> = await this.client.get(endpoint, { params });
    return response.data;
  }

  private async post<T>(endpoint: string, data: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(endpoint, data);
    return response.data;
  }

  private async put<T>(endpoint: string, data: any): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(endpoint, data);
    return response.data;
  }

  private async delete(endpoint: string): Promise<void> {
    await this.client.delete(endpoint);
  }

  // Cadastro methods
  async getCadastros(params?: QueryParams): Promise<PaginatedResponse<Cadastro>> {
    return this.getPaginated<Cadastro>('/cadastros', params);
  }

  async getCadastro(id: number): Promise<Cadastro> {
    return this.get<Cadastro>(`/cadastros/${id}`);
  }

  async createCadastro(data: Omit<Cadastro, keyof BaseEntity>): Promise<Cadastro> {
    return this.post<Cadastro>('/cadastros', data);
  }

  async updateCadastro(id: number, data: Partial<Cadastro>): Promise<Cadastro> {
    return this.put<Cadastro>(`/cadastros/${id}`, data);
  }

  async deleteCadastro(id: number): Promise<void> {
    return this.delete(`/cadastros/${id}`);
  }

  // Pessoa methods
  async getPessoas(params?: QueryParams): Promise<PaginatedResponse<Pessoa>> {
    return this.getPaginated<Pessoa>('/pessoas', params);
  }

  async getPessoa(id: number): Promise<Pessoa> {
    return this.get<Pessoa>(`/pessoas/${id}`);
  }

  async createPessoa(data: Omit<Pessoa, keyof BaseEntity>): Promise<Pessoa> {
    return this.post<Pessoa>('/pessoas', data);
  }

  async updatePessoa(id: number, data: Partial<Pessoa>): Promise<Pessoa> {
    return this.put<Pessoa>(`/pessoas/${id}`, data);
  }

  async deletePessoa(id: number): Promise<void> {
    return this.delete(`/pessoas/${id}`);
  }

  // Camera methods
  async getCameras(params?: QueryParams): Promise<PaginatedResponse<Camera>> {
    return this.getPaginated<Camera>('/cameras', params);
  }

  async getCamera(id: number): Promise<Camera> {
    return this.get<Camera>(`/cameras/${id}`);
  }

  async createCamera(data: Omit<Camera, keyof BaseEntity>): Promise<Camera> {
    return this.post<Camera>('/cameras', data);
  }

  async updateCamera(id: number, data: Partial<Camera>): Promise<Camera> {
    return this.put<Camera>(`/cameras/${id}`, data);
  }

  async deleteCamera(id: number): Promise<void> {
    return this.delete(`/cameras/${id}`);
  }

  // Evento methods
  async getEventos(params?: QueryParams): Promise<PaginatedResponse<Evento>> {
    return this.getPaginated<Evento>('/eventos', params);
  }

  async getEvento(id: number): Promise<Evento> {
    return this.get<Evento>(`/eventos/${id}`);
  }

  async createEvento(data: Omit<Evento, keyof BaseEntity>): Promise<Evento> {
    return this.post<Evento>('/eventos', data);
  }

  async updateEvento(id: number, data: Partial<Evento>): Promise<Evento> {
    return this.put<Evento>(`/eventos/${id}`, data);
  }

  async deleteEvento(id: number): Promise<void> {
    return this.delete(`/eventos/${id}`);
  }

  // Deteccao methods
  async getDeteccoes(params?: QueryParams): Promise<PaginatedResponse<Deteccao>> {
    return this.getPaginated<Deteccao>('/deteccoes', params);
  }

  async getDeteccao(id: number): Promise<Deteccao> {
    return this.get<Deteccao>(`/deteccoes/${id}`);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.get<ApiResponse<any>>('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;