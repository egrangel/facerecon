import { AppDataSource } from '@/config/database';
import { BaseRepository } from './BaseRepository';
import { Organization } from '@/entities/Organization';
import { Person } from '@/entities/Person';
import { PersonType, PersonFace, PersonContact, PersonAddress } from '@/entities';
import { Event, Camera, Detection } from '@/entities/EventEntities';
import { User } from '@/entities/User';

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
      where: { role },
    });
  }

  async findByStatus(status: string): Promise<User[]> {
    return this.repository.find({
      where: { status },
    });
  }

  async findByOrganizationId(organizationId: number): Promise<User[]> {
    return this.repository.find({
      where: { organizationId },
      relations: ['organization'],
    });
  }
}