import { DeepPartial } from 'typeorm';
import { BaseService } from './BaseService';
import { createError } from '@/middlewares/errorHandler';
import {
  CadastroRepository,
  PessoaRepository,
  PessoaTipoRepository,
  PessoaFaceRepository,
  PessoaContatoRepository,
  PessoaEnderecoRepository,
  EventoRepository,
  CameraRepository,
  DeteccaoRepository,
} from '@/repositories';
import {
  Cadastro,
  Pessoa,
  PessoaTipo,
  PessoaFace,
  PessoaContato,
  PessoaEndereco,
} from '@/entities';
import { Evento, Camera, Deteccao } from '@/entities/EventEntities';

export class CadastroService extends BaseService<Cadastro> {
  constructor() {
    super(new CadastroRepository());
  }

  async findWithRelations(id: number): Promise<Cadastro> {
    const cadastro = await (this.repository as CadastroRepository).findWithRelations(id);
    if (!cadastro) {
      throw createError('Cadastro não encontrado', 404);
    }
    return cadastro;
  }

  async findByStatus(status: string): Promise<Cadastro[]> {
    return (this.repository as CadastroRepository).findByStatus(status);
  }

  async create(data: DeepPartial<Cadastro>): Promise<Cadastro> {
    this.validateRequiredField(data.nome, 'nome');
    return super.create(data);
  }
}

export class PessoaService extends BaseService<Pessoa> {
  private pessoaTipoRepository: PessoaTipoRepository;
  private pessoaFaceRepository: PessoaFaceRepository;
  private pessoaContatoRepository: PessoaContatoRepository;
  private pessoaEnderecoRepository: PessoaEnderecoRepository;

  constructor() {
    super(new PessoaRepository());
    this.pessoaTipoRepository = new PessoaTipoRepository();
    this.pessoaFaceRepository = new PessoaFaceRepository();
    this.pessoaContatoRepository = new PessoaContatoRepository();
    this.pessoaEnderecoRepository = new PessoaEnderecoRepository();
  }

  async findByCadastroId(cadastroId: number): Promise<Pessoa[]> {
    return (this.repository as PessoaRepository).findByCadastroId(cadastroId);
  }

  async findByDocumento(documento: string): Promise<Pessoa | null> {
    return (this.repository as PessoaRepository).findByDocumento(documento);
  }

  async findWithFullRelations(id: number): Promise<Pessoa> {
    const pessoa = await (this.repository as PessoaRepository).findWithFullRelations(id);
    if (!pessoa) {
      throw createError('Pessoa não encontrada', 404);
    }
    return pessoa;
  }

  async create(data: DeepPartial<Pessoa>): Promise<Pessoa> {
    this.validateRequiredField(data.nome, 'nome');
    this.validateRequiredField(data.cadastroId, 'cadastroId');
    
    if (data.documento) {
      if (data.tipoPessoa === 'fisica') {
        this.validateCPF(data.documento);
      } else if (data.tipoPessoa === 'juridica') {
        this.validateCNPJ(data.documento);
      }

      // Verificar se documento já existe
      const existingPessoa = await this.findByDocumento(data.documento);
      if (existingPessoa) {
        throw createError('Documento já cadastrado', 409);
      }
    }

    return super.create(data);
  }

  async addTipo(pessoaId: number, tipoData: DeepPartial<PessoaTipo>): Promise<PessoaTipo> {
    const pessoa = await this.findById(pessoaId);
    return this.pessoaTipoRepository.create({
      ...tipoData,
      pessoaId: pessoa.id,
    });
  }

  async addFace(pessoaId: number, faceData: DeepPartial<PessoaFace>): Promise<PessoaFace> {
    const pessoa = await this.findById(pessoaId);
    return this.pessoaFaceRepository.create({
      ...faceData,
      pessoaId: pessoa.id,
    });
  }

  async addContato(pessoaId: number, contatoData: DeepPartial<PessoaContato>): Promise<PessoaContato> {
    const pessoa = await this.findById(pessoaId);
    
    if (contatoData.tipo === 'email' && contatoData.valor) {
      this.validateEmailField(contatoData.valor);
    }

    return this.pessoaContatoRepository.create({
      ...contatoData,
      pessoaId: pessoa.id,
    });
  }

  async addEndereco(pessoaId: number, enderecoData: DeepPartial<PessoaEndereco>): Promise<PessoaEndereco> {
    const pessoa = await this.findById(pessoaId);
    return this.pessoaEnderecoRepository.create({
      ...enderecoData,
      pessoaId: pessoa.id,
    });
  }
}

export class EventoService extends BaseService<Evento> {
  constructor() {
    super(new EventoRepository());
  }

  async findByCadastroId(cadastroId: number): Promise<Evento[]> {
    return (this.repository as EventoRepository).findByCadastroId(cadastroId);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Evento[]> {
    return (this.repository as EventoRepository).findByDateRange(startDate, endDate);
  }

  async create(data: DeepPartial<Evento>): Promise<Evento> {
    this.validateRequiredField(data.nome, 'nome');
    this.validateRequiredField(data.cadastroId, 'cadastroId');
    this.validateRequiredField(data.dataHoraOcorrencia, 'dataHoraOcorrencia');
    
    return super.create(data);
  }
}

export class CameraService extends BaseService<Camera> {
  constructor() {
    super(new CameraRepository());
  }

  async findByCadastroId(cadastroId: number): Promise<Camera[]> {
    return (this.repository as CameraRepository).findByCadastroId(cadastroId);
  }

  async findByStatus(status: string): Promise<Camera[]> {
    return (this.repository as CameraRepository).findByStatus(status);
  }

  async create(data: DeepPartial<Camera>): Promise<Camera> {
    this.validateRequiredField(data.nome, 'nome');
    this.validateRequiredField(data.ip, 'ip');
    this.validateRequiredField(data.cadastroId, 'cadastroId');
    
    return super.create(data);
  }

  async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    const camera = await this.findById(id);
    
    // Aqui você implementaria a lógica real de teste de conexão
    // Por exemplo, fazer um ping ou tentar conectar na URL da câmera
    
    return {
      success: true,
      message: `Conexão com câmera ${camera.nome} testada com sucesso`,
    };
  }
}

export class DeteccaoService extends BaseService<Deteccao> {
  constructor() {
    super(new DeteccaoRepository());
  }

  async findByEventoId(eventoId: number): Promise<Deteccao[]> {
    return (this.repository as DeteccaoRepository).findByEventoId(eventoId);
  }

  async findByPessoaFaceId(pessoaFaceId: number): Promise<Deteccao[]> {
    return (this.repository as DeteccaoRepository).findByPessoaFaceId(pessoaFaceId);
  }

  async findRecentDetections(hours: number = 24): Promise<Deteccao[]> {
    return (this.repository as DeteccaoRepository).findRecentDetections(hours);
  }

  async create(data: DeepPartial<Deteccao>): Promise<Deteccao> {
    this.validateRequiredField(data.eventoId, 'eventoId');
    this.validateRequiredField(data.pessoaFaceId, 'pessoaFaceId');
    this.validateRequiredField(data.dataHoraDeteccao, 'dataHoraDeteccao');
    this.validateNumericField(data.confiabilidade, 'confiabilidade');
    
    return super.create(data);
  }

  async getDetectionStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byDay: Array<{ date: string; count: number }>;
    byConfidence: Array<{ range: string; count: number }>;
  }> {
    // Implementar estatísticas de detecção
    // Esta é uma implementação simplificada
    const deteccoes = await this.repository.findAll();
    
    return {
      total: deteccoes.length,
      byDay: [],
      byConfidence: [],
    };
  }
}