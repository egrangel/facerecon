import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsOptional, Length, IsDateString } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Cadastro } from './Cadastro';
import { PessoaTipo } from './PessoaTipo';
import { PessoaFace } from './PessoaFace';
import { PessoaContato } from './PessoaContato';
import { PessoaEndereco } from './PessoaEndereco';

@Entity('pessoas')
export class Pessoa extends BaseEntity {
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
    length: 20,
    nullable: false,
    default: 'fisica'
  })
  @IsString()
  @Length(1, 20)
  tipoPessoa!: 'fisica' | 'juridica';

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    unique: true
  })
  @IsOptional()
  @IsString()
  @Length(11, 14)
  documento?: string; // CPF ou CNPJ

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  rg?: string;

  @Column({
    type: 'date',
    nullable: true
  })
  @IsOptional()
  @IsDateString()
  dataNascimento?: Date;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  @IsOptional()
  @IsString()
  sexo?: 'M' | 'F' | 'Outro';

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
  @IsString()
  observacoes?: string;

  @Column({
    type: 'jsonb',
    nullable: true
  })
  @IsOptional()
  metadados?: Record<string, any>;

  // Foreign Keys
  @Column({ name: 'cadastro_id', nullable: false })
  cadastroId!: number;

  // Relationships
  @ManyToOne(() => Cadastro, (cadastro) => cadastro.pessoas, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'cadastro_id' })
  cadastro!: Cadastro;

  @OneToMany(() => PessoaTipo, (pessoaTipo) => pessoaTipo.pessoa, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  tipos!: PessoaTipo[];

  @OneToMany(() => PessoaFace, (pessoaFace) => pessoaFace.pessoa, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  faces!: PessoaFace[];

  @OneToMany(() => PessoaContato, (pessoaContato) => pessoaContato.pessoa, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  contatos!: PessoaContato[];

  @OneToMany(() => PessoaEndereco, (pessoaEndereco) => pessoaEndereco.pessoa, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  enderecos!: PessoaEndereco[];
}