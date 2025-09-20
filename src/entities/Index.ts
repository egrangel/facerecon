// PessoaTipo Entity
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IsString, Length } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Pessoa } from './Pessoa';

@Entity('pessoa_tipos')
class PessoaTipo extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  tipo!: string; // member, employee, student, teacher, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsString()
  @Length(0, 255)
  descricao?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  status!: string;

  @Column({ name: 'pessoa_id', nullable: false })
  pessoaId!: number;

  @ManyToOne(() => Pessoa, (pessoa) => pessoa.tipos, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pessoa_id' })
  pessoa!: Pessoa;
}

// PessoaFace Entity
@Entity('pessoa_faces')
class PessoaFace extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true
  })
  @IsString()
  @Length(1, 255)
  faceId!: string; // Biometric identifier

  @Column({
    type: 'text',
    nullable: true
  })
  parametrosBiometricos?: string; // JSON string

  @Column({
    type: 'float',
    nullable: true
  })
  confiabilidade?: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  status!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  observacoes?: string;

  @Column({ name: 'pessoa_id', nullable: false })
  pessoaId!: number;

  @ManyToOne(() => Pessoa, (pessoa) => pessoa.faces, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pessoa_id' })
  pessoa!: Pessoa;
}

// PessoaContato Entity
@Entity('pessoa_contatos')
class PessoaContato extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false
  })
  @IsString()
  @Length(1, 50)
  tipo!: string; // email, telefone, celular, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  valor!: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  principal!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  status!: string;

  @Column({ name: 'pessoa_id', nullable: false })
  pessoaId!: number;

  @ManyToOne(() => Pessoa, (pessoa) => pessoa.contatos, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pessoa_id' })
  pessoa!: Pessoa;
}

// PessoaEndereco Entity
@Entity('pessoa_enderecos')
class PessoaEndereco extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false
  })
  @IsString()
  @Length(1, 50)
  tipo!: string; // residencial, comercial, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  logradouro!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  numero?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  complemento?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  bairro!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  cidade!: string;

  @Column({
    type: 'varchar',
    length: 2,
    nullable: false
  })
  @IsString()
  @Length(2, 2)
  uf!: string;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  cep?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    default: 'Brasil'
  })
  @IsString()
  pais!: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  principal!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  status!: string;

  @Column({ name: 'pessoa_id', nullable: false })
  pessoaId!: number;

  @ManyToOne(() => Pessoa, (pessoa) => pessoa.enderecos, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pessoa_id' })
  pessoa!: Pessoa;
}

// Export all entities
export { PessoaTipo, PessoaFace, PessoaContato, PessoaEndereco };
export { Pessoa } from './Pessoa';
export { Cadastro } from './Cadastro';
export { User } from './User';
export { Evento, Camera, Deteccao } from './EventEntities';