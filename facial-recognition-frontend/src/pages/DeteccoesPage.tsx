import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Detection } from '../types/api';

const DeteccoesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);

  const { data: detectionsResponse, isLoading } = useQuery({
    queryKey: ['detections'],
    queryFn: async () => {
      return await apiClient.getDetections();
    },
  });

  const detections = detectionsResponse?.data || [];

  const filteredDetections = detections.filter((detection: Detection) => {
    const matchesSearch = detection.personFace?.person?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         detection.camera?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !statusFilter || detection.status === statusFilter;

    const matchesDate = !dateFilter || new Date(detection.detectedAt).toDateString() === new Date(dateFilter).toDateString();

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada':
        return 'bg-green-100 text-green-800';
      case 'rejeitada':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Detecções</h1>
          <p className="mt-2 text-sm text-gray-700">
            Visualize todas as detecções do sistema
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Buscar por pessoa ou câmera..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmada">Confirmada</option>
              <option value="rejeitada">Rejeitada</option>
            </select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filtrar por data"
            />

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setDateFilter('');
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Detections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredDetections.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No detections found.
          </div>
        ) : (
          filteredDetections.map((detection: Detection) => (
            <Card key={detection.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedDetection(detection)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-600">
                        {detection.personFace?.person?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{detection.personFace?.person?.name || 'Desconhecido'}</h3>
                      <p className="text-sm text-gray-500">{detection.camera?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(detection.status)}`}>
                    {detection.status}
                  </span>
                </div>

                <div className="space-y-2">

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Confian�a:</span>
                    <span className={`font-medium ${getConfidenceColor(detection.confidence)}`}>
                      {detection.confidence.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Data/Hora:</span>
                    <span className="font-medium text-gray-900">{formatTimestamp(detection.detectedAt)}</span>
                  </div>
                </div>

                <div className="mt-4 flex space-x-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    Ver detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal de detalhes */}
      {selectedDetection && (
        <DeteccaoModal
          deteccao={selectedDetection}
          onClose={() => setSelectedDetection(null)}
        />
      )}
    </div>
  );
};

interface DeteccaoModalProps {
  deteccao: Detection;
  onClose: () => void;
}

const DeteccaoModal: React.FC<DeteccaoModalProps> = ({ deteccao, onClose }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmada':
        return 'bg-green-100 text-green-800';
      case 'rejeitada':
        return 'bg-red-100 text-red-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Detalhes da Detecção
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header com status */}
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-semibold text-gray-900">
              {deteccao.personFace?.person?.name || 'Desconhecido'}
            </h4>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(deteccao.status)}`}>
              {deteccao.status}
            </span>
          </div>

          {/* Informações principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Informações da Pessoa</h5>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-medium text-primary-600">
                        {deteccao.personFace?.person?.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{deteccao.personFace?.person?.name || 'Desconhecido'}</p>
                      <p className="text-sm text-gray-500">ID: {deteccao.personFace?.person?.id || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Detecção</h5>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Confian�a:</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(deteccao.confidence)}`}>
                      {deteccao.confidence.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Data/Hora:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(deteccao.detectedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">ID Detec��o:</span>
                    <span className="text-sm font-medium text-gray-900">#{deteccao.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Informa��es da C�mera</h5>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{deteccao.camera?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">ID Câmera:</span>
                    <span className="text-sm font-medium text-gray-900">{deteccao.camera?.id || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {deteccao.metadata && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Metadados</h5>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(deteccao.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {deteccao.status === 'pendente' && (
              <>
                <Button variant="outline" className="text-red-600 hover:text-red-700">
                  Rejeitar
                </Button>
                <Button>
                  Confirmar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeteccoesPage;