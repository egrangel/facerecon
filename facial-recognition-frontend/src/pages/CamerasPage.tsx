import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Camera } from '../types/api';
import Hls from 'hls.js';

interface CameraFormData {
  name: string;
  description?: string;
  ip: string;
  port: number;
  username?: string;
  password?: string;
  streamUrl?: string;
  protocol: string;
  location?: string;
  status: string;
  settings?: string;
  organizationId: number;
}

interface LiveStreamContainerProps {
  camera: Camera;
  className?: string;
}

const LiveStreamContainer: React.FC<LiveStreamContainerProps> = ({ camera, className = '' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup HLS instance and timeout on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startStream = async () => {
    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      // Start stream on backend
      const response = await apiClient.getCameraStreamUrl(camera.id);
      setSessionId(response.sessionId);

      // Set 10-second timeout to cancel stream if not playing
      timeoutRef.current = setTimeout(async () => {
        if (!isPlaying) {
          console.warn('Stream timeout: canceling after 30 seconds');
          setIsLoading(false);
          setHasError(true);
          setErrorMessage('Timeout: Stream n�o iniciou em 30 segundos');

          // Stop the stream session
          await stopStreamSession(response);

          // Cleanup HLS
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }

          setSessionId(null);
        }
      }, 30000);

      // Initialize HLS player
      if (videoRef.current) {
        const video = videoRef.current;

        if (Hls.isSupported()) {
          // Use HLS.js for browsers that support it
          const hls = new Hls({
            enableWorker: false,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hlsRef.current = hls;
          const src = `${process.env.REACT_APP_API_URL}${response.streamUrl}`;
          hls.loadSource(src);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Clear timeout since stream is ready
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsLoading(false);
            setIsPlaying(true);
            video.play().catch(err => {
              console.warn('Autoplay failed:', err);
              setHasError(true);
              setErrorMessage('Autoplay bloqueado. Clique para reproduzir.');
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error('HLS Error:', event, data);
            if (data.fatal) {
              setIsLoading(false);
              setHasError(true);
              setIsPlaying(false);
              stopStreamSession(response);
              setSessionId(null);
              setErrorMessage(`Erro no stream: ${data.type} - ${data.details}`);
            }
          });

        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = `${process.env.REACT_APP_API_URL}${response.streamUrl}`;

          video.addEventListener('loadedmetadata', () => {
            // Clear timeout since stream is ready
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setIsLoading(false);
            setIsPlaying(true);
          });

          video.addEventListener('error', () => {
            setIsLoading(false);
            setHasError(true);
            setIsPlaying(false);
            setErrorMessage('Erro ao carregar o stream');
          });

          video.load();
        } else {
          throw new Error('HLS not supported in this browser');
        }
      }
    } catch (error: any) {
      console.error('Error starting stream:', error);
      setIsLoading(false);
      setHasError(true);
      setIsPlaying(false);
      setErrorMessage(error.response?.data?.message || error.message || 'Erro ao iniciar stream');
    }
  };

  const stopStream = async () => {
    try {
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Stop HLS player
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }

      // Stop stream on backend
      if (sessionId) {
        await apiClient.stopStream(sessionId);
        setSessionId(null);
      }

      setIsPlaying(false);
      setIsLoading(false);
      setHasError(false);
      setErrorMessage('');
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  };

  const refreshStream = () => {
    stopStream().then(() => {
      setTimeout(() => startStream(), 1000);
    });
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      <div className="relative aspect-video">
        {/* Video Container */}
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          {/* Always render video element but hide it when not playing */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isPlaying ? 'block' : 'hidden'}`}
            autoPlay
            muted
            playsInline
            controls={false}
          />

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-white">
              <div>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Conectando...</p>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-white p-4">
              <div>
                <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm mb-2">Erro na conexão</p>
                <p className="text-xs text-gray-400 mb-3">
                  {errorMessage || `${camera.streamUrl || `${camera.ip}:${camera.port}`}`}
                </p>
                <Button
                  size="sm"
                  onClick={refreshStream}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {!isLoading && !hasError && !isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                onClick={startStream}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-6V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1" />
                </svg>
                Conectar Câmera
              </Button>
            </div>
          )}

          {/* Stream Info Overlay - only show when playing */}
          {isPlaying && (
            <>
              <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                {camera.protocol.toUpperCase()} • {camera.name}
              </div>

              {/* Live Indicator */}
              <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                AO VIVO
              </div>
            </>
          )}

          {/* Click to play overlay (if autoplay failed) */}
          {hasError && errorMessage.includes('Autoplay') && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <Button
                onClick={() => videoRef.current?.play()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Reproduzir
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stream Controls */}
      <div className="p-3 bg-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {!isPlaying ? (
            <Button
              size="sm"
              onClick={startStream}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              Iniciar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={stopStream}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h12v12H6z"/>
              </svg>
              Parar
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs text-gray-300">
          <span className={`w-2 h-2 rounded-full ${
            camera.status === 'active' ? 'bg-green-400' :
            camera.status === 'inactive' ? 'bg-red-400' : 'bg-yellow-400'
          }`}></span>
          <span>{camera.status}</span>
        </div>
      </div>
    </div>
  );
};

const CamerasPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: camerasResponse, isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: async () => {
      return await apiClient.getCameras();
    },
  });

  const cameras = camerasResponse?.data || [];

  const createCameraMutation = useMutation({
    mutationFn: async (data: CameraFormData) => {
      return await apiClient.createCamera(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const updateCameraMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CameraFormData }) => {
      return await apiClient.updateCamera(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const deleteCameraMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.deleteCamera(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
  });

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (camera.location ? camera.location.toLowerCase().includes(searchTerm.toLowerCase()) : false)
  );

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta câmera?')) {
      deleteCameraMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Câmeras</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gerencie as câmeras do sistema de reconhecimento facial
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Nova Câmera
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="max-w-md">
            <Input
              placeholder="Buscar por nome ou localização..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredCameras.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhuma câmera encontrada
          </div>
        ) : (
          filteredCameras.map((camera: Camera) => (
            <Card key={camera.id}>
              <CardContent className="p-0">
                {/* Live Stream Container */}
                <LiveStreamContainer camera={camera} />

                {/* Camera Information */}
                <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{camera.name}</h3>
                        <p className="text-sm text-gray-500">{camera.location}</p>
                      </div>
                    </div>

                    <div className="mt-6 flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(camera)}
                        className="flex-1"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(camera.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <CameraModal
          camera={editingCamera}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCamera(null);
          }}
          onSave={(data) => {
            if (editingCamera) {
              updateCameraMutation.mutate({ id: editingCamera.id, data });
            } else {
              createCameraMutation.mutate(data);
            }
          }}
          isLoading={createCameraMutation.isPending || updateCameraMutation.isPending}
        />
      )}
    </div>
  );
};

interface CameraModalProps {
  camera: Camera | null;
  onClose: () => void;
  onSave: (data: CameraFormData) => void;
  isLoading: boolean;
}

const CameraModal: React.FC<CameraModalProps> = ({ camera, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState<CameraFormData>({
    name: camera?.name || '',
    description: camera?.description || '',
    ip: camera?.ip || '',
    port: camera?.port || 8080,
    username: camera?.username || '',
    password: camera?.password || '',
    streamUrl: camera?.streamUrl || '',
    protocol: camera?.protocol || 'rtsp',
    location: camera?.location || '',
    status: camera?.status || 'active',
    settings: camera?.settings || '',
    organizationId: camera?.organizationId || 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {camera ? 'Edit Camera' : 'New Camera'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
          />

          <Input
            label="URL/Endereço"
            value={formData.streamUrl}
            onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
            placeholder="Ex: rtsp://192.168.1.100:554/stream"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Protocol
            </label>
            <select
              value={formData.protocol}
              onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="ip">IP</option>
              <option value="usb">USB</option>
              <option value="rtsp">RTSP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' | 'maintenance' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <Input
            label="IP Address"
            value={formData.ip}
            onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
            placeholder="Ex: 192.168.1.100"
          />

          <Input
            label="Port"
            type="number"
            value={formData.port.toString()}
            onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 8080 })}
            placeholder="Ex: 554"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {camera ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CamerasPage;

async function stopStreamSession(response: { sessionId: string; streamUrl: string; }) {
  try {
    if (response.sessionId) {
      await apiClient.stopStream(response.sessionId);
    }
  } catch (error) {
    console.error('Error stopping timed out stream:', error);
  }
}
