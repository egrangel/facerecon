import { Entity, Column, OneToMany } from 'typeorm';
import { IsString, IsOptional, Length } from 'class-validator';
import { BaseEntity } from './BaseEntity';

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

  // Note: Relationships are declared here but use forward references to avoid circular dependencies
  people!: any[]; // Will be properly typed through index.ts exports
  events!: any[]; // Will be properly typed through index.ts exports
  cameras!: any[]; // Will be properly typed through index.ts exports
  detections!: any[]; // Will be properly typed through index.ts exports
}