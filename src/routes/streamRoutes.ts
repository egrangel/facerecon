import { Router } from 'express';
import { authenticateToken, authorize } from '@/middlewares/auth';
import { organizationAccess } from '@/middlewares/organizationAccess';
import { StreamController } from '@/controllers/StreamController';

const router = Router();
const streamController = new StreamController();

// Public routes (no auth required for stream access) - MUST come before auth middleware
router.get('/:sessionId/playlist.m3u8', streamController.getPlaylist);
router.get('/:sessionId/segments/:segmentName', streamController.getSegment);
// Also support direct segment access (for FFmpeg generated playlist URLs)
router.get('/:sessionId/:segmentName', streamController.getSegment);

// Protected routes (require authentication)
router.use(authenticateToken);
router.use(organizationAccess);

// Stream management routes
router.post('/start/:cameraId', authorize(['admin', 'operator']), streamController.startStream);
router.post('/stop/:sessionId', authorize(['admin', 'operator']), streamController.stopStream);
router.get('/status/:sessionId', streamController.getStreamStatus);
router.get('/camera/:cameraId/url', streamController.getCameraStreamUrl);

// Administrative routes
router.get('/active', authorize(['admin', 'operator']), streamController.getActiveStreams);
router.get('/health', authorize(['admin']), streamController.getServiceHealth);

// Face recognition routes
router.get('/face-recognition/health', authorize(['admin']), streamController.getFaceRecognitionHealth);
router.get('/face-recognition/sessions', authorize(['admin', 'operator']), streamController.getActiveFaceRecognitionSessions);
router.post('/face-recognition/enable/:sessionId', authorize(['admin', 'operator']), streamController.enableFaceRecognition);
router.post('/face-recognition/disable/:sessionId', authorize(['admin', 'operator']), streamController.disableFaceRecognition);

export default router;