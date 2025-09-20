import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { streamService } from '../services/StreamService';
import { asyncHandler, createError } from '../middlewares/errorHandler';
import { CameraService } from '../services';

export class StreamController {
  private cameraService: CameraService;

  constructor() {
    this.cameraService = new CameraService();
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

    // Validate camera has RTSP URL
    if (!camera.streamUrl && !camera.ip) {
      throw createError('Camera does not have a valid stream URL or IP', 400);
    }

    // Construct RTSP URL
    let rtspUrl = camera.streamUrl;
    if (!rtspUrl) {
      rtspUrl = `rtsp://${camera.ip}:${camera.port || 554}/stream`;
    }

    try {
      const sessionId = await streamService.startStream(cameraIdNum, rtspUrl);

      res.status(200).json({
        success: true,
        message: 'Stream started successfully',
        data: {
          sessionId,
          streamUrl: `/api/v1/streams/${sessionId}/playlist.m3u8`,
          cameraId: cameraIdNum,
          rtspUrl: rtspUrl,
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

    const success = streamService.stopStream(sessionId);

    if (!success) {
      throw createError('Stream session not found', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Stream stopped successfully',
    });
  });

  /**
   * @swagger
   * /api/v1/streams/{sessionId}/playlist.m3u8:
   *   get:
   *     summary: Get HLS playlist for a stream
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: HLS playlist
   *         content:
   *           application/vnd.apple.mpegurl:
   *             schema:
   *               type: string
   *       404:
   *         description: Stream not found
   */
  getPlaylist = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const playlistPath = streamService.getStreamPath(sessionId);
    if (!playlistPath || !fs.existsSync(playlistPath)) {
      throw createError('Stream not found or not ready', 404);
    }

    // Set appropriate headers for HLS
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');

    // Read and serve the playlist
    const playlistContent = fs.readFileSync(playlistPath, 'utf8');
    res.send(playlistContent);
  });

  /**
   * @swagger
   * /api/v1/streams/{sessionId}/segments/{segmentName}:
   *   get:
   *     summary: Get HLS segment for a stream
   *     tags: [Streams]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: segmentName
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: HLS segment
   *         content:
   *           video/mp2t:
   *             schema:
   *               type: string
   *               format: binary
   *       404:
   *         description: Segment not found
   */
  getSegment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId, segmentName } = req.params;

    // Validate segment name format (security check)
    const segmentPattern = new RegExp(`^${sessionId}_\\d{3}\\.ts$`);
    if (!segmentPattern.test(segmentName)) {
      throw createError('Invalid segment name', 400);
    }

    const segmentPath = streamService.getSegmentPath(sessionId, segmentName);
    if (!segmentPath || !fs.existsSync(segmentPath)) {
      throw createError('Segment not found', 404);
    }

    // Set appropriate headers for video segments
    res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream the segment file
    const stream = fs.createReadStream(segmentPath);
    stream.pipe(res);
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
        message: 'Stream already active',
        data: {
          sessionId: existingSession.id,
          streamUrl: streamService.getStreamUrl(existingSession.id),
          cameraId: cameraIdNum,
        },
      });
      return;
    }

    // Start new stream
    const camera = await this.cameraService.findById(cameraIdNum);
    if (!camera) {
      throw createError('Camera not found', 404);
    }

    if (!camera.streamUrl && !camera.ip) {
      throw createError('Camera does not have a valid stream URL or IP', 400);
    }

    let rtspUrl = camera.streamUrl;
    if (!rtspUrl) {
      rtspUrl = `rtsp://${camera.ip}:${camera.port || 554}/stream`;
    }

    try {
      const sessionId = await streamService.startStream(cameraIdNum, rtspUrl);

      res.status(200).json({
        success: true,
        message: 'Stream started successfully',
        data: {
          sessionId,
          streamUrl: `/streams/${sessionId}/playlist.m3u8`,
          cameraId: cameraIdNum,
          rtspUrl: rtspUrl,
        },
      });
    } catch (error: any) {
      throw createError(`Failed to start stream: ${error.message}`, 500);
    }
  });
}