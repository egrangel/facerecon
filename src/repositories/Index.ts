import { AppDataSource } from '../config/database';
import { BaseRepository, PaginatedResult } from './BaseRepository';
import { Organization } from '../entities/Organization';
import { Person } from '../entities/Person';
import { PersonType, PersonFace, PersonContact, PersonAddress } from '../entities';
import { Event, Camera, Detection, EventCamera } from '../entities/EventEntities';
import { User } from '../entities/User';

export class OrganizationRepository extends BaseRepository<Organization> {
  constructor() {
    super(AppDataSource.getRepository(Organization));
  }

  async findWithRelations(id: number): Promise<Organization | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['people', 'events', 'cameras'],
    });
  }

  async findByStatus(status: string): Promise<Organization[]> {
    return this.repository.find({
      where: { status },
    });
  }
}

export class PersonRepository extends BaseRepository<Person> {
  constructor() {
    super(AppDataSource.getRepository(Person));
  }

  async findByOrganizationId(organizationId: number): Promise<Person[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['organization'],
    });
  }

  async findByPersonId(personId: number): Promise<Person[]> {
    return this.repository.find({
      where: { id: personId },
      relations: ['types', 'faces', 'contacts', 'addresses'],
    });
  }

  async findByDocumentNumber(documentNumber: string): Promise<Person | null> {
    return this.repository.findOne({
      where: { documentNumber },
      relations: ['organization'],
    });
  }

  async findWithFullRelations(id: number): Promise<Person | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['organization', 'types', 'faces', 'contacts', 'addresses'],
    });
  }

  async searchWithPagination(searchTerm: string, options: any): Promise<PaginatedResult<Person>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', where } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.repository.createQueryBuilder('person')
      .leftJoinAndSelect('person.organization', 'organization')
      .where('person.organizationId = :organizationId', { organizationId: where.organizationId })
      .andWhere('(person.name ILIKE :search OR person.documentNumber ILIKE :search)', {
        search: `%${searchTerm}%`
      })
      .skip(skip)
      .take(limit)
      .orderBy(`person.${sortBy}`, sortOrder);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }
}

export class PersonTypeRepository extends BaseRepository<PersonType> {
  constructor() {
    super(AppDataSource.getRepository(PersonType));
  }

  async findByPersonId(personId: number): Promise<PersonType[]> {
    return this.repository.find({
      where: { personId },
      relations: ['person'],
    });
  }

  async findByType(type: string): Promise<PersonType[]> {
    return this.repository.find({
      where: { type },
      relations: ['person'],
    });
  }
}

export class PersonFaceRepository extends BaseRepository<PersonFace> {
  constructor() {
    super(AppDataSource.getRepository(PersonFace));
  }

  async findByPersonId(personId: number): Promise<PersonFace[]> {
    return this.repository.find({
      where: { personId },
      relations: ['person'],
    });
  }

  async findByFaceId(faceId: string): Promise<PersonFace | null> {
    return this.repository.findOne({
      where: { faceId },
      relations: ['person'],
    });
  }
}

export class PersonContactRepository extends BaseRepository<PersonContact> {
  constructor() {
    super(AppDataSource.getRepository(PersonContact));
  }

  async findByPersonId(personId: number): Promise<PersonContact[]> {
    return this.repository.find({
      where: { personId },
      relations: ['person'],
    });
  }

  async findPrincipalByPerson(personId: number, type: string): Promise<PersonContact | null> {
    return this.repository.findOne({
      where: { personId, type, isPrimary: true },
      relations: ['person'],
    });
  }
}

export class PersonAddressRepository extends BaseRepository<PersonAddress> {
  constructor() {
    super(AppDataSource.getRepository(PersonAddress));
  }

  async findByPersonId(personId: number): Promise<PersonAddress[]> {
    return this.repository.find({
      where: { personId },
      relations: ['person'],
    });
  }

  async findPrincipalByPerson(personId: number): Promise<PersonAddress | null> {
    return this.repository.findOne({
      where: { personId, isPrimary: true },
      relations: ['person'],
    });
  }
}

export class EventRepository extends BaseRepository<Event> {
  constructor() {
    super(AppDataSource.getRepository(Event));
  }

  async findByOrganizationId(organizationId: number): Promise<Event[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['organization', 'detections'],
      order: { occurredAt: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    return this.repository
      .createQueryBuilder('event')
      .where('event.occurredAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .leftJoinAndSelect('event.organization', 'organization')
      .leftJoinAndSelect('event.detections', 'detections')
      .orderBy('event.occurredAt', 'DESC')
      .getMany();
  }
}

export class CameraRepository extends BaseRepository<Camera> {
  constructor() {
    super(AppDataSource.getRepository(Camera));
  }

  async findByOrganizationId(organizationId: number): Promise<Camera[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['organization'],
    });
  }

  async findByStatus(status: string): Promise<Camera[]> {
    return this.repository.find({
      where: { status },
      relations: ['organization'],
    });
  }
}

export class DetectionRepository extends BaseRepository<Detection> {
  constructor() {
    super(AppDataSource.getRepository(Detection));
  }

  async findByEventId(eventId: number): Promise<Detection[]> {
    return this.repository.find({
      where: { eventId },
      relations: ['event', 'personFace', 'camera'],
    });
  }

  async findByPersonFaceId(personFaceId: number): Promise<Detection[]> {
    return this.repository.find({
      where: { personFaceId },
      relations: ['event', 'personFace', 'camera'],
      order: { detectedAt: 'DESC' },
    });
  }

  async findRecentDetections(hours: number = 24): Promise<Detection[]> {
    const dateThreshold = new Date();
    dateThreshold.setHours(dateThreshold.getHours() - hours);

    return this.repository
      .createQueryBuilder('detection')
      .where('detection.detectedAt >= :dateThreshold', { dateThreshold })
      .leftJoinAndSelect('detection.event', 'event')
      .leftJoinAndSelect('detection.personFace', 'personFace')
      .leftJoinAndSelect('personFace.person', 'person')
      .leftJoinAndSelect('detection.camera', 'camera')
      .orderBy('detection.detectedAt', 'DESC')
      .getMany();
  }
}

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(AppDataSource.getRepository(User));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<User | null> {
    return this.repository.findOne({
      where: { refreshToken },
    });
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.repository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  async findByRole(role: string): Promise<User[]> {
    return this.repository.find({
      where: { role: role as any },
    });
  }

  async findByStatus(status: string): Promise<User[]> {
    return this.repository.find({
      where: { status: status as any },
    });
  }

  async findByOrganizationId(organizationId: number): Promise<User[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['organization'],
    });
  }
}

// EventCamera Repository
export class EventCameraRepository extends BaseRepository<EventCamera> {
  constructor() {
    super(AppDataSource.getRepository(EventCamera));
  }

  async findByEventId(eventId: number): Promise<EventCamera[]> {
    return this.repository.find({
      where: { eventId },
      relations: ['camera', 'event'],
    });
  }

  async findByCameraId(cameraId: number): Promise<EventCamera[]> {
    return this.repository.find({
      where: { cameraId },
      relations: ['camera', 'event'],
    });
  }

  async findActiveByEventId(eventId: number): Promise<EventCamera[]> {
    return this.repository.find({
      where: { eventId, isActive: true },
      relations: ['camera', 'event'],
    });
  }

  async addCameraToEvent(eventId: number, cameraId: number, settings?: string): Promise<EventCamera> {
    const eventCamera = this.repository.create({
      eventId,
      cameraId,
      isActive: true,
      settings,
    });
    return this.repository.save(eventCamera);
  }

  async removeCameraFromEvent(eventId: number, cameraId: number): Promise<boolean> {
    const result = await this.repository.delete({ eventId, cameraId });
    return result.affected! > 0;
  }

  async toggleCameraInEvent(eventId: number, cameraId: number): Promise<EventCamera | null> {
    const eventCamera = await this.repository.findOne({
      where: { eventId, cameraId },
    });

    if (!eventCamera) {
      return null;
    }

    eventCamera.isActive = !eventCamera.isActive;
    return this.repository.save(eventCamera);
  }
}