import { Entity, Column, OneToMany } from 'typeorm';
import { IsString, IsOptional, Length } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Person } from './Person';
import { Event, Camera, Detection } from './EventEntities';

@Entity('organizations')
export class Organization extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @Length(1, 255)
  name!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  @Length(1, 50)
  status!: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  settings?: string; // JSON string

  // Relationships
  @OneToMany(() => Person, (person) => person.organization, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  people!: Person[];

  @OneToMany(() => Event, (event) => event.organization, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  events!: Event[];

  @OneToMany(() => Camera, (camera) => camera.organization, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  cameras!: Camera[];

  @OneToMany(() => Detection, (detection) => detection.organization, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  detections!: Detection[];
}