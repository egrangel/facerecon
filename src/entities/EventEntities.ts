import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsString, IsOptional, Length, IsDateString, IsNumber } from 'class-validator';
import { BaseEntity } from './BaseEntity';
import { Organization } from './Organization';
import { PersonFace } from './index';

// Event Entity
@Entity('events')
class Event extends BaseEntity {
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
    length: 100,
    nullable: false
  })
  @IsString()
  @Length(1, 100)
  type!: string; // entry, exit, detection, scheduled, etc.

  @Column({
    type: 'datetime',
    nullable: true
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: Date; // For occurred events

  // Scheduling fields
  @Column({
    type: 'boolean',
    nullable: false,
    default: false
  })
  isScheduled!: boolean; // If true, this is a scheduled event

  @Column({
    type: 'boolean',
    nullable: false,
    default: true
  })
  isActive!: boolean; // If false, event is disabled

  @Column({
    type: 'date',
    nullable: true
  })
  @IsOptional()
  @IsDateString()
  scheduledDate?: Date; // Specific date for one-time events

  @Column({
    type: 'time',
    nullable: true
  })
  @IsOptional()
  startTime?: string; // Format: HH:MM

  @Column({
    type: 'time',
    nullable: true
  })
  @IsOptional()
  endTime?: string; // Format: HH:MM

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true
  })
  @IsOptional()
  @IsString()
  weekDays?: string; // JSON array: ["monday", "tuesday"] or comma-separated

  @Column({
    type: 'varchar',
    length: 20,
    nullable: false,
    default: 'once'
  })
  @IsString()
  recurrenceType!: string; // 'once', 'daily', 'weekly', 'monthly'

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
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
  location?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  coordinates?: string; // JSON string: x, y, width, height of detected face

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  @IsString()
  notes?: string;

  // Foreign Keys
  @Column({ name: 'organization_id', nullable: false })
  organizationId!: number;

  // Relationships
  @ManyToOne(() => Organization, (organization) => organization.events, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => Detection, (detection) => detection.event, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  detections!: Detection[];

  @OneToMany(() => EventCamera, (eventCamera) => eventCamera.event, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  eventCameras!: EventCamera[];

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  metadata?: string; // JSON string
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
  name!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  @IsOptional()
  @IsString()
  description?: string;

  @Column({
    type: 'varchar',
    length: 500,
    nullable: true
  })
  @IsOptional()
  @IsString()
  streamUrl?: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
    default: 'RTSP'
  })
  @IsString()
  protocol!: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: string;

  @Column({
    type: 'boolean',
    nullable: false,
    default: true
  })
  isActive!: boolean;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  settings?: string; // JSON string

  @Column({ name: 'organization_id', nullable: false })
  organizationId!: number;

  @ManyToOne(() => Organization, (organization) => organization.cameras, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @OneToMany(() => Detection, (detection) => detection.camera, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  detections!: Detection[];

  @OneToMany(() => EventCamera, (eventCamera) => eventCamera.camera, {
    cascade: true,
    onDelete: 'CASCADE'
  })
  eventCameras!: EventCamera[];
}

// Detection Entity
@Entity('detections')
class Detection extends BaseEntity {
  @Column({
    type: 'datetime',
    nullable: false
  })
  @IsDateString()
  detectedAt!: Date;

  @Column({
    type: 'float',
    nullable: false
  })
  @IsNumber()
  confidence!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'detected'
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
  imageUrl?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  metadata?: string; // JSON string

  // Foreign Keys
  @Column({ name: 'event_id', nullable: false })
  eventId!: number;

  @Column({ name: 'person_face_id', nullable: false })
  personFaceId!: number;

  @Column({ name: 'camera_id', nullable: true })
  cameraId?: number;

  @Column({ name: 'organization_id', nullable: false })
  organizationId!: number;
  
  // Relationships
  @ManyToOne(() => Event, (event) => event.detections, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @ManyToOne(() => PersonFace, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'person_face_id' })
  personFace!: PersonFace;

  @ManyToOne(() => Camera, (camera) => camera.detections, {
    nullable: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'camera_id' })
  camera?: Camera;

  @ManyToOne(() => Organization, {
    nullable: false
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;
}

// EventCamera Association Entity
@Entity('event_cameras')
class EventCamera extends BaseEntity {
  @Column({ name: 'event_id', nullable: false })
  eventId!: number;

  @Column({ name: 'camera_id', nullable: false })
  cameraId!: number;

  @Column({
    type: 'boolean',
    nullable: false,
    default: true
  })
  isActive!: boolean; // Individual camera can be disabled for this event

  @Column({
    type: 'text',
    nullable: true
  })
  @IsOptional()
  settings?: string; // JSON string for camera-specific settings

  // Relationships
  @ManyToOne(() => Event, (event) => event.eventCameras, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @ManyToOne(() => Camera, (camera) => camera.eventCameras, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'camera_id' })
  camera!: Camera;
}

export { Event, Camera, Detection, EventCamera };