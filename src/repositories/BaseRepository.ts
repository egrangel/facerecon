import { Repository, FindOptionsWhere, FindManyOptions, DeepPartial } from 'typeorm';
import { BaseEntity } from '@/entities/BaseEntity';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class BaseRepository<T extends BaseEntity> {
  protected repository: Repository<T>;

  constructor(repository: Repository<T>) {
    this.repository = repository;
  }

  async findById(id: number, relations?: string[]): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as FindOptionsWhere<T>,
      relations,
    });
  }

  async findAll(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(options);
  }

  async findWithPagination(
    options: PaginationOptions & { where?: FindOptionsWhere<T>; relations?: string[] }
  ): Promise<PaginatedResult<T>> {
    const { page = 1, limit = 10, sortBy = 'id', sortOrder = 'DESC', where, relations } = options;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await this.repository.findAndCount({
      where,
      relations,
      skip,
      take: limit,
      order: { [sortBy]: sortOrder } as any,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async create(entityData: DeepPartial<T>): Promise<T> {
    const entity = this.repository.create(entityData);
    return this.repository.save(entity);
  }

  async update(id: number, entityData: DeepPartial<T>): Promise<T | null> {
    await this.repository.update(id, entityData as any);
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.softDelete(id);
    return result.affected !== undefined && result.affected > 0;
  }

  async hardDelete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected !== undefined && result.affected > 0;
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.repository.count({ where });
    return count > 0;
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({ where });
  }

  getRepository(): Repository<T> {
    return this.repository;
  }
}