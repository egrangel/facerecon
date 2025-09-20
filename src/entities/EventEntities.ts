import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsOptional, Length, IsDateString, IsNumber } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Cadastro } from './Cadastro';
import { PessoaFace } from './index';

// Evento Entity
@Entity('eventos')
class Evento extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  nome!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  @IsString()
  descricao?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  tipo!: string; // entrada, saida, deteccao, etc.

  @Column({
    type: 'datetime',
    nullable: false
  })
  @IsDateString()
  dataHoraOcorrencia!: Date;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  status!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsOptional()
  @IsString()
  local?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  coordenadas?: string; // JSON string: x, y, width, height da face detectada

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  @IsString()
  observacoes?: string;

  // Foreign Keys
  @Column({ name: 'cadastro_id', nullable: false })
  cadastroId!: number;

  // Relationships
  @ManyToOne(() => Cadastro, (cadastro) => cadastro.eventos, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'cadastro_id' })
  cadastro!: Cadastro;

  @OneToMany(() => Deteccao, (deteccao) => deteccao.evento, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  deteccoes!: Deteccao[];

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  metadados?: string; // JSON string
}

// Camera Entity
@Entity('cameras')
class Camera extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  nome!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsOptional()
  @IsString()
  descricao?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  ip!: string;

  @Column({
    type: 'integer',
    nullable: false,
    default: 80
  })
  @IsNumber()
  porta!: number;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true
  })
  @IsOptional()
  @IsString()
  usuario?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsOptional()
  @IsString()
  senha?: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true
  })
  @IsOptional()
  @IsString()
  urlStream?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    default: 'RTSP'
  })
  @IsString()
  protocolo!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsOptional()
  @IsString()
  localizacao?: string;

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
  @IsOptional()
  configuracoes?: string; // JSON string

  @Column({ name: 'cadastro_id', nullable: false })
  cadastroId!: number;

  @ManyToOne(() => Cadastro, (cadastro) => cadastro.cameras, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'cadastro_id' })
  cadastro!: Cadastro;

  @OneToMany(() => Deteccao, (deteccao) => deteccao.camera, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  deteccoes!: Deteccao[];
}

// Deteccao Entity
@Entity('deteccoes')
class Deteccao extends BaseEntity {
  @Column({
    type: 'datetime',
    nullable: false
  })
  @IsDateString()
  dataHoraDeteccao!: Date;

  @Column({
    type: 'float',
    nullable: false
  })
  @IsNumber()
  confiabilidade!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'detectado'
  })
  @IsString()
  status!: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true
  })
  @IsOptional()
  @IsString()
  imagemUrl?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  metadados?: string; // JSON string

  // Foreign Keys
  @Column({ name: 'evento_id', nullable: false })
  eventoId!: number;

  @Column({ name: 'pessoa_face_id', nullable: false })
  pessoaFaceId!: number;

  @Column({ name: 'camera_id', nullable: true })
  cameraId?: number;

  // Relationships
  @ManyToOne(() => Evento, (evento) => evento.deteccoes, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'evento_id' })
  evento!: Evento;

  @ManyToOne(() => PessoaFace, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'pessoa_face_id' })
  pessoaFace!: PessoaFace;

  @ManyToOne(() => Camera, (camera) => camera.deteccoes, {
    nullable: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'camera_id' })
  camera?: Camera;
}

export { Evento, Camera, Deteccao };