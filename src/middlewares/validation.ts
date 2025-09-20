import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

export const validateBody = (dtoClass: any) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = plainToClass(dtoClass, req.body);
      const errors = await validate(dto);

      if (errors.length > 0) {
        const errorMessages = errors.map(error => ({
          field: error.property,
          constraints: error.constraints,
        }));

        res.status(400).json({
          success: false,
          message: 'Dados de entrada inválidos',
          errors: errorMessages,
        });
        return;
      }

      req.body = dto;
      next();
    } catch (error) {
      console.error('Erro na validação:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno na validação',
      });
    }
  };
};

export const validateParams = (validationSchema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = validationSchema.validate(req.params);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos',
        details: error.details.map((detail: any) => detail.message),
      });
      return;
    }

    next();
  };
};

export const validateQuery = (validationSchema: any) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = validationSchema.validate(req.query);

    if (error) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros de consulta inválidos',
        details: error.details.map((detail: any) => detail.message),
      });
      return;
    }

    next();
  };
};