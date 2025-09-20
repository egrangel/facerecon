import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { asyncHandler } from '@/middlewares/errorHandler';
import {
  CadastroService,
  PessoaService,
  EventoService,
  CameraService,
  DeteccaoService,
} from '@/services';

export class CadastroController extends BaseController<any> {
  private cadastroService: CadastroService;

  constructor() {
    const service = new CadastroService();
    super(service);
    this.cadastroService = service;
  }

  /**
   * @swagger
   * /api/v1/cadastros/{id}/full:
   *   get:
   *     summary: Buscar cadastro com todas as relações
   *     tags: [Cadastros]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Cadastro encontrado com sucesso
   */
  findWithRelations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.cadastroService.findWithRelations(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Cadastro encontrado com sucesso',
      data,
    });
  });

  findByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    
    const data = await this.cadastroService.findByStatus(status);
    
    res.status(200).json({
      success: true,
      message: 'Cadastros encontrados com sucesso',
      data,
    });
  });
}

export class PessoaController extends BaseController<any> {
  private pessoaService: PessoaService;

  constructor() {
    const service = new PessoaService();
    super(service);
    this.pessoaService = service;
  }

  /**
   * @swagger
   * /api/v1/pessoas/cadastro/{cadastroId}:
   *   get:
   *     summary: Buscar pessoas por cadastro
   *     tags: [Pessoas]
   *     parameters:
   *       - in: path
   *         name: cadastroId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Pessoas encontradas com sucesso
   */
  findByCadastroId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cadastroId } = req.params;
    
    const data = await this.pessoaService.findByCadastroId(parseInt(cadastroId));
    
    res.status(200).json({
      success: true,
      message: 'Pessoas encontradas com sucesso',
      data,
    });
  });

  findByDocumento = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { documento } = req.params;
    
    const data = await this.pessoaService.findByDocumento(documento);
    
    res.status(200).json({
      success: true,
      message: data ? 'Pessoa encontrada com sucesso' : 'Pessoa não encontrada',
      data,
    });
  });

  findWithFullRelations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.pessoaService.findWithFullRelations(parseInt(id));
    
    res.status(200).json({
      success: true,
      message: 'Pessoa encontrada com sucesso',
      data,
    });
  });

  addTipo = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.pessoaService.addTipo(parseInt(id), req.body);
    
    res.status(201).json({
      success: true,
      message: 'Tipo adicionado com sucesso',
      data,
    });
  });

  addFace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.pessoaService.addFace(parseInt(id), req.body);
    
    res.status(201).json({
      success: true,
      message: 'Face adicionada com sucesso',
      data,
    });
  });

  addContato = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.pessoaService.addContato(parseInt(id), req.body);
    
    res.status(201).json({
      success: true,
      message: 'Contato adicionado com sucesso',
      data,
    });
  });

  addEndereco = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const data = await this.pessoaService.addEndereco(parseInt(id), req.body);
    
    res.status(201).json({
      success: true,
      message: 'Endereço adicionado com sucesso',
      data,
    });
  });
}

export class EventoController extends BaseController<any> {
  private eventoService: EventoService;

  constructor() {
    const service = new EventoService();
    super(service);
    this.eventoService = service;
  }

  findByCadastroId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cadastroId } = req.params;
    
    const data = await this.eventoService.findByCadastroId(parseInt(cadastroId));
    
    res.status(200).json({
      success: true,
      message: 'Eventos encontrados com sucesso',
      data,
    });
  });

  findByDateRange = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Parâmetros startDate e endDate são obrigatórios',
      });
      return;
    }

    const data = await this.eventoService.findByDateRange(
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.status(200).json({
      success: true,
      message: 'Eventos encontrados com sucesso',
      data,
    });
  });
}

export class CameraController extends BaseController<any> {
  private cameraService: CameraService;

  constructor() {
    const service = new CameraService();
    super(service);
    this.cameraService = service;
  }

  findByCadastroId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cadastroId } = req.params;
    
    const data = await this.cameraService.findByCadastroId(parseInt(cadastroId));
    
    res.status(200).json({
      success: true,
      message: 'Câmeras encontradas com sucesso',
      data,
    });
  });

  findByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;
    
    const data = await this.cameraService.findByStatus(status);
    
    res.status(200).json({
      success: true,
      message: 'Câmeras encontradas com sucesso',
      data,
    });
  });

  testConnection = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    const result = await this.cameraService.testConnection(parseInt(id));
    
    res.status(200).json({
      success: result.success,
      message: result.message,
    });
  });
}

export class DeteccaoController extends BaseController<any> {
  private deteccaoService: DeteccaoService;

  constructor() {
    const service = new DeteccaoService();
    super(service);
    this.deteccaoService = service;
  }

  findByEventoId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventoId } = req.params;
    
    const data = await this.deteccaoService.findByEventoId(parseInt(eventoId));
    
    res.status(200).json({
      success: true,
      message: 'Detecções encontradas com sucesso',
      data,
    });
  });

  findByPessoaFaceId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { pessoaFaceId } = req.params;
    
    const data = await this.deteccaoService.findByPessoaFaceId(parseInt(pessoaFaceId));
    
    res.status(200).json({
      success: true,
      message: 'Detecções encontradas com sucesso',
      data,
    });
  });

  findRecentDetections = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { hours } = req.query;
    const hoursNumber = hours ? parseInt(hours as string) : 24;
    
    const data = await this.deteccaoService.findRecentDetections(hoursNumber);
    
    res.status(200).json({
      success: true,
      message: 'Detecções recentes encontradas com sucesso',
      data,
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;
    
    const stats = await this.deteccaoService.getDetectionStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.status(200).json({
      success: true,
      message: 'Estatísticas obtidas com sucesso',
      data: stats,
    });
  });
}