import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsOptional, Length, IsDateString } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Organization } from './Organization';
import { PersonType, PersonFace, PersonContact, PersonAddress } from './index';

@Entity('people')
export class Person extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'individual'
  })
  @IsString()
  @Length(1, 20)
  personType!: 'individual' | 'company';

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  @IsOptional()
  @IsString()
  @Length(11, 14)
  documentNumber?: string; // CPF or CNPJ

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  nationalId?: string; // RG

  @Column({
    type: 'date',
    nullable: true
  })
  @IsOptional()
  @IsDateString()
  birthDate?: Date;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  @IsOptional()
  @IsString()
  gender?: 'M' | 'F' | 'Other';

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  metadata?: string; // JSON string

  // Foreign Keys
  @Column({ name: 'organization_id', nullable: false })
  organizationId!: number;

  // Relationships
  @ManyToOne(() => Organization, (organization) => organization.people, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => PersonType, (personType) => personType.person, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  types!: PersonType[];

  @OneToMany(() => PersonFace, (personFace) => personFace.person, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  faces!: PersonFace[];

  @OneToMany(() => PersonContact, (personContact) => personContact.person, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  contacts!: PersonContact[];

  @OneToMany(() => PersonAddress, (personAddress) => personAddress.person, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  addresses!: PersonAddress[];
}