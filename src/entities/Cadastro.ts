import { Entity, Column, OneToMany } from 'typeorm';
import { IsString, IsOptional, Length } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Pessoa } from './Pessoa';
import { Evento, Camera } from './EventEntities';

@Entity('cadastros')
export class Cadastro extends BaseEntity {
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
    length: 50,
    nullable: false,
    default: 'ativo'
  })
  @IsString()
  @Length(1, 50)
  status!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  configuracoes?: string; // JSON string

  // Relationships
  @OneToMany(() => Pessoa, (pessoa) => pessoa.cadastro, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  pessoas!: Pessoa[];

  @OneToMany(() => Evento, (evento) => evento.cadastro, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  eventos!: Evento[];

  @OneToMany(() => Camera, (camera) => camera.cadastro, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  cameras!: Camera[];
}