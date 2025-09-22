import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Camera } from '../types/api';
import { StreamPlayer } from '../components/StreamPlayer';
import { useWebSocketStream } from '../contexts/WebSocketStreamContext';

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
  const [error, setError] = useState<string | null>(null);
  const webSocketStream = useWebSocketStream();
  const webSocketState = webSocketStream.getStreamState(camera.id);
  const webSocketSession = webSocketStream.streams.get(camera.id);

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    console.error(`Camera ${camera.id} stream error:`, errorMessage);
  };

  const handleStartStream = async () => {
    try {
      await webSocketStream.startStream(camera.id);
    } catch (error: any) {
      handleError(error.message || 'Failed to start stream');
    }
  };

  const handleStopStream = async () => {
    try {
      await webSocketStream.stopStream(camera.id);
    } catch (error: any) {
      console.error('Error stopping stream:', error);
    }
  };

  const handleRefreshStream = async () => {
    try {
      await webSocketStream.refreshStream(camera.id);
    } catch (error: any) {
      handleError(error.message || 'Failed to refresh stream');
    }
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      <div className="relative aspect-video">
        <StreamPlayer
          cameraId={camera.id}
          className="w-full h-full"
          onError={handleError}
        />

        {/* Camera Info Overlay */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
          {camera.name} • {camera.protocol.toUpperCase()}
        </div>

        {/* Error Display */}
        {error && (
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-red-600 bg-opacity-90 text-white text-xs px-2 py-1 rounded max-w-xs text-center">
            {error}
          </div>
        )}
      </div>

      {/* Stream Status */}
      <div className="p-3 bg-gray-800 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-300">
          <span className={`w-2 h-2 rounded-full ${
            camera.status === 'active' ? 'bg-green-400' :
            camera.status === 'inactive' ? 'bg-red-400' : 'bg-yellow-400'
          }`}></span>
          <span>{camera.status}</span>
        </div>

        {/* Stream Control Buttons */}
        <div className="flex items-center space-x-2">
          {webSocketSession && webSocketSession.sessionId ? (
            <>
              <button
                onClick={webSocketState.isPlaying ? handleStopStream : handleStartStream}
                disabled={webSocketState.isLoading}
                className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50"
              >
                {webSocketState.isLoading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent mr-1"></div>
                    Loading...
                  </span>
                ) : webSocketState.isPlaying ? (
                  '⏹ Stop'
                ) : (
                  '▶ Play'
                )}
              </button>
              <button
                onClick={handleRefreshStream}
                disabled={webSocketState.isLoading}
                className="px-3 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50"
              >
                🔄 Refresh
              </button>
            </>
          ) : (
            <button
              onClick={handleStartStream}
              disabled={webSocketState.isLoading}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {webSocketState.isLoading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent mr-1"></div>
                  Starting...
                </span>
              ) : (
                '▶ Start Stream'
              )}
            </button>
          )}
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
    queryFn: () => apiClient.getCameras(),
  });

  const cameras = camerasResponse?.data || [];
  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    camera.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createCameraMutation = useMutation({
    mutationFn: (data: Omit<CameraFormData, 'organizationId'>) =>
      apiClient.createCamera({ ...data, organizationId: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const updateCameraMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CameraFormData> }) =>
      apiClient.updateCamera(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const deleteCameraMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
  });

  const handleSubmit = (data: CameraFormData) => {
    if (editingCamera) {
      updateCameraMutation.mutate({ id: editingCamera.id, data });
    } else {
      createCameraMutation.mutate(data);
    }
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta câmera?')) {
      deleteCameraMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Câmeras</h1>
          <p className="text-gray-600">Gerencie as câmeras do sistema</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Adicionar Câmera
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Buscar por nome ou localização..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Cameras Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCameras.map((camera) => (
          <Card key={camera.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Live Stream Container */}
              <LiveStreamContainer camera={camera} />

              {/* Camera Details */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  {/* <div>
                    <h3 className="font-semibold text-lg">{camera.name}</h3>
                    {camera.description && (
                      <p className="text-sm text-gray-600">{camera.description}</p>
                    )}
                  </div> */}
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(camera)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(camera.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  {camera.location && (
                    <div className="flex items-center">
                      <span className="font-medium">Local:</span>
                      <span className="ml-1">{camera.location}</span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="font-medium">IP:</span>
                    <span className="ml-1">{camera.ip}:{camera.port}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">Protocolo:</span>
                    <span className="ml-1">{camera.protocol.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredCameras.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhuma câmera encontrada</p>
        </div>
      )}

      {/* Camera Form Modal */}
      {isModalOpen && (
        <CameraFormModal
          camera={editingCamera}
          onSubmit={handleSubmit}
          onClose={() => {
            setIsModalOpen(false);
            setEditingCamera(null);
          }}
          isLoading={createCameraMutation.isPending || updateCameraMutation.isPending}
        />
      )}
    </div>
  );
};

interface CameraFormModalProps {
  camera?: Camera | null;
  onSubmit: (data: CameraFormData) => void;
  onClose: () => void;
  isLoading: boolean;
}

const CameraFormModal: React.FC<CameraFormModalProps> = ({
  camera,
  onSubmit,
  onClose,
  isLoading,
}) => {
  const [formData, setFormData] = useState<CameraFormData>({
    name: camera?.name || '',
    description: camera?.description || '',
    ip: camera?.ip || '',
    port: camera?.port || 554,
    username: camera?.username || '',
    password: camera?.password || '',
    streamUrl: camera?.streamUrl || '',
    protocol: camera?.protocol || 'rtsp',
    location: camera?.location || '',
    status: camera?.status || 'inactive',
    settings: camera?.settings || '',
    organizationId: camera?.organizationId || 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof CameraFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            {camera ? 'Editar Câmera' : 'Adicionar Câmera'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <Input
                type="text"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP *
                </label>
                <Input
                  type="text"
                  value={formData.ip}
                  onChange={(e) => handleChange('ip', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Porta
                </label>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => handleChange('port', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL do Stream
              </label>
              <Input
                type="text"
                value={formData.streamUrl}
                onChange={(e) => handleChange('streamUrl', e.target.value)}
                placeholder="rtsp://username:password@ip:port/stream"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Local
              </label>
              <Input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Usuário
                </label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Senha
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : (camera ? 'Atualizar' : 'Criar')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CamerasPage;