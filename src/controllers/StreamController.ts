import { Request, Response } from 'express';
import { streamService } from '../services/StreamService';
import { asyncHandler, createError } from '../middlewares/errorHandler';
import { CameraService } from '../services';
import { frameExtractionService } from '../services/FrameExtractionService';
import { faceRecognitionService } from '../services/FaceRecognitionService';

export class StreamController {
  private cameraService: CameraService;

  constructor() {
    this.cameraService = new CameraService();
  }

  /**
   * Build RTSP URL with authentication credentials
   */
  private buildRtspUrl(camera: any): string {
    if (!camera.streamUrl) {
      throw createError('Camera does not have a valid stream URL', 400);
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
   * @swagger
   * /api/v1/streams/start/{cameraId}:
   *   post:
   *     summary: Start streaming for a camera
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: cameraId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Stream started successfully
   *       404:
   *         description: Camera not found
   *       500:
   *         description: Failed to start stream
   */
  startStream = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cameraId } = req.params;
    const cameraIdNum = parseInt(cameraId);

    if (isNaN(cameraIdNum)) {
      throw createError('Invalid camera ID', 400);
    }

    // Get camera details
    const camera = await this.cameraService.findById(cameraIdNum);
    if (!camera) {
      throw createError('Camera not found', 404);
    }

    // Build RTSP URL with authentication
    const rtspUrl = this.buildRtspUrl(camera);

    try {
      const organizationId = camera.organizationId;

      console.log(`Starting video stream for camera ${cameraIdNum}, RTSP: ${rtspUrl}`);

      const sessionId = await streamService.startStream(
        cameraIdNum,
        rtspUrl,
        organizationId
      );

      console.log(`WebSocket video stream started successfully with session ID: ${sessionId}`);

      res.status(200).json({
        success: true,
        message: 'WebSocket video stream started successfully',
        data: {
          sessionId,
          streamUrl: '/ws/stream',
          cameraId: cameraIdNum,
          streamType: 'websocket',
        },
      });
    } catch (error: any) {
      throw createError(`Failed to start stream: ${error.message}`, 500);
    }
  });

  /**
   * @swagger
   * /api/v1/streams/stop/{sessionId}:
   *   post:
   *     summary: Stop a streaming session
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Stream stopped successfully
   *       404:
   *         description: Stream session not found
   */
  stopStream = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    console.log(`Attempting to stop stream session: ${sessionId}`);

    const success = streamService.stopStream(sessionId);

    if (!success) {
      console.warn(`Stream session ${sessionId} not found - may have already been cleaned up`);
      // Return success anyway since the goal (stream stopped) is achieved
      res.status(200).json({
        success: true,
        message: 'Stream session not found (may have already been stopped)',
        warning: 'Session was already cleaned up'
      });
      return;
    }

    console.log(`Stream session ${sessionId} stopped successfully`);
    res.status(200).json({
      success: true,
      message: 'Stream stopped successfully',
    });
  });

    /**
   * @swagger
   * /api/v1/streams/status/{sessionId}:
   *   get:
   *     summary: Get stream status
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Stream status
   */
  getStreamStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const isActive = streamService.isStreamActive(sessionId);
    const streamUrl = streamService.getStreamUrl(sessionId);

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        isActive,
        streamUrl,
      },
    });
  });

  /**
   * @swagger
   * /api/v1/streams/active:
   *   get:
   *     summary: Get all active streams
   *     tags: [Streams]
   *     responses:
   *       200:
   *         description: List of active streams
   */
  getActiveStreams = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const activeSessions = streamService.getActiveSessions();

    const streams = activeSessions.map(session => ({
      sessionId: session.id,
      cameraId: session.cameraId,
      streamUrl: streamService.getStreamUrl(session.id),
      createdAt: session.createdAt,
      lastAccessed: session.lastAccessed,
    }));

    res.status(200).json({
      success: true,
      message: 'Active streams retrieved successfully',
      data: streams,
    });
  });

  /**
   * @swagger
   * /api/v1/streams/cleanup:
   *   post:
   *     summary: Cleanup multiple live viewing streams (for browser close)
   *     tags: [Streams]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sessionIds:
   *                 type: array
   *                 items:
   *                   type: string
   *         application/x-www-form-urlencoded:
   *           schema:
   *             type: object
   *             properties:
   *               sessionIds:
   *                 type: string
   *     responses:
   *       200:
   *         description: Cleanup completed
   */
  cleanupStreams = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    let sessionIds: string[] = [];

    // Handle both JSON and form data (for sendBeacon)
    if (req.body.sessionIds) {
      if (Array.isArray(req.body.sessionIds)) {
        sessionIds = req.body.sessionIds;
      } else {
        // Handle comma-separated string from form data
        sessionIds = req.body.sessionIds.split(',').map((id: string) => id.trim());
      }
    }

    console.log(`Browser cleanup request for ${sessionIds.length} live viewing streams`);

    const results = sessionIds.map(sessionId => {
      const success = streamService.stopStream(sessionId);
      console.log(`Cleanup stream ${sessionId}: ${success ? 'success' : 'not found'}`);
      return { sessionId, success };
    });

    const successCount = results.filter(r => r.success).length;

    res.status(200).json({
      success: true,
      message: `Cleaned up ${successCount}/${sessionIds.length} live viewing streams`,
      results,
    });
  });

  /**
   * @swagger
   * /api/v1/streams/health:
   *   get:
   *     summary: Get streaming service health
   *     tags: [Streams]
   *     responses:
   *       200:
   *         description: Service health information
   */
  getServiceHealth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const health = streamService.getServiceHealth();

    res.status(200).json({
      success: true,
      message: 'Streaming service health',
      data: health,
    });
  });

  /**
   * @swagger
   * /api/v1/streams/camera/{cameraId}/url:
   *   get:
   *     summary: Get stream URL for a camera (start if not active)
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: cameraId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Stream URL for the camera
   *       404:
   *         description: Camera not found
   */
  getCameraStreamUrl = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cameraId } = req.params;
    const cameraIdNum = parseInt(cameraId);

    if (isNaN(cameraIdNum)) {
      throw createError('Invalid camera ID', 400);
    }

    // Check if there's already an active session for this camera
    const activeSessions = streamService.getActiveSessions();
    const existingSession = activeSessions.find(session => session.cameraId === cameraIdNum);

    if (existingSession) {
      res.status(200).json({
        success: true,
        message: 'WebSocket stream already active',
        data: {
          sessionId: existingSession.id,
          streamUrl: '/ws/stream',
          cameraId: cameraIdNum,
          streamType: 'websocket',
        },
      });
      return;
    }

    // Start new stream
    const camera = await this.cameraService.findById(cameraIdNum);
    if (!camera) {
      throw createError('Camera not found', 404);
    }

    // Build RTSP URL with authentication
    const rtspUrl = this.buildRtspUrl(camera);

    try {
      const organizationId = camera.organizationId;

      const sessionId = await streamService.startStream(
        cameraIdNum,
        rtspUrl,
        organizationId
      );

      res.status(200).json({
        success: true,
        message: 'WebSocket video stream started successfully',
        data: {
          sessionId,
          streamUrl: '/ws/stream',
          cameraId: cameraIdNum,
          streamType: 'websocket',
        },
      });
    } catch (error: any) {
      throw createError(`Failed to start stream: ${error.message}`, 500);
    }
  });

  /**
   * @swagger
   * /api/v1/streams/face-recognition/health:
   *   get:
   *     summary: Get face recognition service health
   *     tags: [Streams]
   *     responses:
   *       200:
   *         description: Face recognition service health
   */
  getFaceRecognitionHealth = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const health = {
      frameExtraction: frameExtractionService.getServiceHealth(),
      faceRecognition: faceRecognitionService.getServiceHealth(),
    };

    res.status(200).json({
      success: true,
      message: 'Face recognition service health',
      data: health,
    });
  });

  /**
   * @swagger
   * /api/v1/streams/face-recognition/sessions:
   *   get:
   *     summary: Get active face recognition sessions
   *     tags: [Streams]
   *     responses:
   *       200:
   *         description: Active face recognition sessions
   */
  getActiveFaceRecognitionSessions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sessions = frameExtractionService.getActiveSessions();

    res.status(200).json({
      success: true,
      message: 'Active face recognition sessions',
      data: sessions,
    });
  });

  /**
   * @swagger
   * /api/v1/face-recognition/camera/{cameraId}/start:
   *   post:
   *     summary: Start facial recognition for a camera (independent of video streaming)
   *     tags: [Face Recognition]
   *     parameters:
   *       - in: path
   *         name: cameraId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Facial recognition started successfully
   *       404:
   *         description: Camera not found
   */
  startCameraFaceRecognition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cameraId } = req.params;
    const cameraIdNum = parseInt(cameraId);

    if (isNaN(cameraIdNum)) {
      throw createError('Invalid camera ID', 400);
    }

    // Get camera details
    const camera = await this.cameraService.findById(cameraIdNum);
    if (!camera) {
      throw createError('Camera not found', 404);
    }

    if (!camera.organizationId) {
      throw createError('Organization ID required for face recognition', 400);
    }

    // Build RTSP URL with authentication
    const rtspUrl = this.buildRtspUrl(camera);

    try {
      // Start face recognition with a unique session ID for background processing
      const sessionId = `face-rec-${cameraIdNum}-${Date.now()}`;

      await frameExtractionService.startFrameExtraction(
        sessionId,
        cameraIdNum,
        camera.organizationId,
        rtspUrl,
        2 // frameInterval in seconds
      );

      res.status(200).json({
        success: true,
        message: 'Facial recognition started successfully for camera',
        data: {
          cameraId: cameraIdNum,
          sessionId,
          isActive: true,
        },
      });
    } catch (error: any) {
      throw createError(`Failed to start facial recognition: ${error.message}`, 500);
    }
  });

  /**
   * @swagger
   * /api/v1/face-recognition/camera/{cameraId}/stop:
   *   post:
   *     summary: Stop facial recognition for a camera
   *     tags: [Face Recognition]
   *     parameters:
   *       - in: path
   *         name: cameraId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Facial recognition stopped successfully
   */
  stopCameraFaceRecognition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cameraId } = req.params;
    const cameraIdNum = parseInt(cameraId);

    if (isNaN(cameraIdNum)) {
      throw createError('Invalid camera ID', 400);
    }

    try {
      // Find and stop all face recognition sessions for this camera
      const activeSessions = frameExtractionService.getActiveSessions();
      const cameraSessions = activeSessions.filter(session => session.cameraId === cameraIdNum);

      if (cameraSessions.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No active facial recognition sessions found for camera',
          data: {
            cameraId: cameraIdNum,
            isActive: false,
          },
        });
        return;
      }

      // Stop all face recognition sessions for this camera
      cameraSessions.forEach(session => {
        frameExtractionService.stopFrameExtraction(session.sessionId);
      });

      res.status(200).json({
        success: true,
        message: 'Facial recognition stopped successfully for camera',
        data: {
          cameraId: cameraIdNum,
          isActive: false,
          stoppedSessions: cameraSessions.length,
        },
      });
    } catch (error: any) {
      throw createError(`Failed to stop facial recognition: ${error.message}`, 500);
    }
  });

  /**
   * @swagger
   * /api/v1/face-recognition/camera/{cameraId}/status:
   *   get:
   *     summary: Get facial recognition status for a camera
   *     tags: [Face Recognition]
   *     parameters:
   *       - in: path
   *         name: cameraId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Facial recognition status
   */
  getCameraFaceRecognitionStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { cameraId } = req.params;
    const cameraIdNum = parseInt(cameraId);

    if (isNaN(cameraIdNum)) {
      throw createError('Invalid camera ID', 400);
    }

    try {
      // Check for active face recognition sessions for this camera
      const activeSessions = frameExtractionService.getActiveSessions();
      const cameraSessions = activeSessions.filter(session => session.cameraId === cameraIdNum);

      const isActive = cameraSessions.length > 0;
      const sessionId = isActive ? cameraSessions[0].sessionId : undefined;

      res.status(200).json({
        success: true,
        data: {
          cameraId: cameraIdNum,
          isActive,
          sessionId,
          activeSessions: cameraSessions.length,
        },
      });
    } catch (error: any) {
      throw createError(`Failed to get facial recognition status: ${error.message}`, 500);
    }
  });

  /**
   * @swagger
   * /api/v1/streams/face-recognition/enable/{sessionId}:
   *   post:
   *     summary: Enable face recognition for an existing stream
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Face recognition enabled
   *       404:
   *         description: Stream session not found
   */
  enableFaceRecognition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    // Get the stream session
    const activeSessions = streamService.getActiveSessions();
    const session = activeSessions.find(s => s.id === sessionId);

    if (!session) {
      throw createError('Stream session not found', 404);
    }

    if (!session.organizationId) {
      throw createError('Organization ID required for face recognition', 400);
    }

    // Start face recognition
    await frameExtractionService.startFrameExtraction(
      sessionId,
      session.cameraId,
      session.organizationId,
      session.rtspUrl,
      5
    );

    res.status(200).json({
      success: true,
      message: 'Face recognition enabled for stream',
      data: {
        sessionId,
        cameraId: session.cameraId,
        faceRecognitionEnabled: true,
      },
    });
  });

  /**
   * @swagger
   * /api/v1/streams/face-recognition/disable/{sessionId}:
   *   post:
   *     summary: Disable face recognition for a stream
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Face recognition disabled
   */
  disableFaceRecognition = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const success = frameExtractionService.stopFrameExtraction(sessionId);

    if (!success) {
      throw createError('Face recognition session not found', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Face recognition disabled for stream',
      data: {
        sessionId,
        faceRecognitionEnabled: false,
      },
    });
  });
}