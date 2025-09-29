import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsOptional, Length, IsDateString } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Organization } from './OrganizationEntities';

// Person Entity - Must be declared first since other entities reference it
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

// PersonType Entity
@Entity('person_types')
export class PersonType extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  type!: string; // member, employee, student, teacher, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsString()
  @Length(0, 255)
  description?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: string;

  @Column({ name: 'person_id', nullable: false })
  personId!: number;

  @ManyToOne(() => Person, (person) => person.types, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'person_id' })
  person!: Person;
}

// PersonFace Entity
@Entity('person_faces')
export class PersonFace extends BaseEntity {
  @Column({
    type: 'text',
    nullable: true
  })
  biometricParameters?: string; // JSON string

  @Column({
    type: 'blob',
    nullable: true
  })
  embedding?: Buffer; // Binary data for face embedding (blob for SQLite)

  @Column({
    type: 'float',
    nullable: true
  })
  reliability?: number;

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
  notes?: string;

  @Column({ name: 'person_id', nullable: false })
  personId!: number;

  @ManyToOne(() => Person, (person) => person.faces, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'person_id' })
  person!: Person;
}

// PersonContact Entity
@Entity('person_contacts')
export class PersonContact extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false
  })
  @IsString()
  @Length(1, 50)
  type!: string; // email, phone, mobile, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  value!: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  isPrimary!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: string;

  @Column({ name: 'person_id', nullable: false })
  personId!: number;

  @ManyToOne(() => Person, (person) => person.contacts, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'person_id' })
  person!: Person;
}

// PersonAddress Entity
@Entity('person_addresses')
export class PersonAddress extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 50,
    nullable: false
  })
  @IsString()
  @Length(1, 50)
  type!: string; // residential, commercial, etc.

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  street!: string;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  number?: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  complement?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  neighborhood!: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  city!: string;

  @Column({
    type: 'varchar',
    length: 2,
    nullable: false
  })
  @IsString()
  @Length(2, 2)
  state!: string;

  @Column({
    type: 'varchar',
    length: 10,
    nullable: true
  })
  zipCode?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    default: 'Brazil'
  })
  @IsString()
  country!: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  isPrimary!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: string;

  @Column({ name: 'person_id', nullable: false })
  personId!: number;

  @ManyToOne(() => Person, (person) => person.addresses, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'person_id' })
  person!: Person;
}