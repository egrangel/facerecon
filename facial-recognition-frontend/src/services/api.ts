import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  ApiResponse,
  PaginatedResponse,
  QueryParams,
  User,
  Person,
  Organization,
  Event,
  Camera,
  Detection,
  EventCamera,
  BaseEntity
} from '../types/api';

class ApiClient {
  private client: AxiosInstance;
  private baseURL = process.env.REACT_APP_API_URL;

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
        const isAuthEndpoint = error.config?.url?.includes('/auth/');

        if (error.response?.status === 401 && !isAuthEndpoint) {
          // Try to refresh token only for non-auth endpoints
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
    const response: AxiosResponse<{ success: boolean; data: AuthResponse }> = await this.client.post('/auth/login', credentials);
    const { data } = response.data;
    const { tokens } = data;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    return data;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response: AxiosResponse<{ success: boolean; data: AuthResponse }> = await this.client.post('/auth/register', data);
    const { data: responseData } = response.data;
    const { tokens } = responseData;

    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);

    return responseData;
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
    const response: AxiosResponse<{ success: boolean; data: User }> = await this.client.get('/auth/me');
    return response.data.data;
  }

  async updateCurrentUser(data: Partial<User>): Promise<User> {
    const response: AxiosResponse<{ success: boolean; data: User }> = await this.client.put('/auth/me', data);
    return response.data.data;
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

  // Organization methods
  async getOrganizations(params?: QueryParams): Promise<PaginatedResponse<Organization>> {
    return this.getPaginated<Organization>('/organizations', params);
  }

  async getOrganization(id: number): Promise<Organization> {
    return this.get<Organization>(`/organizations/${id}`);
  }

  async createOrganization(data: Omit<Organization, keyof BaseEntity>): Promise<Organization> {
    return this.post<Organization>('/organizations', data);
  }

  async updateOrganization(id: number, data: Partial<Organization>): Promise<Organization> {
    return this.put<Organization>(`/organizations/${id}`, data);
  }

  async deleteOrganization(id: number): Promise<void> {
    return this.delete(`/organizations/${id}`);
  }

  // Person methods
  async getPeople(params?: QueryParams): Promise<PaginatedResponse<Person>> {
    return this.getPaginated<Person>('/people', params);
  }

  async getPerson(id: number): Promise<Person> {
    return this.get<Person>(`/people/${id}`);
  }

  async createPerson(data: Omit<Person, keyof BaseEntity>): Promise<Person> {
    return this.post<Person>('/people', data);
  }

  async updatePerson(id: number, data: Partial<Person>): Promise<Person> {
    return this.put<Person>(`/people/${id}`, data);
  }

  async deletePerson(id: number): Promise<void> {
    return this.delete(`/people/${id}`);
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

  // Event methods
  async getEvents(params?: QueryParams): Promise<PaginatedResponse<Event>> {
    return this.getPaginated<Event>('/events', params);
  }

  async getEvent(id: number): Promise<Event> {
    const response = await this.get<ApiResponse<Event>>(`/events/${id}`);
    if (!response.data) {
      throw new Error('Event not found');
    }
    return response.data;
  }

  async createEvent(data: Omit<Event, keyof BaseEntity>): Promise<Event> {
    const response = await this.post<ApiResponse<Event>>('/events', data);
    if (!response.data) {
      throw new Error('Failed to create event');
    }
    return response.data;
  }

  async updateEvent(id: number, data: Partial<Event>): Promise<Event> {
    const response = await this.put<ApiResponse<Event>>(`/events/${id}`, data);
    if (!response.data) {
      throw new Error('Failed to update event');
    }
    return response.data;
  }

  async deleteEvent(id: number): Promise<void> {
    return this.delete(`/events/${id}`);
  }

  // Event-Camera Association methods
  async getEventCameras(eventId: number): Promise<ApiResponse<EventCamera[]>> {
    return this.get<ApiResponse<EventCamera[]>>(`/events/${eventId}/cameras`);
  }

  async getActiveEventCameras(eventId: number): Promise<ApiResponse<EventCamera[]>> {
    return this.get<ApiResponse<EventCamera[]>>(`/events/${eventId}/cameras/active`);
  }

  async addCameraToEvent(eventId: number, cameraId: number, settings?: string): Promise<ApiResponse<EventCamera>> {
    return this.post<ApiResponse<EventCamera>>(`/events/${eventId}/cameras/${cameraId}`, { settings });
  }

  async removeCameraFromEvent(eventId: number, cameraId: number): Promise<void> {
    return this.delete(`/events/${eventId}/cameras/${cameraId}`);
  }

  async toggleCameraInEvent(eventId: number, cameraId: number): Promise<ApiResponse<EventCamera>> {
    return this.put<ApiResponse<EventCamera>>(`/events/${eventId}/cameras/${cameraId}/toggle`, {});
  }

  // Event Scheduler methods
  async getSchedulerHealth(): Promise<ApiResponse<any>> {
    return this.get<ApiResponse<any>>('/events/scheduler/health');
  }

  async getActiveSessions(): Promise<ApiResponse<any[]>> {
    return this.get<ApiResponse<any[]>>('/events/scheduler/sessions');
  }

  async getScheduledEvents(): Promise<ApiResponse<Event[]>> {
    return this.get<ApiResponse<Event[]>>('/events/scheduled');
  }

  async manuallyStartEvent(eventId: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<ApiResponse<{ success: boolean }>>(`/events/${eventId}/start`, {});
  }

  async manuallyStopEvent(eventId: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.post<ApiResponse<{ success: boolean }>>(`/events/${eventId}/stop`, {});
  }

  async toggleEventStatus(eventId: number): Promise<ApiResponse<Event>> {
    const response: AxiosResponse<ApiResponse<Event>> = await this.client.patch(`/events/${eventId}/toggle-status`, {});
    return response.data;
  }

  // Detection methods
  async getDetections(params?: QueryParams): Promise<PaginatedResponse<Detection>> {
    return this.getPaginated<Detection>('/detections', params);
  }

  async getDetection(id: number): Promise<Detection> {
    return this.get<Detection>(`/detections/${id}`);
  }

  async associateDetectionToExistingPerson(detectionId: number, personId: number): Promise<ApiResponse<Detection>> {
    return this.post<ApiResponse<Detection>>(`/detections/${detectionId}/associate-existing-person`, { personId });
  }

  async createPersonFromDetection(detectionId: number, personData: Omit<Person, keyof BaseEntity>): Promise<ApiResponse<Detection>> {
    return this.post<ApiResponse<Detection>>(`/detections/${detectionId}/create-new-person`, { personData });
  }

  async unmatchPersonFromDetection(detectionId: number): Promise<ApiResponse<Detection>> {
    return this.post<ApiResponse<Detection>>(`/detections/${detectionId}/unmatch-person`, {});
  }

  async getLatestDetectionForPerson(personId: number): Promise<ApiResponse<Detection>> {
    return this.get<ApiResponse<Detection>>(`/detections/person/${personId}/latest`);
  }

  async confirmDetection(detectionId: number): Promise<ApiResponse<Detection>> {
    return this.post<ApiResponse<Detection>>(`/detections/${detectionId}/confirm`, {});
  }

  async checkPersonFaceRecords(personId: number): Promise<ApiResponse<{
    personId: number;
    personName: string;
    hasRecords: boolean;
    count: number;
    activeRecords: number;
    faces?: any[];
  }>> {
    return this.get<ApiResponse<any>>(`/detections/person/${personId}/face-records`);
  }

  // User methods
  async getUsers(params?: QueryParams): Promise<PaginatedResponse<User>> {
    return this.getPaginated<User>('/users', params);
  }

  async getUser(id: number): Promise<User> {
    return this.get<User>(`/users/${id}`);
  }

  async createUser(data: Omit<User, keyof BaseEntity>): Promise<User> {
    return this.post<User>('/users', data);
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    return this.put<User>(`/users/${id}`, data);
  }

  async deleteUser(id: number): Promise<void> {
    return this.delete(`/users/${id}`);
  }

  // Settings methods
  async getCurrentOrganization(): Promise<Organization> {
    const response: AxiosResponse<{ success: boolean; data: Organization }> = await this.client.get('/settings/organization');
    return response.data.data;
  }

  async updateCurrentOrganization(data: Partial<Organization>): Promise<Organization> {
    const response: AxiosResponse<{ success: boolean; data: Organization }> = await this.client.put('/settings/organization', data);
    return response.data.data;
  }

  // Streaming methods
  async startCameraStream(cameraId: number): Promise<{ sessionId: string; streamUrl: string }> {
    const response: AxiosResponse<{ success: boolean; data: { sessionId: string; streamUrl: string; cameraId: number; rtspUrl: string } }> =
      await this.client.post(`/streams/start/${cameraId}`);
    return response.data.data;
  }

  async stopStream(sessionId: string): Promise<void> {
    await this.client.post(`/streams/stop/${sessionId}`);
  }

  async getStreamStatus(sessionId: string): Promise<{ sessionId: string; isActive: boolean; streamUrl: string | null }> {
    const response: AxiosResponse<{ success: boolean; data: { sessionId: string; isActive: boolean; streamUrl: string | null } }> =
      await this.client.get(`/streams/status/${sessionId}`);
    return response.data.data;
  }

  async getCameraStreamUrl(cameraId: number): Promise<{ sessionId: string; streamUrl: string }> {
    // Get WebSocket stream URL for video display only (no facial recognition)
    const response: AxiosResponse<{ success: boolean; data: { sessionId: string; streamUrl: string; cameraId: number } }> =
      await this.client.get(`/streams/camera/${cameraId}/url`);
    return response.data.data;
  }

  async startFaceRecognition(cameraId: number): Promise<{ success: boolean; message: string }> {
    // Start background facial recognition independently of video streaming
    const response: AxiosResponse<{ success: boolean; message: string }> =
      await this.client.post(`/face-recognition/camera/${cameraId}/start`);
    return response.data;
  }

  async stopFaceRecognition(cameraId: number): Promise<{ success: boolean; message: string }> {
    // Stop background facial recognition
    const response: AxiosResponse<{ success: boolean; message: string }> =
      await this.client.post(`/face-recognition/camera/${cameraId}/stop`);
    return response.data;
  }

  async getFaceRecognitionStatus(cameraId: number): Promise<{ isActive: boolean; sessionId?: string }> {
    // Get facial recognition status for a camera
    const response: AxiosResponse<{ success: boolean; data: { isActive: boolean; sessionId?: string } }> =
      await this.client.get(`/face-recognition/camera/${cameraId}/status`);
    return response.data.data;
  }

  async getActiveStreams(): Promise<Array<{ sessionId: string; cameraId: number; streamUrl: string; createdAt: string; lastAccessed: string }>> {
    const response: AxiosResponse<{ success: boolean; data: Array<{ sessionId: string; cameraId: number; streamUrl: string; createdAt: string; lastAccessed: string }> }> =
      await this.client.get('/streams/active');
    return response.data.data;
  }

  async getStreamingHealth(): Promise<{ activeSessions: number; streamDirectory: string; uptime: number }> {
    const response: AxiosResponse<{ success: boolean; data: { activeSessions: number; streamDirectory: string; uptime: number } }> =
      await this.client.get('/streams/health');
    return response.data.data;
  }

  async getOrganizationUsers(): Promise<User[]> {
    const response: AxiosResponse<{ success: boolean; data: User[] }> = await this.client.get('/settings/users');
    return response.data.data;
  }

  async createOrganizationUser(data: {
    email: string;
    password: string;
    name: string;
    role?: 'admin' | 'user' | 'operator';
  }): Promise<User> {
    return this.post<User>('/settings/users', data);
  }

  async updateOrganizationUser(id: number, data: Partial<User>): Promise<User> {
    return this.put<User>(`/settings/users/${id}`, data);
  }

  async deleteOrganizationUser(id: number): Promise<void> {
    return this.delete(`/settings/users/${id}`);
  }

  // Stats methods
  async getStats(): Promise<{
    totalPeople: number;
    totalCameras: number;
    totalUsuarios: number;
    recentRegistrations: Array<{
      id: number;
      type: 'person' | 'camera' | 'user';
      name: string;
      date: string;
    }>;
  }> {
    try {
      const [peopleResponse, camerasResponse, usersResponse] = await Promise.all([
        this.getPeople({ limit: 1 }),
        this.getCameras({ limit: 1 }),
        this.getUsers({ limit: 1 })
      ]);

      const [recentPeople, recentCameras, recentUsers] = await Promise.all([
        this.getPeople({ limit: 2, sort: 'createdAt', order: 'desc' }),
        this.getCameras({ limit: 2, sort: 'createdAt', order: 'desc' }),
        this.getUsers({ limit: 1, sort: 'createdAt', order: 'desc' })
      ]);

      const recentRegistrations = [
        ...(recentPeople?.data || []).map(person => ({
          id: person.id,
          type: 'person' as const,
          name: person.name,
          date: person.createdAt
        })),
        ...(recentCameras?.data || []).map(camera => ({
          id: camera.id,
          type: 'camera' as const,
          name: camera.name,
          date: camera.createdAt
        })),
        ...(recentUsers?.data || []).map(user => ({
          id: user.id,
          type: 'user' as const,
          name: user.name,
          date: user.createdAt
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      return {
        totalPeople: peopleResponse?.total || 0,
        totalCameras: camerasResponse?.total || 0,
        totalUsuarios: usersResponse?.total || 0,
        recentRegistrations
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        totalPeople: 0,
        totalCameras: 0,
        totalUsuarios: 0,
        recentRegistrations: []
      };
    }
  }

  // Dashboard specific methods
  async getDashboardStats(): Promise<{
    totalPeople: number;
    detectionsToday: number;
    activeCameras: number;
    eventsToday: number;
    changes: {
      totalPeople: { value: string; type: 'increase' | 'decrease' | 'neutral' };
      detectionsToday: { value: string; type: 'increase' | 'decrease' | 'neutral' };
      activeCameras: { value: string; type: 'increase' | 'decrease' | 'neutral' };
      eventsToday: { value: string; type: 'increase' | 'decrease' | 'neutral' };
    };
    recentActivity: Array<{
      id: number;
      content: string;
      time: string;
      type: 'person' | 'detection' | 'camera' | 'event' | 'system';
    }>;
  }> {
    try {
      const response: AxiosResponse<{ success: boolean; data: any }> = await this.client.get('/dashboard/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalPeople: 0,
        detectionsToday: 0,
        activeCameras: 0,
        eventsToday: 0,
        changes: {
          totalPeople: { value: '0%', type: 'neutral' },
          detectionsToday: { value: '0%', type: 'neutral' },
          activeCameras: { value: '0%', type: 'neutral' },
          eventsToday: { value: '0%', type: 'neutral' }
        },
        recentActivity: []
      };
    }
  }

  private formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'Agora mesmo';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minuto${minutes > 1 ? 's' : ''} atrás`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hora${hours > 1 ? 's' : ''} atrás`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} dia${days > 1 ? 's' : ''} atrás`;
    }
  }

  async getSystemStatus(): Promise<{
    api: { status: 'online' | 'offline' | 'error'; message: string };
    database: { status: 'connected' | 'disconnected' | 'error'; message: string };
    ai: { status: 'online' | 'limited' | 'offline'; message: string };
    storage: { status: 'available' | 'warning' | 'full'; message: string; percentage: number };
  }> {
    try {
      const response: AxiosResponse<{ success: boolean; data: any }> = await this.client.get('/dashboard/system-status');
      return response.data.data;
    } catch (error) {
      return {
        api: { status: 'error', message: 'Erro de conexão' },
        database: { status: 'error', message: 'Falha na conexão' },
        ai: { status: 'offline', message: 'Offline' },
        storage: { status: 'warning', message: 'Status desconhecido', percentage: 0 }
      };
    }
  }

  // Reports methods
  async getAttendanceFrequencyReport(params?: {
    eventIds?: number[];
  }): Promise<ApiResponse<Array<{
    personName: string;
    personId: number;
    count: number;
    percentage: number;
  }>>> {
    return this.get<ApiResponse<any>>('/reports/attendance-frequency', params);
  }

  async getEventFrequencyReport(params?: {
    eventIds?: number[];
  }): Promise<ApiResponse<Array<{
    eventName: string;
    eventId: number;
    count: number;
    percentage: number;
  }>>> {
    return this.get<ApiResponse<any>>('/reports/event-frequency', params);
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    return this.get<ApiResponse<any>>('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;