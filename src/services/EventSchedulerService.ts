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
  private readonly checkIntervalMs = 30000; // Check every 30 seconds for better responsiveness

  // Event loop protection
  private isProcessingEvents = false;
  private lastEventCheck = Date.now();
  private eventCache: Map<string, { events: any[]; timestamp: number }> = new Map();
  private readonly cacheExpiryMs = 120000; // 2 minutes cache

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
   * Build RTSP URL with authentication credentials
   */
  private buildRtspUrl(camera: any): string {
    if (!camera.streamUrl) {
      throw new Error('Camera does not have a valid stream URL');
    }

    let rtspUrl = camera.streamUrl;

    // If username and password are provided, inject them into the URL
    if (camera.username && camera.password) {
      // Parse the URL to inject credentials
      const urlMatch = rtspUrl.match(/^(rtsp:\/\/)(.+)$/);
      if (urlMatch) {
        const protocol = urlMatch[1]; // "rtsp://"
        const hostAndPath = urlMatch[2]; // "ip:port/stream"

        // Build URL with credentials: rtsp://username:password@ip:port/stream
        rtspUrl = `${protocol}${camera.username}:${camera.password}@${hostAndPath}`;
      }
    }

    return rtspUrl;
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
   * Check for scheduled events with event loop protection
   */
  private async checkScheduledEvents(): Promise<void> {
    // Prevent overlapping checks
    if (this.isProcessingEvents) {
      console.log('Event check already in progress, skipping...');
      return;
    }

    this.isProcessingEvents = true;
    const startTime = Date.now();

    try {
      const now = new Date();
      console.log(`🔍 Checking scheduled events at ${now.toISOString()}`);

      // Get cached or fresh events
      const scheduledEvents = await this.getActiveScheduledEventsWithCache();
      console.log(`📋 Found ${scheduledEvents.length} active scheduled events`);

      if (scheduledEvents.length === 0) {
        console.log(`⚠️ No active events found - nothing to schedule`);
        return;
      }

      // Process events with batching to avoid blocking event loop
      const batchSize = 5;
      for (let i = 0; i < scheduledEvents.length; i += batchSize) {
        const batch = scheduledEvents.slice(i, i + batchSize);

        // Process batch
        await Promise.all(batch.map(async (event) => {
          try {
            await this.processEventSchedule(event, now);
          } catch (error) {
            console.error(`Error processing event ${event.id}:`, error);
          }
        }));

        // Yield to event loop between batches
        if (i + batchSize < scheduledEvents.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > 5000) {
        console.warn(`⚠️ Slow event processing: ${processingTime}ms`);
      }

    } catch (error) {
      console.error('❌ Error checking scheduled events:', error);
    } finally {
      this.isProcessingEvents = false;
      this.lastEventCheck = Date.now();
    }
  }

  /**
   * Process individual event schedule
   */
  private async processEventSchedule(event: Event, now: Date): Promise<void> {
    const shouldBeActive = this.shouldEventBeActive(event, now);
    const isCurrentlyActive = this.isEventCurrentlyActive(event.id);

    if (shouldBeActive && !isCurrentlyActive) {
      console.log(`🚀 Starting event execution for "${event.name}"`);
      await this.startEventExecution(event);
    } else if (!shouldBeActive && isCurrentlyActive) {
      console.log(`🛑 Stopping event execution for "${event.name}"`);
      await this.stopEventExecution(event.id);
    }
  }

  /**
   * Get all active scheduled events with caching
   */
  private async getActiveScheduledEventsWithCache(): Promise<Event[]> {
    const cacheKey = 'active_events';
    const now = Date.now();
    const cached = this.eventCache.get(cacheKey);

    // Return cached data if still valid
    if (cached && (now - cached.timestamp) < this.cacheExpiryMs) {
      return cached.events;
    }

    try {
      // Use more efficient query - only get active events
      const events = await this.eventService.findAll();
      const activeEvents = events.filter(event => event.isActive);

      // Cache the results
      this.eventCache.set(cacheKey, {
        events: activeEvents,
        timestamp: now
      });

      return activeEvents;
    } catch (error) {
      console.error('Error getting active scheduled events:', error);
      // Return cached data if available, even if expired
      return cached ? cached.events : [];
    }
  }

  /**
   * Clear event cache (call when events are modified)
   */
  public clearEventCache(): void {
    this.eventCache.clear();
  }

  /**
   * Check if an event should be active at the given time
   */
  private shouldEventBeActive(event: Event, now: Date): boolean {
    try {
      const currentTime = this.formatTime(now);
      const currentDate = this.formatDate(now);
      const currentWeekDay = this.getWeekDay(now);

      console.log(`     🕐 Current time: ${currentTime}, date: ${currentDate}, weekday: ${currentWeekDay}`);

      // Check time range
      if (event.startTime && event.endTime) {
        console.log(`     ⏰ Event time range: ${event.startTime} - ${event.endTime}`);
        if (currentTime < event.startTime || currentTime > event.endTime) {
          console.log(`     ❌ Current time ${currentTime} is outside event time range`);
          return false;
        } else {
          console.log(`     ✅ Current time ${currentTime} is within event time range`);
        }
      } else {
        console.log(`     ⚠️ Event has no time range specified`);
      }

      // Check recurrence type
      console.log(`     🔄 Checking recurrence type: ${event.recurrenceType}`);
      switch (event.recurrenceType) {
        case 'once':
          if (event.scheduledDate) {
            const scheduledDate = this.formatDate(new Date(event.scheduledDate));
            console.log(`     📅 Scheduled date: ${scheduledDate}, current date: ${currentDate}`);
            const isDateMatch = currentDate === scheduledDate;
            console.log(`     ${isDateMatch ? '✅' : '❌'} Date match: ${isDateMatch}`);
            return isDateMatch;
          }
          console.log(`     ❌ 'once' event has no scheduled date`);
          return false;

        case 'daily':
          console.log(`     ✅ Daily event - should be active every day within time range`);
          return true; // Active every day within time range

        case 'weekly':
          if (event.weekDays) {
            const allowedDays = this.parseWeekDays(event.weekDays);
            console.log(`     📅 Allowed days: ${JSON.stringify(allowedDays)}, current day: ${currentWeekDay}`);
            const isDayAllowed = allowedDays.includes(currentWeekDay);
            console.log(`     ${isDayAllowed ? '✅' : '❌'} Day allowed: ${isDayAllowed}`);
            return isDayAllowed;
          }
          console.log(`     ❌ Weekly event has no weekDays specified`);
          return false;

        case 'monthly':
          console.log(`     ❌ Monthly recurrence not implemented yet`);
          return false;

        default:
          console.log(`     ❌ Unknown recurrence type: ${event.recurrenceType}`);
          return false;
      }
    } catch (error) {
      console.error('❌ Error checking if event should be active:', error);
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

      // Get cameras associated with this event (with organization filtering)
      const eventCameras = await this.getEventCameras(event.id, event.organizationId);
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
    console.log(`🎬 Starting camera ${cameraId} for event "${event.name}" (ID: ${event.id})`);

    try {
      const camera = await this.cameraService.findById(cameraId);
      if (!camera) {
        console.error(`❌ Camera ${cameraId} not found`);
        return;
      }

      console.log(`📹 Found camera: ${camera.name}, streamUrl: ${camera.streamUrl}`);

      // Build RTSP URL with authentication
      let rtspUrl: string;
      try {
        rtspUrl = this.buildRtspUrl(camera);
        console.log(`🔗 Using RTSP URL: ${rtspUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`); // Hide credentials in logs
      } catch (error) {
        console.error(`❌ Camera ${cameraId} does not have a valid stream URL:`, error);
        return;
      }

      // Start video stream for the event
      console.log(`🎥 Starting video stream for camera ${cameraId}...`);
      const sessionId = await streamService.startStream(
        cameraId,
        rtspUrl,
        event.organizationId
      );
      console.log(`✅ Video stream started with session ID: ${sessionId}`);

      // Start independent facial recognition for the event
      const faceRecSessionId = `event-${event.id}-camera-${cameraId}-${Date.now()}`;
      console.log(`🧠 Starting facial recognition with session ID: ${faceRecSessionId}`);
      console.log(`🧠 Parameters: cameraId=${cameraId}, organizationId=${event.organizationId}, rtspUrl=${rtspUrl}, frameInterval=10`);

      await frameExtractionService.startFrameExtraction(
        faceRecSessionId,
        cameraId,
        event.organizationId,
        rtspUrl,
        10 // frameInterval in seconds - increased for better performance
      );
      console.log(`✅ Facial recognition started successfully!`);

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
   * Get cameras associated with an event with caching
   */
  private async getEventCameras(eventId: number, organizationId: number): Promise<EventCamera[]> {
    const cacheKey = `event_cameras_${eventId}_${organizationId}`;
    const now = Date.now();
    const cached = this.eventCache.get(cacheKey);

    // Check cache first
    if (cached && (now - cached.timestamp) < this.cacheExpiryMs) {
      return cached.events as EventCamera[];
    }

    try {
      console.log(`🔍 Getting cameras for event ${eventId} in organization ${organizationId}`);

      // Optimized query with proper indexing
      const eventCameras = await this.eventCameraRepository.getRepository().find({
        where: {
          eventId,
          isActive: true,
          event: { organizationId }
        },
        relations: ['camera', 'event'],
        cache: 60000, // 1 minute database-level cache
      });

      // Cache the results
      this.eventCache.set(cacheKey, {
        events: eventCameras as any,
        timestamp: now
      });

      console.log(`📋 Found ${eventCameras.length} active event-camera associations for event ${eventId}`);
      return eventCameras;
    } catch (error) {
      console.error(`Error getting cameras for event ${eventId}:`, error);
      return cached ? (cached.events as EventCamera[]) : [];
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
        if (event) {
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
   * Get service health with enhanced monitoring
   */
  public getServiceHealth() {
    return {
      isRunning: this.checkInterval !== null,
      activeSessions: this.activeSessions.size,
      checkInterval: this.checkIntervalMs,
      uptime: process.uptime(),
      lastCheck: new Date(this.lastEventCheck).toISOString(),
      performance: {
        isProcessingEvents: this.isProcessingEvents,
        cacheSize: this.eventCache.size,
        timeSinceLastCheck: Date.now() - this.lastEventCheck,
      },
      eventLoop: {
        isBlocked: this.isProcessingEvents,
        lastProcessingTime: Date.now() - this.lastEventCheck,
      },
    };
  }
}

// Export singleton instance
export const eventSchedulerService = EventSchedulerService.getInstance();