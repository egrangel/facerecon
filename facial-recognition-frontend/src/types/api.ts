export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'admin' | 'user' | 'operator';
  status: string;
  lastLoginAt?: string;
  preferences?: string;
}

export interface Organization extends BaseEntity {
  name: string;
  description?: string;
  status: string;
  settings?: string;
}

export interface Person extends BaseEntity {
  name: string;
  personType: string;
  documentNumber?: string;
  nationalId?: string;
  birthDate?: string;
  gender?: string;
  status: string;
  notes?: string;
  metadata?: string;
  organizationId: number;
  organization?: Organization;
}

export interface PersonFace extends BaseEntity {
  faceId: string;
  biometricParameters?: string;
  reliability?: number;
  status: string;
  notes?: string;
  personId: number;
  person?: Person;
}

export interface PersonContact extends BaseEntity {
  type: string;
  value: string;
  isPrimary: boolean;
  status: string;
  personId: number;
  person?: Person;
}

export interface PersonAddress extends BaseEntity {
  type: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode?: string;
  country: string;
  isPrimary: boolean;
  status: string;
  personId: number;
  person?: Person;
}

export interface Event extends BaseEntity {
  name: string;
  description?: string;
  type: string;
  occurredAt?: string;
  // Scheduling fields
  isScheduled: boolean;
  isActive: boolean;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  weekDays?: string;
  recurrenceType: string;
  status: string;
  notes?: string;
  metadata?: string;
  organizationId: number;
  organization?: Organization;
  eventCameras?: EventCamera[];
}

export interface EventCamera extends BaseEntity {
  eventId: number;
  cameraId: number;
  isActive: boolean;
  settings?: string;
  event?: Event;
  camera?: Camera;
}

export interface Camera extends BaseEntity {
  name: string;
  description?: string;
  streamUrl?: string;
  protocol: string;
  status: string;
  settings?: string;
  organizationId: number;
  organization?: Organization;
  isActive: boolean;
}

export interface Detection extends BaseEntity {
  detectedAt: string;
  confidence: number;
  status: string;
  imageUrl?: string;
  metadata?: string;
  eventId: number;
  personFaceId: number;
  cameraId?: number;
  event?: Event;
  personFace?: PersonFace;
  camera?: Camera;
}


// Auth related interfaces
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'user' | 'operator';
  organization: {
    name: string;
    description?: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}