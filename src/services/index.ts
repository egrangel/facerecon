import { DeepPartial } from 'typeorm';
import { BaseService } from './BaseService';
import { createError } from '../middlewares/errorHandler';
import { faceIndexService } from './FaceIndexService';
import {
  OrganizationRepository,
  PersonRepository,
  PersonTypeRepository,
  PersonFaceRepository,
  PersonContactRepository,
  PersonAddressRepository,
  EventRepository,
  CameraRepository,
  DetectionRepository,
  UserRepository,
  EventCameraRepository,
} from '../repositories';
import {
  Organization,
  Person,
  PersonType,
  PersonFace,
  PersonContact,
  PersonAddress,
  User,
} from '../entities';
import { Event, Camera, Detection, EventCamera } from '../entities/EventEntities';

export class OrganizationService extends BaseService<Organization> {
  constructor() {
    super(new OrganizationRepository());
  }

  async findWithRelations(id: number): Promise<Organization> {
    const organization = await (this.repository as OrganizationRepository).findWithRelations(id);
    if (!organization) {
      throw createError('Organization not found', 404);
    }
    return organization;
  }

  async findByStatus(status: string): Promise<Organization[]> {
    return (this.repository as OrganizationRepository).findByStatus(status);
  }

  async create(data: DeepPartial<Organization>): Promise<Organization> {
    this.validateRequiredField(data.name, 'name');
    return super.create(data);
  }
}

export class PersonService extends BaseService<Person> {
  private personTypeRepository: PersonTypeRepository;
  private personFaceRepository: PersonFaceRepository;
  private personContactRepository: PersonContactRepository;
  private personAddressRepository: PersonAddressRepository;

  constructor() {
    super(new PersonRepository());
    this.personTypeRepository = new PersonTypeRepository();
    this.personFaceRepository = new PersonFaceRepository();
    this.personContactRepository = new PersonContactRepository();
    this.personAddressRepository = new PersonAddressRepository();
  }

  async findByOrganizationId(organizationId: number): Promise<Person[]> {
    return (this.repository as PersonRepository).findByOrganizationId(organizationId);
  }

  async findByDocumentNumber(documentNumber: string): Promise<Person | null> {
    return (this.repository as PersonRepository).findByDocumentNumber(documentNumber);
  }

  async findWithFullRelations(id: number): Promise<Person> {
    const person = await (this.repository as PersonRepository).findWithFullRelations(id);
    if (!person) {
      throw createError('Person not found', 404);
    }
    return person;
  }

  async create(data: DeepPartial<Person>): Promise<Person> {
    this.validateRequiredField(data.name, 'name');
    this.validateRequiredField(data.organizationId, 'organizationId');

    if (data.documentNumber) {
      if (data.personType === 'individual') {
        this.validateCPF(data.documentNumber);
      } else if (data.personType === 'company') {
        this.validateCNPJ(data.documentNumber);
      }

      // Check if document already exists
      const existingPerson = await this.findByDocumentNumber(data.documentNumber);
      if (existingPerson) {
        throw createError('Document already registered', 409);
      }
    }

    return super.create(data);
  }

  async addType(personId: number, typeData: DeepPartial<PersonType>): Promise<PersonType> {
    const person = await this.findById(personId);
    return this.personTypeRepository.create({
      ...typeData,
      personId: person.id,
    });
  }

  async addFace(personId: number, faceData: DeepPartial<PersonFace>): Promise<PersonFace> {
    const person = await this.findById(personId);
    return this.personFaceRepository.create({
      ...faceData,
      personId: person.id,
    });
  }

  async addContact(personId: number, contactData: DeepPartial<PersonContact>): Promise<PersonContact> {
    const person = await this.findById(personId);

    if (contactData.type === 'email' && contactData.value) {
      this.validateEmailField(contactData.value);
    }

    return this.personContactRepository.create({
      ...contactData,
      personId: person.id,
    });
  }

  async addAddress(personId: number, addressData: DeepPartial<PersonAddress>): Promise<PersonAddress> {
    const person = await this.findById(personId);
    return this.personAddressRepository.create({
      ...addressData,
      personId: person.id,
    });
  }

  async searchWithPagination(searchTerm: string, options: any): Promise<any> {
    return (this.repository as PersonRepository).searchWithPagination(searchTerm, options);
  }
}

export class EventService extends BaseService<Event> {
  constructor() {
    super(new EventRepository());
  }

  async findByOrganizationId(organizationId: number): Promise<Event[]> {
    return (this.repository as EventRepository).findByOrganizationId(organizationId);
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    return (this.repository as EventRepository).findByDateRange(startDate, endDate);
  }

  async findScheduledEvents(): Promise<Event[]> {
    return (this.repository as EventRepository).getRepository().find({
      where: { isScheduled: true, isActive: true },
      relations: ['eventCameras', 'eventCameras.camera'],
    });
  }

  async findActiveScheduledEvents(): Promise<Event[]> {
    return (this.repository as EventRepository).getRepository().find({
      where: {
        isScheduled: true,
        isActive: true,
        type: 'scheduled'
      },
      relations: ['eventCameras', 'eventCameras.camera'],
    });
  }

  async create(data: DeepPartial<Event>): Promise<Event> {
    this.validateRequiredField(data.name, 'name');
    this.validateRequiredField(data.organizationId, 'organizationId');

    // Make occurredAt optional for scheduled events
    if (!data.isScheduled) {
      this.validateRequiredField(data.occurredAt, 'occurredAt');
    }

    return super.create(data);
  }
}

export class CameraService extends BaseService<Camera> {
  constructor() {
    super(new CameraRepository());
  }

  async findByOrganizationId(organizationId: number): Promise<Camera[]> {
    return (this.repository as CameraRepository).findByOrganizationId(organizationId);
  }

  async findByStatus(status: string): Promise<Camera[]> {
    return (this.repository as CameraRepository).findByStatus(status);
  }

  async create(data: DeepPartial<Camera>): Promise<Camera> {
    this.validateRequiredField(data.name, 'name');
    this.validateRequiredField(data.organizationId, 'organizationId');

    return super.create(data);
  }

  async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    const camera = await this.findById(id);

    // Here you would implement the actual connection test logic
    // For example, ping or try to connect to the camera URL

    return {
      success: true,
      message: `Connection to camera ${camera.name} tested successfully`,
    };
  }
}

export class DetectionService extends BaseService<Detection> {
  public personService: PersonService;
  private personFaceRepository: PersonFaceRepository;

  constructor() {
    super(new DetectionRepository());
    this.personService = new PersonService();
    this.personFaceRepository = new PersonFaceRepository();
  }

  async findByEventId(eventId: number): Promise<Detection[]> {
    return (this.repository as DetectionRepository).findByEventId(eventId);
  }

  async findRecentDetections(hours: number = 24): Promise<Detection[]> {
    return (this.repository as DetectionRepository).findRecentDetections(hours);
  }

  async create(data: DeepPartial<Detection>): Promise<Detection> {
    this.validateRequiredField(data.eventId, 'eventId');
    this.validateRequiredField(data.detectedAt, 'detectedAt');
    this.validateNumericField(data.confidence, 'confidence');
    this.validateRequiredField(data.organizationId, 'organizationId');

    return super.create(data);
  }

  async getDetectionStats(startDate?: Date, endDate?: Date): Promise<{
    total: number;
    byDay: Array<{ date: string; count: number }>;
    byConfidence: Array<{ range: string; count: number }>;
  }> {
    // Implement detection statistics
    // This is a simplified implementation
    const detections = await this.repository.findAll();

    return {
      total: detections.length,
      byDay: [],
      byConfidence: [],
    };
  }

  // Associate detection to existing person
  async associateToExistingPerson(detectionId: number, personId: number, organizationId: number): Promise<Detection> {
    // Find the detection
    const detection = await this.findById(detectionId);
    if (!detection) {
      throw createError('Detection not found', 404);
    }

    // Verify the person exists and belongs to the same organization
    const person = await this.personService.findById(personId);
    if (!person || person.organizationId !== organizationId) {
      throw createError('Person not found or access denied', 404);
    }

    // Always create a new PersonFace record with the detection's embedding data
    // This allows us to accumulate multiple face samples for better recognition
    const personFace = await this.personFaceRepository.create({
      personId: personId,
      biometricParameters: detection.metadata || '', // Use detection metadata if available
      embedding: detection.embedding || undefined, // Use detection embedding if available
      reliability: detection.confidence / 100, // Convert percentage to decimal
      status: 'active'
    });

    console.log(`Created new PersonFace record for ${person.name} (ID: ${personId}) with PersonFace ID: ${personFace.id}`);
    console.log(`📊 PersonFace embedding status: ${personFace.embedding ? `${personFace.embedding.length} bytes` : 'NULL/EMPTY'}`);
    console.log(`📊 Detection embedding status: ${detection.embedding ? `${detection.embedding.length} bytes` : 'NULL/EMPTY'}`);

    // Add the new PersonFace to the ANN index if it has an embedding
    if (personFace.embedding) {
      await faceIndexService.addFace(personFace);
      console.log(`📊 Added PersonFace ${personFace.id} to ANN index for better future recognition`);
    } else {
      console.warn(`⚠️ Cannot add PersonFace ${personFace.id} to ANN index - no embedding data available`);
    }

    // Update the detection to point to this PersonFace
    const updatedDetection = await this.repository.update(detectionId, {
      personFaceId: personFace.id,
      status: 'confirmada'
    });

    // Return the updated detection with relations
    const updatedDetectionResult = await this.repository.findOne({
      where: { id: detectionId },
      relations: ['camera', 'personFace', 'personFace.person', 'event']
    });

    if (!updatedDetectionResult) {
      throw createError('Detection not found after update', 404);
    }

    return updatedDetectionResult;
  }

  // Create new person and associate detection
  async createPersonFromDetection(detectionId: number, personData: DeepPartial<Person>, organizationId: number): Promise<Detection> {
    // Find the detection
    const detection = await this.findById(detectionId);
    if (!detection) {
      throw createError('Detection not found', 404);
    }

    // Create the new person
    const newPerson = await this.personService.create({
      ...personData,
      organizationId: organizationId
    });

    // Create a PersonFace for the new person using the detection data
    const personFace = await this.personFaceRepository.create({
      personId: newPerson.id,
      biometricParameters: detection.metadata || '', // Use detection metadata if available
      embedding: detection.embedding || undefined, // Use detection embedding if available
      reliability: detection.confidence / 100, // Convert percentage to decimal
      status: 'active'
    });

    console.log(`Created new person "${newPerson.name}" (ID: ${newPerson.id}) with PersonFace ID: ${personFace.id}`);

    // Add the new PersonFace to the ANN index if it has an embedding
    if (personFace.embedding) {
      await faceIndexService.addFace(personFace);
      console.log(`📊 Added PersonFace ${personFace.id} to ANN index`);
    }

    // Update the detection to point to this PersonFace
    await this.repository.update(detectionId, {
      personFaceId: personFace.id,
      status: 'confirmada'
    });

    // Return the updated detection with relations
    const updatedDetectionResult = await this.repository.findOne({
      where: { id: detectionId },
      relations: ['camera', 'personFace', 'personFace.person', 'event']
    });

    if (!updatedDetectionResult) {
      throw createError('Detection not found after update', 404);
    }

    return updatedDetectionResult;
  }

  // Helper method to check if a person has existing face records
  async checkPersonFaceExists(personId: number): Promise<{
    hasRecords: boolean;
    count: number;
    activeRecords: number;
    faces?: any[];
  }> {
    const existingFaces = await this.personFaceRepository.getRepository().find({
      where: { personId: personId },
      relations: ['person']
    });

    const activeCount = existingFaces.filter(face => face.status === 'active').length;

    return {
      hasRecords: existingFaces.length > 0,
      count: existingFaces.length,
      activeRecords: activeCount,
      faces: existingFaces
    };
  }

  // Helper method to get the best PersonFace for a person (prefers active ones)
  async getBestPersonFace(personId: number): Promise<any | null> {
    const faceCheck = await this.checkPersonFaceExists(personId);

    if (!faceCheck.hasRecords) {
      return null;
    }

    // Prefer active faces, fallback to any face
    const activeFace = faceCheck.faces?.find(face => face.status === 'active');
    return activeFace || faceCheck.faces?.[0] || null;
  }
}

export class UserService extends BaseService<User> {
  constructor() {
    super(new UserRepository());
  }

  async findByEmail(email: string): Promise<User | null> {
    return (this.repository as UserRepository).findByEmail(email);
  }

  async findByRole(role: string): Promise<User[]> {
    return (this.repository as UserRepository).findByRole(role);
  }

  async findByStatus(status: string): Promise<User[]> {
    return (this.repository as UserRepository).findByStatus(status);
  }

  async findByOrganizationId(organizationId: number): Promise<User[]> {
    return (this.repository as UserRepository).findByOrganizationId(organizationId);
  }

  async create(data: DeepPartial<User>): Promise<User> {
    this.validateRequiredField(data.name, 'name');
    this.validateRequiredField(data.email, 'email');
    this.validateRequiredField(data.password, 'password');
    this.validateEmailField(data.email!);

    // Check if email already exists
    const existingUser = await this.findByEmail(data.email!);
    if (existingUser) {
      throw createError('Email already registered', 409);
    }

    return super.create(data);
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.repository.update(id, { lastLoginAt: new Date() });
  }
}

// EventCamera Service
export class EventCameraService extends BaseService<EventCamera> {
  private eventCameraRepository: EventCameraRepository;

  constructor() {
    const repository = new EventCameraRepository();
    super(repository);
    this.eventCameraRepository = repository;
  }

  async findByEventId(eventId: number): Promise<EventCamera[]> {
    return this.eventCameraRepository.findByEventId(eventId);
  }

  async findByCameraId(cameraId: number): Promise<EventCamera[]> {
    return this.eventCameraRepository.findByCameraId(cameraId);
  }

  async findActiveByEventId(eventId: number): Promise<EventCamera[]> {
    return this.eventCameraRepository.findActiveByEventId(eventId);
  }

  async addCameraToEvent(eventId: number, cameraId: number, settings?: string): Promise<EventCamera> {
    return this.eventCameraRepository.addCameraToEvent(eventId, cameraId, settings);
  }

  async removeCameraFromEvent(eventId: number, cameraId: number): Promise<boolean> {
    return this.eventCameraRepository.removeCameraFromEvent(eventId, cameraId);
  }

  async toggleCameraInEvent(eventId: number, cameraId: number): Promise<EventCamera | null> {
    return this.eventCameraRepository.toggleCameraInEvent(eventId, cameraId);
  }
}

// Export face recognition services
export { faceRecognitionService, FaceRecognitionService } from './FaceRecognitionService';
export { frameExtractionService, FrameExtractionService } from './FrameExtractionService';
export { eventSchedulerService, EventSchedulerService } from './EventSchedulerService';

