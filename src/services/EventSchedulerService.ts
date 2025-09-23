import { EventService, CameraService } from './index';
import { streamService } from './StreamService';
import { frameExtractionService } from './FrameExtractionService';
import { Event, EventCamera } from '../entities';
import { EventCameraRepository } from '../repositories';

export interface ScheduledEventExecution {
  eventId: number;
  cameraIds: number[];
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

export interface ActiveEventSession {
  eventId: number;
  eventName: string;
  cameraId: number;
  videoSessionId: string;
  faceRecognitionSessionId: string;
  startedAt: Date;
  organizationId: number;
}

export class EventSchedulerService {
  private static instance: EventSchedulerService;
  private eventService: EventService;
  private cameraService: CameraService;
  private eventCameraRepository: EventCameraRepository;
  private checkInterval: NodeJS.Timeout | null = null;
  private activeSessions: Map<string, ActiveEventSession> = new Map();
  private readonly checkIntervalMs = 60000; // Check every minute

  constructor() {
    this.eventService = new EventService();
    this.cameraService = new CameraService();
    this.eventCameraRepository = new EventCameraRepository();
  }

  public static getInstance(): EventSchedulerService {
    if (!EventSchedulerService.instance) {
      EventSchedulerService.instance = new EventSchedulerService();
    }
    return EventSchedulerService.instance;
  }

  /**
   * Start the event scheduler
   */
  public start(): void {
    if (this.checkInterval) {
      console.log('Event scheduler is already running');
      return;
    }

    console.log('Starting event scheduler...');
    this.checkInterval = setInterval(() => {
      this.checkScheduledEvents();
    }, this.checkIntervalMs);

    // Initial check
    this.checkScheduledEvents();
  }

  /**
   * Stop the event scheduler
   */
  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Event scheduler stopped');
    }

    // Stop all active sessions
    this.stopAllActiveSessions();
  }

  /**
   * Check for scheduled events that should be active now
   */
  private async checkScheduledEvents(): Promise<void> {
    try {
      const now = new Date();
      console.log(`Checking scheduled events at ${now.toISOString()}`);

      // Get all active scheduled events
      const scheduledEvents = await this.getActiveScheduledEvents();

      for (const event of scheduledEvents) {
        const shouldBeActive = this.shouldEventBeActive(event, now);
        const isCurrentlyActive = this.isEventCurrentlyActive(event.id);

        if (shouldBeActive && !isCurrentlyActive) {
          // Start event
          await this.startEventExecution(event);
        } else if (!shouldBeActive && isCurrentlyActive) {
          // Stop event
          await this.stopEventExecution(event.id);
        }
      }
    } catch (error) {
      console.error('Error checking scheduled events:', error);
    }
  }

  /**
   * Get all active scheduled events
   */
  private async getActiveScheduledEvents(): Promise<Event[]> {
    try {
      const events = await this.eventService.findAll();
      return events.filter(event =>
        event.isScheduled &&
        event.isActive &&
        event.type === 'scheduled'
      );
    } catch (error) {
      console.error('Error getting active scheduled events:', error);
      return [];
    }
  }

  /**
   * Check if an event should be active at the given time
   */
  private shouldEventBeActive(event: Event, now: Date): boolean {
    try {
      const currentTime = this.formatTime(now);
      const currentDate = this.formatDate(now);
      const currentWeekDay = this.getWeekDay(now);

      // Check time range
      if (event.startTime && event.endTime) {
        if (currentTime < event.startTime || currentTime > event.endTime) {
          return false;
        }
      }

      // Check recurrence type
      switch (event.recurrenceType) {
        case 'once':
          if (event.scheduledDate) {
            const scheduledDate = this.formatDate(new Date(event.scheduledDate));
            return currentDate === scheduledDate;
          }
          return false;

        case 'daily':
          return true; // Active every day within time range

        case 'weekly':
          if (event.weekDays) {
            const allowedDays = this.parseWeekDays(event.weekDays);
            return allowedDays.includes(currentWeekDay);
          }
          return false;

        case 'monthly':
          // Could implement monthly recurrence based on day of month
          return false;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking if event should be active:', error);
      return false;
    }
  }

  /**
   * Check if an event is currently active (has running sessions)
   */
  private isEventCurrentlyActive(eventId: number): boolean {
    return Array.from(this.activeSessions.values()).some(session => session.eventId === eventId);
  }

  /**
   * Start execution of a scheduled event
   */
  private async startEventExecution(event: Event): Promise<void> {
    try {
      console.log(`Starting event execution: ${event.name} (ID: ${event.id})`);

      // Get cameras associated with this event
      const eventCameras = await this.getEventCameras(event.id);
      console.log(`📋 Found ${eventCameras.length} event-camera associations for event ${event.id}:`);
      eventCameras.forEach(ec => {
        console.log(`  Camera ${ec.cameraId} - Active: ${ec.isActive}`);
      });

      for (const eventCamera of eventCameras) {
        if (eventCamera.isActive) {
          console.log(`🎬 Starting camera ${eventCamera.cameraId} for event "${event.name}"`);
          await this.startCameraForEvent(event, eventCamera.cameraId);
        } else {
          console.log(`⏸️ Skipping inactive camera ${eventCamera.cameraId} for event "${event.name}"`);
        }
      }
    } catch (error) {
      console.error(`Error starting event execution for event ${event.id}:`, error);
    }
  }

  /**
   * Stop execution of a scheduled event
   */
  private async stopEventExecution(eventId: number): Promise<void> {
    try {
      console.log(`Stopping event execution for event ID: ${eventId}`);

      // Find all active sessions for this event
      const eventSessions = Array.from(this.activeSessions.entries())
        .filter(([_, session]) => session.eventId === eventId);

      for (const [sessionKey, session] of eventSessions) {
        await this.stopCameraSession(session);
        this.activeSessions.delete(sessionKey);
      }
    } catch (error) {
      console.error(`Error stopping event execution for event ${eventId}:`, error);
    }
  }

  /**
   * Start a camera for an event
   */
  private async startCameraForEvent(event: Event, cameraId: number): Promise<void> {
    try {
      const camera = await this.cameraService.findById(cameraId);
      if (!camera) {
        console.error(`Camera ${cameraId} not found`);
        return;
      }

      // Build RTSP URL
      let rtspUrl = camera.streamUrl;
      if (!rtspUrl) {
        rtspUrl = `rtsp://${camera.ip}:${camera.port || 554}/stream`;
      }

      // Start video stream for the event
      const sessionId = await streamService.startStream(
        cameraId,
        rtspUrl,
        event.organizationId
      );

      // Start independent facial recognition for the event
      const faceRecSessionId = `event-${event.id}-camera-${cameraId}-${Date.now()}`;
      await frameExtractionService.startFrameExtraction(
        faceRecSessionId,
        cameraId,
        event.organizationId,
        rtspUrl,
        10 // frameInterval in seconds - increased for better performance
      );

      // Track the active session
      const sessionKey = `${event.id}-${cameraId}`;
      this.activeSessions.set(sessionKey, {
        eventId: event.id,
        eventName: event.name,
        cameraId,
        videoSessionId: sessionId,
        faceRecognitionSessionId: faceRecSessionId,
        startedAt: new Date(),
        organizationId: event.organizationId,
      });

      console.log(`Started camera ${cameraId} for event "${event.name}" (video: ${sessionId}, face-rec: ${faceRecSessionId})`);
    } catch (error) {
      console.error(`Error starting camera ${cameraId} for event ${event.id}:`, error);
    }
  }

  /**
   * Stop a camera session (both video and facial recognition)
   */
  private async stopCameraSession(session: ActiveEventSession): Promise<void> {
    try {
      // Stop video stream
      streamService.stopStream(session.videoSessionId);
      console.log(`Stopped video stream for camera ${session.cameraId} for event "${session.eventName}"`);
    } catch (error) {
      console.error(`Error stopping video session ${session.videoSessionId}:`, error);
    }

    try {
      // Stop facial recognition independently
      frameExtractionService.stopFrameExtraction(session.faceRecognitionSessionId);
      console.log(`Stopped facial recognition for camera ${session.cameraId} for event "${session.eventName}"`);
    } catch (error) {
      console.error(`Error stopping facial recognition session ${session.faceRecognitionSessionId}:`, error);
    }
  }

  /**
   * Get cameras associated with an event
   */
  private async getEventCameras(eventId: number): Promise<EventCamera[]> {
    try {
      return await this.eventCameraRepository.findActiveByEventId(eventId);
    } catch (error) {
      console.error(`Error getting cameras for event ${eventId}:`, error);
      return [];
    }
  }

  /**
   * Stop all active sessions
   */
  private stopAllActiveSessions(): void {
    for (const [sessionKey, session] of this.activeSessions.entries()) {
      this.stopCameraSession(session);
    }
    this.activeSessions.clear();
  }

  /**
   * Get active sessions
   */
  public getActiveSessions(): ActiveEventSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Manually start an event (for testing or manual execution)
   */
  public async manuallyStartEvent(eventId: number): Promise<void> {
    try {
      const event = await this.eventService.findById(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }

      if (!event.isActive) {
        throw new Error(`Event ${eventId} is not active`);
      }

      await this.startEventExecution(event);
    } catch (error) {
      console.error(`Error manually starting event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Manually stop an event
   */
  public async manuallyStopEvent(eventId: number): Promise<void> {
    try {
      await this.stopEventExecution(eventId);
    } catch (error) {
      console.error(`Error manually stopping event ${eventId}:`, error);
      throw error;
    }
  }

  /**
   * Handle event status change - stop all streams if event becomes inactive
   */
  public async handleEventStatusChange(eventId: number, isActive: boolean): Promise<void> {
    try {
      if (!isActive) {
        console.log(`Event ${eventId} set to inactive - stopping all associated streams`);
        await this.stopEventExecution(eventId);
      } else {
        console.log(`Event ${eventId} set to active - checking if it should be started`);
        // Check if the event should be running now based on schedule
        const event = await this.eventService.findById(eventId);
        if (event && event.isScheduled) {
          const shouldBeActive = this.shouldEventBeActive(event, new Date());
          if (shouldBeActive) {
            await this.startEventExecution(event);
          }
        }
      }
    } catch (error) {
      console.error(`Error handling event status change for event ${eventId}:`, error);
      throw error;
    }
  }

  // Utility methods
  private formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5); // HH:MM format
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD format
  }

  private getWeekDay(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  private parseWeekDays(weekDaysString: string): string[] {
    try {
      // Handle both JSON array and comma-separated formats
      if (weekDaysString.startsWith('[')) {
        return JSON.parse(weekDaysString);
      } else {
        return weekDaysString.split(',').map(day => day.trim().toLowerCase());
      }
    } catch (error) {
      console.error('Error parsing week days:', error);
      return [];
    }
  }

  /**
   * Get service health and status
   */
  public getServiceHealth() {
    return {
      isRunning: this.checkInterval !== null,
      activeSessions: this.activeSessions.size,
      checkInterval: this.checkIntervalMs,
      uptime: process.uptime(),
      lastCheck: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const eventSchedulerService = EventSchedulerService.getInstance();