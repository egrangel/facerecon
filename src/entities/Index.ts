// PersonType Entity
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IsString, Length } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Person } from './Person';

@Entity('person_types')
class PersonType extends BaseEntity {
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
class PersonFace extends BaseEntity {
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
class PersonContact extends BaseEntity {
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
class PersonAddress extends BaseEntity {
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

// Export all entities
export { PersonType, PersonFace, PersonContact, PersonAddress };
export { Person } from './Person';
export { Organization } from './Organization';
export { User } from './User';
export { Event, Camera, Detection, EventCamera } from './EventEntities';