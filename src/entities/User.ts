import { Entity, Column, BeforeInsert, BeforeUpdate, ManyToOne, JoinColumn } from 'typeorm';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { BaseEntity } from './BaseEntity';
import { Organization } from './Organization';

@Entity('users')
export class User extends BaseEntity {
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    unique: true
  })
  @IsEmail()
  email!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: false
  })
  @IsString()
  @MinLength(6)
  password!: string;

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
    length: 50,
    nullable: false,
    default: 'user'
  })
  @IsString()
  role!: 'admin' | 'user' | 'operator';

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: 'active'
  })
  @IsString()
  status!: 'active' | 'inactive';

  @Column({
    type: 'datetime',
    nullable: true
  })
  lastLoginAt?: Date;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true
  })
  refreshToken?: string;

  @Column({
    type: 'text',
    nullable: true
  })
  preferences?: string; // JSON string

  @Column({
    type: 'integer',
    nullable: true
  })
  organizationId?: number;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword(): Promise<void> {
    if (this.password) {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  toJSON(): Partial<User> {
    const { password, refreshToken, ...result } = this;
    return result;
  }
}