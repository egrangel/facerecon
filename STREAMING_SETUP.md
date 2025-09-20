# Live Streaming Setup Guide

This document explains how to set up live RTSP streaming with FFmpeg conversion to HLS for web browser compatibility.

## 📋 Prerequisites

### 1. Install FFmpeg

#### Windows:
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
# Add to PATH: C:\ffmpeg\bin
```

#### macOS:
```bash
# Using Homebrew
brew install ffmpeg
```

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install ffmpeg
```

#### CentOS/RHEL:
```bash
sudo yum install epel-release
sudo yum install ffmpeg
```

### 2. Verify Installation
```bash
ffmpeg -version
```

## 🚀 Backend Setup

### 1. Install Dependencies
```bash
cd facial-recognition-backend
npm install
```

### 2. Environment Variables
Add to your `.env` file:
```env
# Streaming Configuration
STREAMS_DIR=./streams
STREAM_SEGMENT_DURATION=2
STREAM_PLAYLIST_SIZE=3
STREAM_CLEANUP_INTERVAL=30000
```

### 3. Start Backend Server
```bash
npm run dev
```

## 🎥 Frontend Setup

### 1. Install Dependencies
```bash
cd facial-recognition-frontend
npm install
```

### 2. Environment Configuration
Create `.env` file:
```env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ENV=development
REACT_APP_DEBUG=true
```

### 3. Start Frontend
```bash
npm start
```

## 📡 How It Works

### Backend Stream Processing
1. **RTSP Input**: Receives RTSP streams from cameras
2. **FFmpeg Conversion**: Converts RTSP to HLS (HTTP Live Streaming)
3. **Segment Generation**: Creates .ts video segments and .m3u8 playlist
4. **HTTP Serving**: Serves HLS files via REST API

### Frontend Stream Playback
1. **HLS.js Integration**: Uses HLS.js library for cross-browser compatibility
2. **Video Element**: Native HTML5 video with HLS support
3. **Stream Controls**: Start/stop/refresh functionality
4. **Error Handling**: Comprehensive error states and recovery

## 🛠️ API Endpoints

### Stream Management
- `POST /api/v1/streams/start/{cameraId}` - Start streaming
- `POST /api/v1/streams/stop/{sessionId}` - Stop streaming
- `GET /api/v1/streams/status/{sessionId}` - Get stream status
- `GET /api/v1/streams/camera/{cameraId}/url` - Get/start camera stream

### Stream Playback
- `GET /api/v1/streams/{sessionId}/playlist.m3u8` - HLS playlist
- `GET /api/v1/streams/{sessionId}/segments/{segmentName}` - HLS segments

### Administrative
- `GET /api/v1/streams/active` - List active streams
- `GET /api/v1/streams/health` - Service health check

## 🎮 Usage

### 1. Add Camera with RTSP URL
```javascript
{
  "name": "Camera 1",
  "streamUrl": "rtsp://username:password@192.168.1.100:554/stream",
  "protocol": "rtsp",
  "location": "Front Door"
}
```

### 2. Start Streaming
- Click "Iniciar" button on camera card
- Stream will automatically convert RTSP to HLS
- Video will appear in the camera card

### 3. Monitor Streams
- Check `/api/v1/streams/health` for service status
- View active streams at `/api/v1/streams/active`

## 🔧 Configuration

### FFmpeg Options
The service uses optimized FFmpeg settings for low-latency streaming with native Node.js child_process:

```javascript
const ffmpegArgs = [
  // Input options
  '-rtsp_transport', 'tcp',
  '-analyzeduration', '1000000',
  '-probesize', '1000000',
  '-max_delay', '500000',
  '-i', rtspUrl,

  // Video encoding
  '-c:v', 'libx264',        // Video codec
  '-preset', 'ultrafast',    // Encoding speed
  '-tune', 'zerolatency',   // Optimize for live streaming
  '-profile:v', 'baseline',
  '-level', '3.0',
  '-pix_fmt', 'yuv420p',

  // Audio encoding
  '-c:a', 'aac',            // Audio codec
  '-b:a', '128k',
  '-ar', '44100',

  // HLS output
  '-f', 'hls',              // Output format
  '-hls_time', '2',         // 2-second segments
  '-hls_list_size', '3',    // Keep 3 segments
  '-hls_flags', 'delete_segments+append_list',
  '-hls_allow_cache', '0',
  '-hls_segment_filename', segmentPattern,
  hlsPath
];
```

### Browser Compatibility
- **Chrome/Firefox/Edge**: Uses HLS.js
- **Safari**: Native HLS support
- **Mobile**: Full support on iOS and Android

## 🐛 Troubleshooting

### Common Issues

#### 1. FFmpeg Not Found
```bash
Error: spawn ffmpeg ENOENT
```
**Solution**: Install FFmpeg and add to PATH

#### 2. RTSP Connection Failed
```bash
Connection to rtsp://... failed
```
**Solutions**:
- Check camera IP/URL
- Verify credentials
- Test with VLC: `vlc rtsp://your-camera-url`

#### 3. HLS Playback Issues
```bash
HLS Error: NETWORK_ERROR
```
**Solutions**:
- Check CORS configuration
- Verify stream URL accessibility
- Check browser console for errors

#### 4. High CPU Usage
**Solutions**:
- Adjust FFmpeg preset (fast, medium, slow)
- Reduce video resolution/bitrate
- Limit concurrent streams

### Debug Commands

#### Test RTSP URL
```bash
ffmpeg -i rtsp://camera-url -t 10 -f null -
```

#### Manual HLS Conversion
```bash
ffmpeg -i rtsp://camera-url \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -c:a aac -f hls -hls_time 2 -hls_list_size 3 \
  output.m3u8
```

#### Check Stream Health
```bash
curl http://localhost:3000/api/v1/streams/health
```

## 📊 Performance Optimization

### Backend
- **Stream Cleanup**: Automatic cleanup of inactive streams after 5 minutes of inactivity
- **Resource Monitoring**: Track CPU/memory usage per FFmpeg process
- **Process Management**: Native Node.js child_process with graceful termination (SIGTERM + SIGKILL fallback)
- **FFmpeg Availability Check**: Automatic verification of FFmpeg installation on startup

### Frontend
- **Low Latency Mode**: HLS.js configured for minimal delay
- **Buffer Management**: Optimized buffer settings
- **Error Recovery**: Automatic reconnection on failures

## 🔒 Security Considerations

1. **RTSP Credentials**: Store securely, never expose in client
2. **Stream Access**: Implement proper authentication
3. **Rate Limiting**: Prevent stream abuse
4. **CORS**: Configure properly for production
5. **HTTPS**: Use secure connections in production

## 📝 Production Deployment

### Docker Configuration
```dockerfile
# Install FFmpeg in Docker
RUN apt-get update && apt-get install -y ffmpeg
```

### Load Balancing
- Use nginx for HLS segment caching
- Distribute stream processing across servers
- Implement health checks

### Monitoring
- Monitor FFmpeg processes
- Track stream quality metrics
- Set up alerts for failures