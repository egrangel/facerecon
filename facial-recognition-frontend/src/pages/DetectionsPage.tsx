import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import { apiClient } from '../services/api';
import { Detection, QueryParams } from '../types/api';

const DeteccoesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Build query parameters
  const queryParams: QueryParams = {
    page: currentPage,
    limit: pageSize,
    sortBy: 'detectedAt',
    sortOrder: 'desc',
  };

  // Add filters to query params if they exist
  if (searchTerm) {
    queryParams.search = searchTerm;
  }
  if (statusFilter) {
    queryParams.status = statusFilter;
  }
  if (dateFilter) {
    queryParams.date = dateFilter;
  }

  const { data: detectionsResponse, isLoading } = useQuery({
    queryKey: ['detections', queryParams],
    queryFn: async () => {
      return await apiClient.getDetections(queryParams);
    },
  });

  const detections = detectionsResponse?.data || [];
  const pagination = {
    total: detectionsResponse?.total || 0,
    page: detectionsResponse?.page || 1,
    limit: detectionsResponse?.limit || pageSize,
    totalPages: detectionsResponse?.totalPages || 0,
  };

  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDateFilter('');
    setCurrentPage(1);
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filtrar por data"
            />

            <Button
              variant="outline"
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!isLoading && (
        <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
          <div>
            Mostrando {detections.length} de {pagination.total} detecções
          </div>
          <div className="flex items-center space-x-2">
            <span>Itens por página:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </div>
        </div>
      )}

      {/* Detections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : detections.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nenhuma detecção encontrada.
          </div>
        ) : (
          detections.map((detection: Detection) => (
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
                    <span className="text-gray-500">Confiança:</span>
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

      {/* Pagination */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="mt-8">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
            className="justify-center"
          />
        </div>
      )}

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

          {/* Face Image Section */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-700 mb-3">Imagem da Face Detectada</h5>
            <div className="flex justify-center">
              <div className="relative">
                {deteccao.imageUrl ? (
                  <img
                    src={`${process.env.REACT_APP_API_URL?.replace('/api/v1', '')}${deteccao.imageUrl}`}
                    alt="Face detectada"
                    className="max-w-xs max-h-48 object-contain rounded-lg shadow-md border-2 border-gray-200"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = `
                          <div class="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span class="text-gray-500 text-sm">Imagem não disponível</span>
                          </div>
                        `;
                      }
                    }}
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Nenhuma imagem disponível</span>
                  </div>
                )}
                {deteccao.imageUrl && (
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    {deteccao.confidence.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
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
                    <span className="text-sm text-gray-600">Confiança:</span>
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
                    <span className="text-sm text-gray-600">ID Detecção:</span>
                    <span className="text-sm font-medium text-gray-900">#{deteccao.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Informações da Câmera</h5>
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
                  <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-auto">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                      {typeof deteccao.metadata === 'string'
                        ? deteccao.metadata
                        : JSON.stringify(deteccao.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Person Association Actions */}
          {deteccao.personFace?.person?.name?.includes('Unknown Person') && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h5 className="text-sm font-medium text-yellow-800 mb-3">
                🔍 Pessoa não identificada
              </h5>
              <p className="text-sm text-yellow-700 mb-4">
                Esta face não foi associada a uma pessoa conhecida. Você pode:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // TODO: Open person selector modal
                    console.log('Associate with existing person');
                  }}
                >
                  Associar a pessoa existente
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // TODO: Open create person modal
                    console.log('Create new person');
                  }}
                >
                  Criar nova pessoa
                </Button>
              </div>
            </div>
          )}

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