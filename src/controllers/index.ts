import { Request, Response } from 'express';
import { BaseController } from './BaseController';
import { asyncHandler } from '@/middlewares/errorHandler';
import { OrganizationRequest } from '@/middlewares/organizationAccess';
import {
  OrganizationService,
  PersonService,
  PersonImageService,
  EventService,
  CameraService,
  DetectionService,
  UserService,
  EventCameraService,
  PersonImageProcessingService,
} from '@/services';
import { eventSchedulerService } from '@/services/EventSchedulerService';

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

  // Override findAll to handle search functionality
  findAll = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { page, limit, sortBy, sortOrder, search, ...filters } = req.query;


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
        sortBy: sortBy as string || 'createdAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        where: organizationFilters,
      };

      // Handle search functionality and status filtering
      if (search || filters.status) {
        // Use searchWithPagination for both search and status filtering
        const searchTerm = search ? search as string : '';
        result = await this.personService.searchWithPagination(searchTerm, paginationOptions);
      } else {
        result = await this.service.findWithPagination(paginationOptions);
      }
    } else {
      // Handle status filtering even without pagination
      if (filters.status) {
        // Use searchWithPagination with empty search term but status filter
        const searchResult = await this.personService.searchWithPagination('', {
          page: 1,
          limit: 1000, // Large limit to get all results
          sortBy: 'createdAt',
          sortOrder: 'DESC',
          where: organizationFilters,
        });
        result = { data: searchResult.data };
      } else {
        const data = await this.service.findAllByOrganization(req.organizationId);
        result = { data };
      }
    }

    res.status(200).json({
      success: true,
      message: 'Pessoas encontradas com sucesso',
      ...result,
    });
  });

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

  addContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.addContact(parseInt(id), req.body);

    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data,
    });
  });

  getContacts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.getContacts(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Contacts retrieved successfully',
      data,
    });
  });

  updateContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, contactId } = req.params;

    const data = await this.personService.updateContact(parseInt(id), parseInt(contactId), req.body);

    res.status(200).json({
      success: true,
      message: 'Contact updated successfully',
      data,
    });
  });

  deleteContact = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, contactId } = req.params;

    await this.personService.deleteContact(parseInt(id), parseInt(contactId));

    res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
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

  getAddresses = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const data = await this.personService.getAddresses(parseInt(id));

    res.status(200).json({
      success: true,
      message: 'Addresses retrieved successfully',
      data,
    });
  });

  updateAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, addressId } = req.params;

    const data = await this.personService.updateAddress(parseInt(id), parseInt(addressId), req.body);

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data,
    });
  });

  deleteAddress = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id, addressId } = req.params;

    await this.personService.deleteAddress(parseInt(id), parseInt(addressId));

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
    });
  });

  // Override update to filter out fields that don't belong to Person entity
  update = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Filter out fields that are not valid Person entity properties
    // Exclude foreign key fields and relation fields that should be handled separately
    const {
      personId,        // This doesn't exist on Person entity
      email,           // Should be handled as PersonContact
      telefone,        // Should be handled as PersonContact
      types,           // Relation - handled separately
      faces,           // Relation - handled separately
      contacts,        // Relation - handled separately
      addresses,       // Relation - handled separately
      organization,    // Relation - handled separately
      ...filteredBody
    } = req.body;

    const data = await this.personService.updateByOrganization(parseInt(id), req.organizationId, filteredBody);

    if (!data) {
      res.status(404).json({
        success: false,
        message: 'Pessoa não encontrada ou acesso negado',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Pessoa atualizada com sucesso',
      data,
    });
  });
}

export class EventController extends BaseController<any> {
  private eventService: EventService;
  private eventCameraService: EventCameraService;

  constructor() {
    const service = new EventService();
    super(service);
    this.eventService = service;
    this.eventCameraService = new EventCameraService();
  }

  // Override update to handle event status changes
  update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const eventId = parseInt(id);

    // Get the current event to compare status
    const currentEvent = await this.eventService.findById(eventId);
    if (!currentEvent) {
      res.status(404).json({
        success: false,
        message: 'Event not found',
      });
      return;
    }

    // Update the event
    const data = await this.eventService.update(eventId, req.body);

    // Check if isActive status changed and handle accordingly
    if (req.body.isActive !== undefined && req.body.isActive !== currentEvent.isActive) {
      await eventSchedulerService.handleEventStatusChange(eventId, req.body.isActive);
    }

    res.status(200).json({
      success: true,
      message: 'Evento atualizado com sucesso',
      data,
    });
  });

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

  // Camera-Event Association methods
  addCameraToEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId, cameraId } = req.params;
    const { settings } = req.body;

    const data = await this.eventCameraService.addCameraToEvent(
      parseInt(eventId),
      parseInt(cameraId),
      settings
    );

    res.status(201).json({
      success: true,
      message: 'Camera added to event successfully',
      data,
    });
  });

  removeCameraFromEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId, cameraId } = req.params;

    const success = await this.eventCameraService.removeCameraFromEvent(
      parseInt(eventId),
      parseInt(cameraId)
    );

    res.status(200).json({
      success,
      message: success ? 'Camera removed from event successfully' : 'Camera not found in event',
    });
  });

  toggleCameraInEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId, cameraId } = req.params;

    const data = await this.eventCameraService.toggleCameraInEvent(
      parseInt(eventId),
      parseInt(cameraId)
    );

    res.status(200).json({
      success: true,
      message: data ? 'Camera status toggled successfully' : 'Camera not found in event',
      data,
    });
  });

  getEventCameras = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    const data = await this.eventCameraService.findByEventId(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event cameras found successfully',
      data,
    });
  });

  getActiveEventCameras = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    const data = await this.eventCameraService.findActiveByEventId(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Active event cameras found successfully',
      data,
    });
  });

  // Event Scheduler Management methods
  getSchedulerHealth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const health = eventSchedulerService.getServiceHealth();

    res.status(200).json({
      success: true,
      message: 'Event scheduler health retrieved successfully',
      data: health,
    });
  });

  manuallyStartEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    await eventSchedulerService.manuallyStartEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event started manually',
    });
  });

  manuallyStopEvent = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    await eventSchedulerService.manuallyStopEvent(parseInt(eventId));

    res.status(200).json({
      success: true,
      message: 'Event stopped manually',
    });
  });

  getActiveSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeSessions = eventSchedulerService.getActiveSessions();

    res.status(200).json({
      success: true,
      message: 'Active sessions retrieved successfully',
      data: activeSessions,
    });
  });

  findScheduledEvents = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = await this.eventService.findScheduledEvents();

    res.status(200).json({
      success: true,
      message: 'Scheduled events found successfully',
      data,
    });
  });

  // Diagnostic endpoint to debug event scheduling
  diagnosisEventScheduling = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;
    const id = parseInt(eventId);

    // Get event details
    const event = await this.eventService.findById(id);
    if (!event) {
      res.status(404).json({
        success: false,
        message: 'Event not found',
      });
      return;
    }

    // Get current time and scheduling info
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDate = now.toISOString().slice(0, 10); // YYYY-MM-DD format
    const currentWeekDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];

    // Check if event should be active
    let shouldBeActive = false;
    let reason = '';

    if (!event.isActive) {
      reason = 'Event is not active (isActive = false)';
    } else if (!event.startTime || !event.endTime) {
      reason = 'Event has no start time or end time specified';
    } else if (currentTime < event.startTime || currentTime > event.endTime) {
      reason = `Current time ${currentTime} is outside event time range ${event.startTime} - ${event.endTime}`;
    } else {
      // Check recurrence
      switch (event.recurrenceType) {
        case 'once':
          if (event.scheduledDate) {
            const scheduledDate = new Date(event.scheduledDate).toISOString().slice(0, 10);
            shouldBeActive = currentDate === scheduledDate;
            reason = shouldBeActive ? 'Event matches scheduled date' : `Event scheduled for ${scheduledDate}, current date is ${currentDate}`;
          } else {
            reason = 'One-time event has no scheduled date';
          }
          break;
        case 'daily':
          shouldBeActive = true;
          reason = 'Daily event within time range';
          break;
        case 'weekly':
          if (event.weekDays) {
            try {
              const allowedDays = event.weekDays.startsWith('[') ? JSON.parse(event.weekDays) : event.weekDays.split(',').map(d => d.trim().toLowerCase());
              shouldBeActive = allowedDays.includes(currentWeekDay);
              reason = shouldBeActive ? `Current day ${currentWeekDay} is in allowed days ${JSON.stringify(allowedDays)}` : `Current day ${currentWeekDay} is not in allowed days ${JSON.stringify(allowedDays)}`;
            } catch (e) {
              reason = `Error parsing weekDays: ${event.weekDays}`;
            }
          } else {
            reason = 'Weekly event has no weekDays specified';
          }
          break;
        default:
          reason = `Unknown recurrence type: ${event.recurrenceType}`;
      }
    }

    // Get event cameras
    const eventCameras = await this.eventCameraService.findByEventId(id);
    const activeCameras = eventCameras.filter(ec => ec.isActive);

    // Get current active sessions
    const activeSessions = eventSchedulerService.getActiveSessions().filter(session => session.eventId === id);

    res.status(200).json({
      success: true,
      message: 'Event scheduling diagnosis completed',
      data: {
        event: {
          id: event.id,
          name: event.name,
          isActive: event.isActive,
          startTime: event.startTime,
          endTime: event.endTime,
          scheduledDate: event.scheduledDate,
          recurrenceType: event.recurrenceType,
          weekDays: event.weekDays,
        },
        currentTime: {
          time: currentTime,
          date: currentDate,
          weekday: currentWeekDay,
          timestamp: now.toISOString(),
        },
        scheduling: {
          shouldBeActive,
          reason,
        },
        cameras: {
          total: eventCameras.length,
          active: activeCameras.length,
          details: eventCameras.map(ec => ({
            cameraId: ec.cameraId,
            isActive: ec.isActive,
            camera: ec.camera,
          })),
        },
        activeSessions: activeSessions.map(session => ({
          eventId: session.eventId,
          cameraId: session.cameraId,
          videoSessionId: session.videoSessionId,
          faceRecognitionSessionId: session.faceRecognitionSessionId,
          startedAt: session.startedAt,
        })),
      },
    });
  });

  // Toggle event active status
  toggleEventStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    // Get the current event
    const currentEvent = await this.eventService.findById(parseInt(eventId));
    if (!currentEvent) {
      res.status(404).json({
        success: false,
        message: 'Event not found',
      });
      return;
    }

    // Toggle the active status
    const newStatus = !currentEvent.isActive;
    const data = await this.eventService.update(parseInt(eventId), { isActive: newStatus });

    // Send immediate response to frontend
    res.status(200).json({
      success: true,
      message: newStatus ? 'Event activated successfully' : 'Event deactivated successfully',
      data,
    });

    // Handle the status change (stop/start streams) asynchronously - don't await
    eventSchedulerService.handleEventStatusChange(parseInt(eventId), newStatus)
      .catch(error => {
        console.error(`Error handling event status change for event ${eventId}:`, error);
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

  // Override findAll to include camera and person relations
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
        sortBy: sortBy as string || 'detectedAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        where: organizationFilters,
        relations: ['camera', 'personFace', 'personFace.person', 'event'], // Include relations
      };

      result = await this.service.findWithPagination(paginationOptions);
    } else {
      const data = await this.service.findAllByOrganization(req.organizationId, ['camera', 'personFace', 'personFace.person', 'event']);

      // Debug: Log detection data to verify relations
      if (data.length > 0) {
        console.log('🔍 DEBUG: First detection data:', {
          id: data[0].id,
          personId: (data[0] as any).personId,
          hasPersonFace: !!(data[0] as any).personFace,
          personFaceId: (data[0] as any).personFace?.id,
          personName: (data[0] as any).personFace?.person?.name,
          personData: (data[0] as any).personFace?.person,
        });
      }

      result = { data };
    }

    res.status(200).json({
      success: true,
      message: 'Detecções encontradas com sucesso',
      ...result,
    });
  });

  // Override create to automatically set organizationId
  create = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const detectionData = {
      ...req.body,
      organizationId: req.organizationId,
    };

    const data = await this.detectionService.create(detectionData);

    res.status(201).json({
      success: true,
      message: 'Detecção criada com sucesso',
      data,
    });
  });

  findByEventId = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { eventId } = req.params;

    const data = await this.detectionService.findByEventId(parseInt(eventId));

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

  // Associate detection to existing person
  associateToExistingPerson = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { detectionId } = req.params;
    const { personId } = req.body;

    if (!personId) {
      res.status(400).json({
        success: false,
        message: 'Person ID is required',
      });
      return;
    }

    const data = await this.detectionService.associateToExistingPerson(
      parseInt(detectionId),
      parseInt(personId),
      req.organizationId
    );

    res.status(200).json({
      success: true,
      message: 'Detection associated to person successfully',
      data,
    });
  });

  // Create new person and associate detection
  createPersonFromDetection = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { detectionId } = req.params;
    const { personData } = req.body;

    if (!personData || !personData.name) {
      res.status(400).json({
        success: false,
        message: 'Person data with name is required',
      });
      return;
    }

    const data = await this.detectionService.createPersonFromDetection(
      parseInt(detectionId),
      { ...personData, organizationId: req.organizationId },
      req.organizationId
    );

    res.status(201).json({
      success: true,
      message: 'New person created and detection associated successfully',
      data,
    });
  });

  // Unmatch/Disassociate person from detection (sets detectionStatus to pending and removes person association)
  unmatchPerson = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { detectionId } = req.params;

    if (!detectionId) {
      res.status(400).json({
        success: false,
        message: 'Detection ID is required',
      });
      return;
    }

    const detection = await this.detectionService.findById(parseInt(detectionId));
    if (!detection) {
      res.status(404).json({
        success: false,
        message: 'Detection not found',
      });
      return;
    }

    // Update detection to remove person association and set back to unrecognized
    // When disassociating, faceStatus changes back to 'unrecognized' since no person is associated
    try {
      const updatedDetection = await this.detectionService.repository.update(parseInt(detectionId), {
        personFaceId: null as any,
        faceStatus: 'unrecognized', // No person associated = unrecognized
        detectionStatus: 'pending',
      });
    } catch (error) {
      console.error('Error unmatching person from detection:', error);
    }

    const detectionWithRelations = await this.detectionService.findById(parseInt(detectionId), [
      'camera', 'personFace', 'personFace.person', 'event'
    ]);

    res.status(200).json({
      success: true,
      message: 'Person disassociated from detection successfully',
      data: detectionWithRelations,
    });
  });

  // Confirm detection (sets detectionStatus to confirmed)
  confirmDetection = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { detectionId } = req.params;

    if (!detectionId) {
      res.status(400).json({
        success: false,
        message: 'Detection ID is required',
      });
      return;
    }

    const detection = await this.detectionService.findById(parseInt(detectionId));
    if (!detection) {
      res.status(404).json({
        success: false,
        message: 'Detection not found',
      });
      return;
    }

    // Only allow confirming detections with 'pending' detectionStatus
    if (detection.detectionStatus !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Only pending detections can be confirmed',
      });
      return;
    }


    // Update detectionStatus to 'confirmed'
    // faceStatus remains unchanged (immutable once set)
    const updatedDetection = await this.detectionService.repository.update(parseInt(detectionId), {
      detectionStatus: 'confirmed',
    });

    const detectionWithRelations = await this.detectionService.findById(parseInt(detectionId), [
      'camera', 'personFace', 'personFace.person', 'event'
    ]);

    res.status(200).json({
      success: true,
      message: 'Detection confirmed successfully',
      data: detectionWithRelations,
    });
  });

  // Get latest detection for a person
  getLatestDetectionForPerson = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { personId } = req.params;

    const latestDetection = await (this.service.repository as any).getRepository()
      .createQueryBuilder('detection')
      .leftJoinAndSelect('detection.personFace', 'personFace')
      .leftJoinAndSelect('personFace.person', 'person')
      .leftJoinAndSelect('detection.camera', 'camera')
      .where('person.id = :personId', { personId: parseInt(personId) })
      .andWhere('person.organizationId = :organizationId', { organizationId: req.organizationId })
      .orderBy('detection.detectedAt', 'DESC')
      .limit(1)
      .getOne();

    res.status(200).json({
      success: true,
      message: 'Última detecção encontrada',
      data: latestDetection,
    });
  });

  // Check if a person has existing face records
  checkPersonFaceRecords = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { personId } = req.params;

    if (!personId) {
      res.status(400).json({
        success: false,
        message: 'Person ID is required',
      });
      return;
    }

    // Verify person exists and belongs to organization
    const person = await this.detectionService.personService.findById(parseInt(personId));
    if (!person || person.organizationId !== req.organizationId) {
      res.status(404).json({
        success: false,
        message: 'Person not found or access denied',
      });
      return;
    }

    const faceCheck = await this.detectionService.checkPersonFaceExists(parseInt(personId));

    res.status(200).json({
      success: true,
      message: 'Person face records retrieved successfully',
      data: {
        personId: parseInt(personId),
        personName: person.name,
        ...faceCheck
      }
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

export class PersonImageController extends BaseController<any> {
  private personImageService: PersonImageService;
  private processingService: PersonImageProcessingService;

  constructor() {
    const service = new PersonImageService();
    super(service);
    this.personImageService = service;
    this.processingService = new PersonImageProcessingService();
  }

  // Override findAll to handle search functionality and organization filtering
  findAll = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { page, limit, sortBy, sortOrder, search, ...filters } = req.query;

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
        sortBy: sortBy as string || 'createdAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        where: organizationFilters,
      };

      if (search || filters.status || filters.processingStatus) {
        const searchTerm = search ? search as string : '';
        result = await this.personImageService.searchWithPagination(searchTerm, paginationOptions);
      } else {
        result = await this.service.findWithPagination(paginationOptions);
      }
    } else {
      const data = await this.service.findAllByOrganization(req.organizationId);
      result = { data };
    }

    res.status(200).json({
      success: true,
      message: 'Imagens de pessoas encontradas com sucesso',
      ...result,
    });
  });

  // Override create to automatically set organizationId via personId validation
  create = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { personId, ...personImageData } = req.body;

    if (!personId) {
      res.status(400).json({
        success: false,
        message: 'Person ID is required',
      });
      return;
    }

    // The service will validate that the person exists and belongs to the organization
    const data = await this.personImageService.create({
      ...personImageData,
      personId,
    });

    res.status(201).json({
      success: true,
      message: 'Imagem de pessoa criada com sucesso',
      data,
    });
  });

  /**
   * Find all images for a specific person
   */
  findByPersonId = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { personId } = req.params;

    const data = await this.personImageService.findByPersonId(parseInt(personId));

    res.status(200).json({
      success: true,
      message: 'Imagens da pessoa encontradas com sucesso',
      data,
    });
  });

  /**
   * Find images by processing status
   */
  findByProcessingStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status } = req.params;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid processing status. Must be: pending, processing, completed, or failed',
      });
      return;
    }

    const data = await this.personImageService.findByProcessingStatus(
      status as 'pending' | 'processing' | 'completed' | 'failed'
    );

    res.status(200).json({
      success: true,
      message: 'Imagens encontradas com sucesso',
      data,
    });
  });

  /**
   * Find images pending for processing
   */
  findPendingForProcessing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const data = await this.personImageService.findPendingForProcessing();

    res.status(200).json({
      success: true,
      message: 'Imagens pendentes para processamento encontradas com sucesso',
      data,
    });
  });

  /**
   * Update processing status of an image
   */
  updateProcessingStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status, error } = req.body;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid processing status. Must be: pending, processing, completed, or failed',
      });
      return;
    }

    const success = await this.personImageService.updateProcessingStatus(
      parseInt(id),
      status,
      error
    );

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Imagem não encontrada',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Status de processamento atualizado com sucesso',
    });
  });

  /**
   * Trigger face detection processing for a specific image
   */
  triggerProcessing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const data = await this.personImageService.triggerProcessing(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Processamento de detecção facial iniciado',
        data,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erro ao iniciar processamento',
      });
    }
  });

  /**
   * Reset processing status to pending
   */
  resetProcessing = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const data = await this.personImageService.resetProcessing(parseInt(id));

      res.status(200).json({
        success: true,
        message: 'Status de processamento resetado para pendente',
        data,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Erro ao resetar processamento',
      });
    }
  });

  /**
   * Process all pending images
   */
  processPendingImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const results = await this.processingService.processPendingImages();

      const successCount = results.filter(r => r.success).length;
      const totalFaces = results.reduce((sum, r) => sum + r.facesDetected, 0);

      res.status(200).json({
        success: true,
        message: `Processamento em lote concluído: ${successCount}/${results.length} imagens processadas`,
        data: {
          totalProcessed: results.length,
          successCount,
          failedCount: results.length - successCount,
          totalFacesDetected: totalFaces,
          results: results.map(r => ({
            personImageId: r.personImageId,
            success: r.success,
            facesDetected: r.facesDetected,
            processingTimeMs: r.processingTimeMs,
            error: r.error,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Erro no processamento em lote',
      });
    }
  });

  /**
   * Get processing statistics
   */
  getProcessingStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await this.processingService.getProcessingStats();

    res.status(200).json({
      success: true,
      message: 'Estatísticas de processamento obtidas com sucesso',
      data: stats,
    });
  });

  /**
   * Reprocess failed images
   */
  reprocessFailedImages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const results = await this.processingService.reprocessFailedImages();

      const successCount = results.filter(r => r.success).length;

      res.status(200).json({
        success: true,
        message: `Reprocessamento concluído: ${successCount}/${results.length} imagens processadas`,
        data: {
          totalReprocessed: results.length,
          successCount,
          failedCount: results.length - successCount,
          results: results.map(r => ({
            personImageId: r.personImageId,
            success: r.success,
            facesDetected: r.facesDetected,
            processingTimeMs: r.processingTimeMs,
            error: r.error,
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Erro no reprocessamento',
      });
    }
  });

  // Override update to handle file path changes and processing triggers
  update = asyncHandler(async (req: OrganizationRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    // Filter out fields that shouldn't be directly updated
    const {
      processingStatus, // Should use updateProcessingStatus endpoint
      processedAt,      // Managed automatically
      ...filteredBody
    } = req.body;

    const data = await this.personImageService.update(parseInt(id), filteredBody);

    res.status(200).json({
      success: true,
      message: 'Imagem de pessoa atualizada com sucesso',
      data,
    });
  });
}

export { DashboardController } from './DashboardController';
export { ReportController } from './ReportController';
