import { Router } from 'express';
import { authenticateToken, authorize } from '@/middlewares/auth';
import { organizationAccess } from '@/middlewares/organizationAccess';
import { StreamController } from '@/controllers/StreamController';

const router = Router();
const streamController = new StreamController();

// Note: HLS routes removed - all streaming now uses WebSocket for ultra-low latency

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

// Face recognition routes (independent of video streaming)
router.post('/face-recognition/camera/:cameraId/start', authorize(['admin', 'operator']), streamController.startCameraFaceRecognition);
router.post('/face-recognition/camera/:cameraId/stop', authorize(['admin', 'operator']), streamController.stopCameraFaceRecognition);
router.get('/face-recognition/camera/:cameraId/status', authorize(['admin', 'operator']), streamController.getCameraFaceRecognitionStatus);

// Legacy face recognition routes (for existing video streams)
router.get('/face-recognition/health', authorize(['admin']), streamController.getFaceRecognitionHealth);
router.get('/face-recognition/sessions', authorize(['admin', 'operator']), streamController.getActiveFaceRecognitionSessions);
router.post('/face-recognition/enable/:sessionId', authorize(['admin', 'operator']), streamController.enableFaceRecognition);
router.post('/face-recognition/disable/:sessionId', authorize(['admin', 'operator']), streamController.disableFaceRecognition);

export default router;