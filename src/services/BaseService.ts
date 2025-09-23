import { DeepPartial } from 'typeorm';
import { BaseRepository, PaginationOptions, PaginatedResult } from '@/repositories/BaseRepository';
import { BaseEntity } from '@/entities/BaseEntity';
import { createError } from '@/middlewares/errorHandler';

export abstract class BaseService<T extends BaseEntity> {
  public repository: BaseRepository<T>;

  constructor(repository: BaseRepository<T>) {
    this.repository = repository;
  }

  async findById(id: number, relations?: string[]): Promise<T> {
    const entity = await this.repository.findById(id, relations);
    if (!entity) {
      throw createError('Record not found', 404);
    }
    return entity;
  }

  async findAll(relations?: string[]): Promise<T[]> {
    return this.repository.findAll({ relations });
  }

  async findWithPagination(
    options: PaginationOptions & { relations?: string[] }
  ): Promise<PaginatedResult<T>> {
    return this.repository.findWithPagination(options);
  }

  async create(entityData: DeepPartial<T>): Promise<T> {
    try {
      return await this.repository.create(entityData);
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw createError('Record already exists with the provided data', 409);
      }
      if (error.code === '23503') { // Foreign key violation
        throw createError('Invalid reference in the provided data', 400);
      }
      throw error;
    }
  }

  async update(id: number, entityData: DeepPartial<T>): Promise<T> {
    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw createError('Record not found', 404);
    }

    try {
      const updatedEntity = await this.repository.update(id, entityData);
      if (!updatedEntity) {
        throw createError('Error updating record', 500);
      }
      return updatedEntity;
    } catch (error: any) {
      if (error.code === '23505') { // Unique violation
        throw createError('Unique data already exists', 409);
      }
      if (error.code === '23503') { // Foreign key violation
        throw createError('Invalid reference in the provided data', 400);
      }
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw createError('Record not found', 404);
    }

    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw createError('Error deleting record', 500);
    }
  }

  async hardDelete(id: number): Promise<void> {
    const existingEntity = await this.repository.findById(id);
    if (!existingEntity) {
      throw createError('Record not found', 404);
    }

    const deleted = await this.repository.hardDelete(id);
    if (!deleted) {
      throw createError('Error permanently deleting record', 500);
    }
  }

  async exists(id: number): Promise<boolean> {
    const entity = await this.repository.findById(id);
    return !!entity;
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  // Organization-specific methods
  async findAllByOrganization(organizationId: number, relations?: string[]): Promise<T[]> {
    return this.repository.findAll({
      where: { organizationId } as any,
      relations
    });
  }

  async findByIdAndOrganization(id: number, organizationId: number, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({
      where: { id, organizationId } as any,
      relations
    });
  }

  async updateByOrganization(id: number, organizationId: number, entityData: DeepPartial<T>): Promise<T | null> {
    const existingEntity = await this.findByIdAndOrganization(id, organizationId);
    if (!existingEntity) {
      return null;
    }

    try {
      const updatedEntity = await this.repository.update(id, entityData);
      return updatedEntity;
    } catch (error: any) {
      if (error.code === '23505') {
        throw createError('Unique data already exists', 409);
      }
      if (error.code === '23503') {
        throw createError('Invalid reference in the provided data', 400);
      }
      throw error;
    }
  }

  async deleteByOrganization(id: number, organizationId: number): Promise<boolean> {
    const existingEntity = await this.findByIdAndOrganization(id, organizationId);
    if (!existingEntity) {
      return false;
    }

    return await this.repository.delete(id);
  }

  async countByOrganization(organizationId: number): Promise<number> {
    return this.repository.countWhere({ organizationId } as any);
  }

  protected validateRequiredField(value: any, fieldName: string): void {
    if (!value) {
      throw createError(`Campo ${fieldName} é obrigatório`, 400);
    }
  }

  protected validateNumericField(value: any, fieldName: string): void {
    if (isNaN(value) || value < 0) {
      throw createError(`Campo ${fieldName} deve ser um número válido`, 400);
    }
  }

  protected validateEmailField(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw createError('Email inválido', 400);
    }
  }

  protected validateCPF(cpf: string): void {
    const cpfRegex = /^\d{11}$/;
    if (!cpfRegex.test(cpf)) {
      throw createError('CPF deve ter 11 dígitos', 400);
    }
  }

  protected validateCNPJ(cnpj: string): void {
    const cnpjRegex = /^\d{14}$/;
    if (!cnpjRegex.test(cnpj)) {
      throw createError('CNPJ deve ter 14 dígitos', 400);
    }
  }
}