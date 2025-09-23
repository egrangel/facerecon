import { Request, Response } from 'express';
import { BaseService } from '@/services/BaseService';
import { BaseEntity } from '@/entities/BaseEntity';
import { asyncHandler } from '@/middlewares/errorHandler';
import { OrganizationRequest } from '@/middlewares/organizationAccess';

export abstract class BaseController<T extends BaseEntity> {
  protected service: BaseService<T>;

  constructor(service: BaseService<T>) {
    this.service = service;
  }

  findAll = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { page, limit, sortBy, sortOrder, ...filters } = req.query;

    // Add organization filter to all queries
    const organizationFilters = {
      ...filters,
      organizationId: req.organizationId,
    };

    let result;

    if (page && limit) {
      const paginationOptions = {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10,
        sortBy: sortBy as string || 'id',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        where: organizationFilters,
      };

      result = await this.service.findWithPagination(paginationOptions);
    } else {
      const data = await this.service.findAllByOrganization(req.organizationId);
      result = { data };
    }

    res.status(200).json({
      success: true,
      message: 'Registros encontrados com sucesso',
      ...result,
    });
  });

  findById = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const relations = req.query.relations as string[];

    const data = await this.service.findByIdAndOrganization(parseInt(id), req.organizationId, relations);

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Registro não encontrado ou acesso negado',
      });
      return;
    }

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

  update = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.service.updateByOrganization(parseInt(id), req.organizationId, req.body);

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Registro não encontrado ou acesso negado',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Registro atualizado com sucesso',
      data,
    });
  });

  delete = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    const success = await this.service.deleteByOrganization(parseInt(id), req.organizationId);

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Registro não encontrado ou acesso negado',
      });
      return;
    }

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

  count = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const total = await this.service.countByOrganization(req.organizationId);

    res.status(200).json({
      success: true,
      data: { total },
    });
  });
}