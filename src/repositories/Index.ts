import { AppDataSource } from '@/config/database';
import { BaseRepository } from './BaseRepository';
import { Cadastro } from '@/entities/Cadastro';
import { Pessoa } from '@/entities/Pessoa';
import { PessoaTipo, PessoaFace, PessoaContato, PessoaEndereco } from '@/entities';
import { Evento, Camera, Deteccao } from '@/entities/EventEntities';
import { User } from '@/entities/User';

export class CadastroRepository extends BaseRepository<Cadastro> {
  constructor() {
    super(AppDataSource.getRepository(Cadastro));
  }

  async findWithRelations(id: number): Promise<Cadastro | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['pessoas', 'eventos', 'cameras'],
    });
  }

  async findByStatus(status: string): Promise<Cadastro[]> {
    return this.repository.find({
      where: { status },
    });
  }
}

export class PessoaRepository extends BaseRepository<Pessoa> {
  constructor() {
    super(AppDataSource.getRepository(Pessoa));
  }

  async findByCadastroId(cadastroId: number): Promise<Pessoa[]> {
    return this.repository.find({
      where: { cadastroId },
      relations: ['tipos', 'faces', 'contatos', 'enderecos'],
    });
  }

  async findByDocumento(documento: string): Promise<Pessoa | null> {
    return this.repository.findOne({
      where: { documento },
      relations: ['cadastro'],
    });
  }

  async findWithFullRelations(id: number): Promise<Pessoa | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['cadastro', 'tipos', 'faces', 'contatos', 'enderecos'],
    });
  }
}

export class PessoaTipoRepository extends BaseRepository<PessoaTipo> {
  constructor() {
    super(AppDataSource.getRepository(PessoaTipo));
  }

  async findByPessoaId(pessoaId: number): Promise<PessoaTipo[]> {
    return this.repository.find({
      where: { pessoaId },
      relations: ['pessoa'],
    });
  }

  async findByTipo(tipo: string): Promise<PessoaTipo[]> {
    return this.repository.find({
      where: { tipo },
      relations: ['pessoa'],
    });
  }
}

export class PessoaFaceRepository extends BaseRepository<PessoaFace> {
  constructor() {
    super(AppDataSource.getRepository(PessoaFace));
  }

  async findByPessoaId(pessoaId: number): Promise<PessoaFace[]> {
    return this.repository.find({
      where: { pessoaId },
      relations: ['pessoa'],
    });
  }

  async findByFaceId(faceId: string): Promise<PessoaFace | null> {
    return this.repository.findOne({
      where: { faceId },
      relations: ['pessoa'],
    });
  }
}

export class PessoaContatoRepository extends BaseRepository<PessoaContato> {
  constructor() {
    super(AppDataSource.getRepository(PessoaContato));
  }

  async findByPessoaId(pessoaId: number): Promise<PessoaContato[]> {
    return this.repository.find({
      where: { pessoaId },
      relations: ['pessoa'],
    });
  }

  async findPrincipalByPessoa(pessoaId: number, tipo: string): Promise<PessoaContato | null> {
    return this.repository.findOne({
      where: { pessoaId, tipo, principal: true },
      relations: ['pessoa'],
    });
  }
}

export class PessoaEnderecoRepository extends BaseRepository<PessoaEndereco> {
  constructor() {
    super(AppDataSource.getRepository(PessoaEndereco));
  }

  async findByPessoaId(pessoaId: number): Promise<PessoaEndereco[]> {
    return this.repository.find({
      where: { pessoaId },
      relations: ['pessoa'],
    });
  }

  async findPrincipalByPessoa(pessoaId: number): Promise<PessoaEndereco | null> {
    return this.repository.findOne({
      where: { pessoaId, principal: true },
      relations: ['pessoa'],
    });
  }
}

export class EventoRepository extends BaseRepository<Evento> {
  constructor() {
    super(AppDataSource.getRepository(Evento));
  }

  async findByCadastroId(cadastroId: number): Promise<Evento[]> {
    return this.repository.find({
      where: { cadastroId },
      relations: ['cadastro', 'deteccoes'],
      order: { dataHoraOcorrencia: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Evento[]> {
    return this.repository
      .createQueryBuilder('evento')
      .where('evento.dataHoraOcorrencia BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .leftJoinAndSelect('evento.cadastro', 'cadastro')
      .leftJoinAndSelect('evento.deteccoes', 'deteccoes')
      .orderBy('evento.dataHoraOcorrencia', 'DESC')
      .getMany();
  }
}

export class CameraRepository extends BaseRepository<Camera> {
  constructor() {
    super(AppDataSource.getRepository(Camera));
  }

  async findByCadastroId(cadastroId: number): Promise<Camera[]> {
    return this.repository.find({
      where: { cadastroId },
      relations: ['cadastro'],
    });
  }

  async findByStatus(status: string): Promise<Camera[]> {
    return this.repository.find({
      where: { status },
      relations: ['cadastro'],
    });
  }
}

export class DeteccaoRepository extends BaseRepository<Deteccao> {
  constructor() {
    super(AppDataSource.getRepository(Deteccao));
  }

  async findByEventoId(eventoId: number): Promise<Deteccao[]> {
    return this.repository.find({
      where: { eventoId },
      relations: ['evento', 'pessoaFace', 'camera'],
    });
  }

  async findByPessoaFaceId(pessoaFaceId: number): Promise<Deteccao[]> {
    return this.repository.find({
      where: { pessoaFaceId },
      relations: ['evento', 'pessoaFace', 'camera'],
      order: { dataHoraDeteccao: 'DESC' },
    });
  }

  async findRecentDetections(hours: number = 24): Promise<Deteccao[]> {
    const dateThreshold = new Date();
    dateThreshold.setHours(dateThreshold.getHours() - hours);

    return this.repository
      .createQueryBuilder('deteccao')
      .where('deteccao.dataHoraDeteccao >= :dateThreshold', { dateThreshold })
      .leftJoinAndSelect('deteccao.evento', 'evento')
      .leftJoinAndSelect('deteccao.pessoaFace', 'pessoaFace')
      .leftJoinAndSelect('pessoaFace.pessoa', 'pessoa')
      .leftJoinAndSelect('deteccao.camera', 'camera')
      .orderBy('deteccao.dataHoraDeteccao', 'DESC')
      .getMany();
  }
}

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(AppDataSource.getRepository(User));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return this.repository.findOne({
      where: { refreshToken },
    });
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.repository.update(userId, {
      lastLoginAt: new Date(),
    });
  }
}