import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';

interface Camera {
  id: number;
  nome: string;
  localizacao: string;
  url: string;
  status: 'ativa' | 'inativa' | 'manutencao';
  tipo: 'ip' | 'usb' | 'rtsp';
  resolucao?: string;
  fps?: number;
  createdAt: string;
  updatedAt: string;
}

interface CameraFormData {
  nome: string;
  localizacao: string;
  url: string;
  status: 'ativa' | 'inativa' | 'manutencao';
  tipo: 'ip' | 'usb' | 'rtsp';
  resolucao?: string;
  fps?: number;
}

const CamerasPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ['cameras'],
    queryFn: async () => {
      const response = await apiClient.get('/cameras');
      return response.data;
    },
  });

  const createCameraMutation = useMutation({
    mutationFn: async (data: CameraFormData) => {
      const response = await apiClient.post('/cameras', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const updateCameraMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CameraFormData }) => {
      const response = await apiClient.put(`/cameras/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setIsModalOpen(false);
      setEditingCamera(null);
    },
  });

  const deleteCameraMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/cameras/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
  });

  const filteredCameras = cameras.filter((camera: Camera) =>
    camera.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    camera.localizacao.toLowerCase().includes(searchTerm.toLowerCase())
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativa':
        return 'bg-green-100 text-green-800';
      case 'inativa':
        return 'bg-red-100 text-red-800';
      case 'manutencao':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary-100 rounded-lg">
                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{camera.nome}</h3>
                        <p className="text-sm text-gray-500">{camera.localizacao}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tipo:</span>
                        <span className="font-medium text-gray-900">{camera.tipo.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(camera.status)}`}>
                          {camera.status}
                        </span>
                      </div>
                      {camera.resolucao && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Resolução:</span>
                          <span className="font-medium text-gray-900">{camera.resolucao}</span>
                        </div>
                      )}
                      {camera.fps && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">FPS:</span>
                          <span className="font-medium text-gray-900">{camera.fps}</span>
                        </div>
                      )}
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
    nome: camera?.nome || '',
    localizacao: camera?.localizacao || '',
    url: camera?.url || '',
    status: camera?.status || 'ativa',
    tipo: camera?.tipo || 'ip',
    resolucao: camera?.resolucao || '',
    fps: camera?.fps || undefined,
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
            {camera ? 'Editar Câmera' : 'Nova Câmera'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nome"
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            required
          />

          <Input
            label="Localização"
            value={formData.localizacao}
            onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
            required
          />

          <Input
            label="URL/Endereço"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="Ex: rtsp://192.168.1.100:554/stream"
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value as 'ip' | 'usb' | 'rtsp' })}
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
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativa' | 'inativa' | 'manutencao' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="manutencao">Manutenção</option>
            </select>
          </div>

          <Input
            label="Resolução"
            value={formData.resolucao}
            onChange={(e) => setFormData({ ...formData, resolucao: e.target.value })}
            placeholder="Ex: 1920x1080"
          />

          <Input
            label="FPS"
            type="number"
            value={formData.fps?.toString() || ''}
            onChange={(e) => setFormData({ ...formData, fps: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Ex: 30"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {camera ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CamerasPage;