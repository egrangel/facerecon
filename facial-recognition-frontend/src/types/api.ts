export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface User extends BaseEntity {
  email: string;
  nome: string;
  role: 'admin' | 'user' | 'operator';
  status: string;
  lastLoginAt?: string;
  preferences?: string;
}

export interface Cadastro extends BaseEntity {
  nome: string;
  descricao?: string;
  status: string;
  configuracoes?: string;
}

export interface Pessoa extends BaseEntity {
  nome: string;
  tipoPessoa: string;
  documento?: string;
  rg?: string;
  dataNascimento?: string;
  sexo?: string;
  status: string;
  observacoes?: string;
  metadados?: string;
  cadastroId: number;
  cadastro?: Cadastro;
}

export interface PessoaFace extends BaseEntity {
  faceId: string;
  parametrosBiometricos?: string;
  confiabilidade?: number;
  status: string;
  observacoes?: string;
  pessoaId: number;
  pessoa?: Pessoa;
}

export interface PessoaContato extends BaseEntity {
  tipo: string;
  valor: string;
  principal: boolean;
  status: string;
  pessoaId: number;
  pessoa?: Pessoa;
}

export interface PessoaEndereco extends BaseEntity {
  tipo: string;
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep?: string;
  pais: string;
  principal: boolean;
  status: string;
  pessoaId: number;
  pessoa?: Pessoa;
}

export interface Evento extends BaseEntity {
  nome: string;
  descricao?: string;
  tipo: string;
  dataHoraOcorrencia: string;
  status: string;
  local?: string;
  coordenadas?: string;
  observacoes?: string;
  metadados?: string;
  cadastroId: number;
  cadastro?: Cadastro;
}

export interface Camera extends BaseEntity {
  nome: string;
  descricao?: string;
  ip: string;
  porta: number;
  usuario?: string;
  senha?: string;
  urlStream?: string;
  protocolo: string;
  localizacao?: string;
  status: string;
  configuracoes?: string;
  cadastroId: number;
  cadastro?: Cadastro;
}

export interface Deteccao extends BaseEntity {
  dataHoraDeteccao: string;
  confiabilidade: number;
  status: string;
  imagemUrl?: string;
  metadados?: string;
  eventoId: number;
  pessoaFaceId: number;
  cameraId?: number;
  evento?: Evento;
  pessoaFace?: PessoaFace;
  camera?: Camera;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nome: string;
  role?: 'admin' | 'user' | 'operator';
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
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}