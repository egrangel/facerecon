import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { asyncHandler } from '@/middlewares/errorHandler';
import { OrganizationRequest } from '@/middlewares/organizationAccess';
import {
  OrganizationService,
  PersonService,
  EventService,
  CameraService,
  DetectionService,
  UserService,
} from '@/services';

export class OrganizationController extends BaseController<any> {
  private organizationService: OrganizationService;

  constructor() {
    const service = new OrganizationService();
    super(service);
    this.organizationService = service;
  }

  /**
   * @swagger
   * /api/v1/organizations/{id}/full:
   *   get:
   *     summary: Get organization with all relations
   *     tags: [Organizations]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Organization found successfully
   */
  findWithRelations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.organizationService.findWithRelations(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Organization found successfully',
      data,
    });
  });

  findByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;

    const data = await this.organizationService.findByStatus(status);

    res.status(200).json({
      success: true,
      message: 'Organizations found successfully',
      data,
    });
  });
}

export class PersonController extends BaseController<any> {
  private personService: PersonService;

  constructor() {
    const service = new PersonService();
    super(service);
    this.personService = service;
  }

  // Override create to automatically set organizationId
  create = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const personData = {
      ...req.body,
      organizationId: req.organizationId,
    };

    const data = await this.personService.create(personData);

    res.status(201).json({
      success: true,
      message: 'Pessoa criada com sucesso',
      data,
    });
  });

  /**
   * @swagger
   * /api/v1/people/organization/{organizationId}:
   *   get:
   *     summary: Get people by organization
   *     tags: [People]
   *     parameters:
   *       - in: path
   *         name: organizationId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: People found successfully
   */
  findByOrganizationId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params;

    const data = await this.personService.findByOrganizationId(parseInt(organizationId));

    res.status(200).json({
      success: true,
      message: 'People found successfully',
      data,
    });
  });

  findByDocument = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { documentNumber } = req.params;

    const data = await this.personService.findByDocumentNumber(documentNumber);

    res.status(200).json({
      success: true,
      message: data ? 'Person found successfully' : 'Person not found',
      data,
    });
  });

  findWithFullRelations = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.findWithFullRelations(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Person found successfully',
      data,
    });
  });

  addType = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.addType(parseInt(id), req.body);

    res.status(201).json({
      success: true,
      message: 'Type added successfully',
      data,
    });
  });

  addFace = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.addFace(parseInt(id), req.body);

    res.status(201).json({
      success: true,
      message: 'Face added successfully',
      data,
    });
  });

  addContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.addContact(parseInt(id), req.body);

    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data,
    });
  });

  addAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.addAddress(parseInt(id), req.body);

    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      data,
    });
  });
}

export class EventController extends BaseController<any> {
  private eventService: EventService;

  constructor() {
    const service = new EventService();
    super(service);
    this.eventService = service;
  }

  // Override create to automatically set organizationId
  create = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const eventData = {
      ...req.body,
      organizationId: req.organizationId,
    };

    const data = await this.eventService.create(eventData);

    res.status(201).json({
      success: true,
      message: 'Evento criado com sucesso',
      data,
    });
  });

  findByOrganizationId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params;

    const data = await this.eventService.findByOrganizationId(parseInt(organizationId));

    res.status(200).json({
      success: true,
      message: 'Events found successfully',
      data,
    });
  });

  findByDateRange = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Parameters startDate and endDate are required',
      });
      return;
    }

    const data = await this.eventService.findByDateRange(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.status(200).json({
      success: true,
      message: 'Events found successfully',
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

  // Override create to automatically set organizationId
  create = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const cameraData = {
      ...req.body,
      organizationId: req.organizationId,
    };

    const data = await this.cameraService.create(cameraData);

    res.status(201).json({
      success: true,
      message: 'Câmera criada com sucesso',
      data,
    });
  });

  findByOrganizationId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { organizationId } = req.params;

    const data = await this.cameraService.findByOrganizationId(parseInt(organizationId));

    res.status(200).json({
      success: true,
      message: 'Cameras found successfully',
      data,
    });
  });

  findByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;

    const data = await this.cameraService.findByStatus(status);

    res.status(200).json({
      success: true,
      message: 'Cameras found successfully',
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

export class DetectionController extends BaseController<any> {
  private detectionService: DetectionService;

  constructor() {
    const service = new DetectionService();
    super(service);
    this.detectionService = service;
  }

  findByEventId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    const data = await this.detectionService.findByEventId(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Detections found successfully',
      data,
    });
  });

  findByPersonFaceId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { personFaceId } = req.params;

    const data = await this.detectionService.findByPersonFaceId(parseInt(personFaceId));

    res.status(200).json({
      success: true,
      message: 'Detections found successfully',
      data,
    });
  });

  findRecentDetections = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { hours } = req.query;
    const hoursNumber = hours ? parseInt(hours as string) : 24;

    const data = await this.detectionService.findRecentDetections(hoursNumber);

    res.status(200).json({
      success: true,
      message: 'Recent detections found successfully',
      data,
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { startDate, endDate } = req.query;

    const stats = await this.detectionService.getDetectionStats(
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    res.status(200).json({
      success: true,
      message: 'Statistics obtained successfully',
      data: stats,
    });
  });
}

export class UserController extends BaseController<any> {
  private userService: UserService;

  constructor() {
    const service = new UserService();
    super(service);
    this.userService = service;
  }

  /**
   * @swagger
   * /api/v1/users/email/{email}:
   *   get:
   *     summary: Get user by email
   *     tags: [Users]
   *     parameters:
   *       - in: path
   *         name: email
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: User found successfully
   */
  findByEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.params;

    const data = await this.userService.findByEmail(email);

    res.status(200).json({
      success: true,
      message: data ? 'User found successfully' : 'User not found',
      data,
    });
  });

  findByRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { role } = req.params;

    const data = await this.userService.findByRole(role);

    res.status(200).json({
      success: true,
      message: 'Users found successfully',
      data,
    });
  });

  findByStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;

    const data = await this.userService.findByStatus(status);

    res.status(200).json({
      success: true,
      message: 'Users found successfully',
      data,
    });
  });
}

