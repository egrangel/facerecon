import { Request, Response } from 'express';
import { BaseService } from '@/services/BaseService';
import { BaseEntity } from '@/entities/BaseEntity';
import { asyncHandler } from '@/middlewares/errorHandler';

export abstract class BaseController<T extends BaseEntity> {
  protected service: BaseService<T>;

  constructor(service: BaseService<T>) {
    this.service = service;
  }

  findAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query;
    
    let result;
    
    if (page && limit) {
      const paginationOptions = {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        sortBy: sortBy as string || 'id',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        where: filters,
      };
      
      result = await this.service.findWithPagination(paginationOptions);
    } else {
      const data = await this.service.findAll();
      result = { data };
    }

    res.status(200).json({
      success: true,
      message: 'Registros encontrados com sucesso',
      ...result,
    });
  });

  findById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const relations = req.query.relations as string[];
    
    const data = await this.service.findById(parseInt(id), relations);
    
    res.status(200).json({
      success: true,
      message: 'Registro encontrado com sucesso',
      data,
    });
  });

  create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.create(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Registro criado com sucesso',
      data,
    });
  });

  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.service.update(parseInt(id), req.body);
    
    res.status(200).json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data,
    });
  });

  delete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    await this.service.delete(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Registro excluído com sucesso',
    });
  });

  hardDelete = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    await this.service.hardDelete(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Registro excluído permanentemente com sucesso',
    });
  });

  count = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const total = await this.service.count();
    
    res.status(200).json({
      success: true,
      data: { total },
    });
  });
}