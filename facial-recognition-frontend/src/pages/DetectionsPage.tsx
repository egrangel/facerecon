import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Pagination from '../components/ui/Pagination';
import Checkbox from '../components/ui/Checkbox';
import Select from '../components/ui/Select';
import { apiClient } from '../services/api';
import { Detection, QueryParams, Person } from '../types/api';

const DeteccoesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [unrecognizedFilter, setUnrecognizedFilter] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [showPersonSelector, setShowPersonSelector] = useState(false);
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [autoReload, setAutoReload] = useState(false);
  const queryClient = useQueryClient();

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
    queryParams.detectionStatus = statusFilter;
  }
  if (dateFilter) {
    queryParams.date = dateFilter;
  }
  if (unrecognizedFilter) {
    queryParams.faceStatus = 'unrecognized';
  }

  const { data: detectionsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['detections', queryParams],
    queryFn: async () => {
      return await apiClient.getDetections(queryParams);
    },
    refetchInterval: autoReload ? 5000 : false, // Refetch every 5 seconds when auto-reload is enabled
    refetchIntervalInBackground: false, // Only refetch when the tab is active
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
    setUnrecognizedFilter(false);
    setCurrentPage(1);
  };

  // Unmatch person from detection mutation
  const unmatchMutation = useMutation({
    mutationFn: async (detectionId: number) => {
      return await apiClient.unmatchPersonFromDetection(detectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detections'] });
      setSelectedDetection(null);
    },
    onError: (error) => {
      console.error('Error unmatching person from detection:', error);
    },
  });

  // Confirm detection mutation
  const confirmMutation = useMutation({
    mutationFn: async (detectionId: number) => {
      return await apiClient.confirmDetection(detectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detections'] });
      setSelectedDetection(null);
    },
    onError: (error) => {
      console.error('Error confirming detection:', error);
    },
  });

  // Disassociate person mutation (sets faceStatus to unrecognized, detectionStatus to pending, and removes person association)
  const disassociateMutation = useMutation({
    mutationFn: async (detectionId: number) => {
      return await apiClient.unmatchPersonFromDetection(detectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detections'] });
      setSelectedDetection(null);
    },
    onError: (error) => {
      console.error('Error disassociating person from detection:', error);
    },
  });

  const getStatusColor = (faceStatus: string, detectionStatus: string) => {
    if (detectionStatus === 'confirmed') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
    if (detectionStatus === 'pending') {
      return 'bg-[var(--color-background-tertiary)] text-[var(--color-primary-500)]';
    }
    if (faceStatus === 'unrecognized') {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
    if (faceStatus === 'detected') {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
    if (faceStatus === 'recognized') {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  const getStatusLabel = (faceStatus: string, detectionStatus: string) => {
    if (detectionStatus === 'confirmed') {
      return 'Confirmado';
    }
    if (detectionStatus === 'pending') {
      return 'Pendente';
    }
    if (faceStatus === 'unrecognized') {
      return 'Não Reconhecido';
    }
    if (faceStatus === 'detected') {
      return 'Detectado';
    }
    if (faceStatus === 'recognized') {
      return 'Reconhecido';
    }
    return 'Indefinido';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 dark:text-green-400';
    if (confidence >= 75) return 'text-[var(--color-primary-500)]';
    return 'text-red-600 dark:text-red-400';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)]">
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Detecções</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Visualize todas as detecções do sistema
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <Input
              placeholder="Buscar por pessoa ou câmera..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />

            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Todos os status"
              options={[
                { value: '', label: 'Todos os status' },
                { value: 'pending', label: 'Pendente de Confirmação' },
                { value: 'confirmed', label: 'Confirmado' },
              ]}
            />

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filtrar por data"
            />

            <Checkbox
              label="Faces não reconhecidas"
              checked={unrecognizedFilter}
              onChange={(e) => {
                setUnrecognizedFilter(e.target.checked);
                setCurrentPage(1);
              }}
            />

            <Button
              variant="outline"
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
          </div>

          {/* Auto-reload section */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center space-x-2">
              <Checkbox
                label="🔄 Atualização automática (5s)"
                checked={autoReload}
                onChange={(e) => setAutoReload(e.target.checked)}
              />
              {autoReload && (
                <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-background-tertiary)] px-2 py-1 rounded">
                  Ativo
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {!isLoading && (
        <div className="flex justify-between items-center text-sm text-[var(--color-text-secondary)] mb-4">
          <div className="flex items-center space-x-4">
            <span>
              Mostrando {detections.length} de {pagination.total} detecções
            </span>
            {autoReload && (
              <span className="flex items-center space-x-1">
                {isFetching ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-green-600">Atualizando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-green-600">Auto-reload ativo</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>Itens por página:</span>
            <Select
              value={pageSize.toString()}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
              options={[
                { value: '6', label: '6' },
                { value: '12', label: '12' },
                { value: '24', label: '24' },
                { value: '48', label: '48' },
              ]}
              size="sm"
              className="w-20"
            />
          </div>
        </div>
      )}

      {/* Detections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)]"></div>
          </div>
        ) : detections.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[var(--color-text-secondary)]">
            Nenhuma detecção encontrada.
          </div>
        ) : (
          detections.map((detection: Detection) => (
            <Card key={detection.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedDetection(detection)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mt-3">
                  <div className="flex items-center space-x-3">
                    <div className="h-12 w-12 bg-[var(--color-background-tertiary)] rounded-full flex items-center justify-center overflow-hidden">
                      {detection.imageUrl ? (
                        <img
                          src={`${process.env.REACT_APP_API_URL?.replace('/api/v1', '')}${detection.imageUrl}`}
                          alt={detection.personFace?.person?.name || 'Face detectada'}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const container = target.parentElement;
                            if (container) {
                              container.innerHTML = `
                                <span class="text-sm font-medium text-[var(--color-primary-500)]">
                                  ${detection.personFace?.person?.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                              `;
                            }
                          }}
                        />
                      ) : (
                        <span className="text-sm font-medium text-[var(--color-primary-500)]">
                          {detection.personFace?.person?.name?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-[var(--color-text-primary)]">{detection.personFace?.person?.name || 'Não Identificado'}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">{detection.camera?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(detection.faceStatus, detection.detectionStatus)}`}>
                    {getStatusLabel(detection.faceStatus, detection.detectionStatus)}
                  </span>
                </div>

                <div className="space-y-2">

                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Confiança:</span>
                    <span className={`font-medium ${getConfidenceColor(detection.confidence)}`}>
                      {(detection.confidence * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-secondary)]">Data/Hora:</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{formatTimestamp(detection.detectedAt)}</span>
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
        <DetectionModal
          detection={selectedDetection}
          onClose={() => setSelectedDetection(null)}
          onAssociateExisting={() => setShowPersonSelector(true)}
          onCreateNew={() => setShowNewPersonForm(true)}
          onUnmatch={() => unmatchMutation.mutate(selectedDetection.id)}
          onConfirm={() => confirmMutation.mutate(selectedDetection.id)}
          onDisassociate={() => disassociateMutation.mutate(selectedDetection.id)}
        />
      )}

      {/* Person Selector Modal */}
      {showPersonSelector && selectedDetection && (
        <PersonSelectorModal
          detection={selectedDetection}
          onClose={() => setShowPersonSelector(false)}
          onSuccess={() => {
            setShowPersonSelector(false);
            setSelectedDetection(null);
            queryClient.invalidateQueries({ queryKey: ['detections'] });
          }}
        />
      )}

      {/* New Person Form Modal */}
      {showNewPersonForm && selectedDetection && (
        <NewPersonModal
          detection={selectedDetection}
          onClose={() => setShowNewPersonForm(false)}
          onSuccess={() => {
            setShowNewPersonForm(false);
            setSelectedDetection(null);
            queryClient.invalidateQueries({ queryKey: ['detections'] });
          }}
        />
      )}
    </div>
  );
};

interface DetectionModalProps {
  detection: Detection;
  onClose: () => void;
  onAssociateExisting: () => void;
  onCreateNew: () => void;
  onUnmatch: () => void;
  onConfirm: () => void;
  onDisassociate: () => void;
}

const DetectionModal: React.FC<DetectionModalProps> = ({ detection, onClose, onAssociateExisting, onCreateNew, onUnmatch, onConfirm, onDisassociate }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-[var(--color-status-success-text)]';
    if (confidence >= 75) return 'text-[var(--color-primary-500)]';
    return 'text-[var(--color-status-error-text)]';
  };

  const getStatusColor = (faceStatus: string, detectionStatus: string) => {
    if (detectionStatus === 'confirmed') {
      return 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]';
    }
    if (detectionStatus === 'pending') {
      return 'bg-[var(--color-background-tertiary)] text-[var(--color-primary-500)]';
    }
    if (faceStatus === 'unrecognized') {
      return 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]';
    }
    if (faceStatus === 'detected') {
      return 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]';
    }
    if (faceStatus === 'recognized') {
      return 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]';
    }
    return 'bg-[var(--color-background-tertiary)] text-[var(--color-text-secondary)]';
  };

  const getStatusLabel = (faceStatus: string, detectionStatus: string) => {
    if (detectionStatus === 'confirmed') {
      return 'Confirmado';
    }
    if (detectionStatus === 'pending') {
      return 'Pendente';
    }
    if (faceStatus === 'unrecognized') {
      return 'Não Reconhecido';
    }
    if (faceStatus === 'detected') {
      return 'Detectado';
    }
    if (faceStatus === 'recognized') {
      return 'Reconhecido';
    }
    return 'Indefinido';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-background-primary)] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            Detalhes da Detecção
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header com status */}
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-semibold text-[var(--color-text-primary)]">
              {detection.personFace?.person?.name || 'Face Detectada'}
            </h4>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(detection.faceStatus, detection.detectionStatus)}`}>
              {getStatusLabel(detection.faceStatus, detection.detectionStatus)}
            </span>
          </div>

          {/* Face Image Section */}
          <div className="mb-6">
            <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Imagem da Face Detectada</h5>
            <div className="flex justify-center">
              <div className="relative">
                {detection.imageUrl ? (
                  <img
                    src={`${process.env.REACT_APP_API_URL?.replace('/api/v1', '')}${detection.imageUrl}`}
                    alt="Face detectada"
                    className="max-w-xs max-h-48 object-contain rounded-lg shadow-md border-2 border-[var(--color-border)]"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const container = target.parentElement;
                      if (container) {
                        container.innerHTML = `
                          <div class="w-48 h-48 bg-[var(--color-background-tertiary)] rounded-lg flex items-center justify-center">
                            <span class="text-[var(--color-text-secondary)] text-sm">Imagem não disponível</span>
                          </div>
                        `;
                      }
                    }}
                  />
                ) : (
                  <div className="w-48 h-48 bg-[var(--color-background-tertiary)] rounded-lg flex items-center justify-center">
                    <span className="text-[var(--color-text-secondary)] text-sm">Nenhuma imagem disponível</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Informações principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  {detection.personFace?.person ? 'Pessoa Associada' : 'Status de Identificação'}
                </h5>
                <div className="bg-[var(--color-background-tertiary)] rounded-lg p-4 space-y-2">
                  {detection.personFace?.person ? (
                    <div className="flex items-center space-x-3">
                      <div className="h-16 w-16 bg-[var(--color-background-secondary)] rounded-full flex items-center justify-center">
                        <span className="text-lg font-medium text-[var(--color-primary-500)]">
                          {detection.personFace.person.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{detection.personFace.person.name}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">ID: {detection.personFace.person.id}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="h-16 w-16 bg-[var(--color-status-warning-bg)] rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--color-status-warning-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">Pessoa Não Identificada</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">Dados biométricos armazenados para futura associação</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Detecção</h5>
                <div className="bg-[var(--color-background-tertiary)] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Confiança:</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(detection.confidence)}`}>
                      {detection.confidence.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">Data/Hora:</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {new Date(detection.detectedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">ID Detecção:</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">#{detection.id}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Informações da Câmera</h5>
                <div className="bg-[var(--color-background-tertiary)] rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-[var(--color-background-secondary)] rounded-lg">
                      <svg className="w-5 h-5 text-[var(--color-primary-500)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{detection.camera?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[var(--color-text-secondary)]">ID Câmera:</span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{detection.camera?.id || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Person Association Actions - Show when faceStatus = detected (no person associated) */}
          {detection.faceStatus === 'detected' && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h5 className="text-sm font-medium text-yellow-800 mb-3">
                🔍 Face detectada - Pessoa não identificada
              </h5>
              <p className="text-sm text-yellow-700 mb-4">
                Uma face foi detectada mas não foi associada a uma pessoa conhecida. Os dados biométricos foram salvos para futura identificação. Você pode:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAssociateExisting}
                >
                  Associar a pessoa existente
                </Button>
                <Button
                  size="sm"
                  onClick={onCreateNew}
                >
                  Criar nova pessoa
                </Button>
              </div>
            </div>
          )}

          {/* Unrecognized Face Info - Show when faceStatus = unrecognized */}
          {detection.faceStatus === 'unrecognized' && (
            <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <h5 className="text-sm font-medium text-orange-800 mb-3">
                🔍 Face não reconhecida
              </h5>
              <p className="text-sm text-orange-700 mb-4">
                Uma face foi detectada mas não foi reconhecida (0% de similaridade com pessoas cadastradas). Os dados biométricos foram salvos para futura identificação. Você pode:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAssociateExisting}
                >
                  Associar a pessoa existente
                </Button>
                <Button
                  size="sm"
                  onClick={onCreateNew}
                >
                  Criar nova pessoa
                </Button>
              </div>
            </div>
          )}

          {/* Recognition Status Info */}
          {detection.faceStatus === 'recognized' && detection.personFace?.person && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-medium text-blue-800 mb-3">
                ✅ Face reconhecida automaticamente
              </h5>
              <p className="text-sm text-blue-700 mb-2">
                Esta face foi automaticamente reconhecida e associada a <strong>{detection.personFace.person.name}</strong>.
              </p>
              {detection.detectionStatus === 'pending' && (
                <p className="text-sm text-blue-700">
                  Como a confiança é menor que 100%, a detecção precisa ser confirmada manualmente.
                </p>
              )}
              {detection.detectionStatus === 'confirmed' && (
                <p className="text-sm text-blue-700">
                  A detecção foi confirmada e está válida.
                </p>
              )}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>

            {/* Show Confirm button when detectionStatus = pending */}
            {detection.detectionStatus === 'pending' && (
              <Button
                className="bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-[var(--color-text-inverse)]"
                onClick={onConfirm}
              >
                Confirmar
              </Button>
            )}

            {/* Show Disassociate Person button when detectionStatus = pending OR confirmed (and person is associated) */}
            {(detection.detectionStatus === 'pending' || detection.detectionStatus === 'confirmed') && detection.personFace && (
              <Button
                variant="outline"
                className="text-[var(--color-status-warning-text)] hover:text-[var(--color-status-warning-text)] border-[var(--color-status-warning-border)] hover:border-[var(--color-status-warning-border)] hover:bg-[var(--color-status-warning-bg)]"
                onClick={onDisassociate}
              >
                Desassociar Pessoa
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Person Selector Modal Component
interface PersonSelectorModalProps {
  detection: Detection;
  onClose: () => void;
  onSuccess: () => void;
}

const PersonSelectorModal: React.FC<PersonSelectorModalProps> = ({ detection, onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [selectedPersonFaceInfo, setSelectedPersonFaceInfo] = useState<any>(null);
  const [personLatestDetections, setPersonLatestDetections] = useState<Map<number, Detection>>(new Map());

  // Debounce search term
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: peopleResponse, isLoading: isLoadingPeople } = useQuery({
    queryKey: ['people', { search: debouncedSearchTerm, status: 'active', limit: 50 }],
    queryFn: async () => {
      return await apiClient.getPeople({ search: debouncedSearchTerm, limit: 50, status: 'active' });
    },
  });

  // Check face records when a person is selected
  const { data: faceRecordsResponse, isLoading: isLoadingFaceRecords } = useQuery({
    queryKey: ['personFaceRecords', selectedPersonId],
    queryFn: async () => {
      if (!selectedPersonId) return null;
      return await apiClient.checkPersonFaceRecords(selectedPersonId);
    },
    enabled: !!selectedPersonId,
  });

  // Update face info when data is loaded
  React.useEffect(() => {
    if (faceRecordsResponse?.data) {
      setSelectedPersonFaceInfo(faceRecordsResponse.data);
    } else {
      setSelectedPersonFaceInfo(null);
    }
  }, [faceRecordsResponse]);

  const associateMutation = useMutation({
    mutationFn: async (personId: number) => {
      return await apiClient.associateDetectionToExistingPerson(detection.id, personId);
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      console.error('Error associating detection to person:', error);
    },
  });

  const people = peopleResponse?.data || [];

  // Fetch latest detection for each person when people data changes
  React.useEffect(() => {
    if (people.length > 0) {
      const fetchLatestDetections = async () => {
        const newLatestDetections = new Map<number, Detection>();

        // Fetch latest detection for each person
        await Promise.all(
          people.map(async (person) => {
            try {
              const response = await apiClient.getLatestDetectionForPerson(person.id);
              if (response.data) {
                newLatestDetections.set(person.id, response.data);
              }
            } catch (error) {
              console.log(`No latest detection found for person ${person.id}`);
            }
          })
        );

        setPersonLatestDetections(newLatestDetections);
      };

      fetchLatestDetections();
    }
  }, [people]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-background-primary)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            Associar a Pessoa Existente
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Buscar pessoa
            </label>
            <Input
              id="search"
              placeholder="Digite o nome da pessoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="max-h-60 overflow-y-auto">
            {isLoadingPeople ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--color-primary-500)]"></div>
              </div>
            ) : people.length === 0 ? (
              <div className="text-center py-4 text-[var(--color-text-secondary)]">
                Nenhuma pessoa encontrada.
              </div>
            ) : (
              <div className="space-y-2">
                {people.map((person: Person) => (
                  <div
                    key={person.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedPersonId === person.id
                        ? 'border-[var(--color-primary-500)] bg-[var(--color-background-tertiary)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-medium)]'
                    }`}
                    onClick={() => setSelectedPersonId(person.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-[var(--color-background-tertiary)] rounded-full flex items-center justify-center overflow-hidden">
                        {(() => {
                          const latestDetection = personLatestDetections.get(person.id);
                          return latestDetection?.imageUrl ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL?.replace('/api/v1', '')}${latestDetection.imageUrl}`}
                              alt={person.name || 'Face detectada'}
                              className="w-full h-full object-cover rounded-full"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const container = target.parentElement;
                                if (container) {
                                  container.innerHTML = `
                                    <span class="text-sm font-medium text-[var(--color-primary-500)]">
                                      ${person.name?.charAt(0).toUpperCase() || '?'}
                                    </span>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <span className="text-sm font-medium text-[var(--color-primary-500)]">
                              {person.name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          );
                        })()}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)]">{person.name}</p>
                        <p className="text-sm text-[var(--color-text-secondary)]">ID: {person.id}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Face Records Information */}
          {selectedPersonId && (
            <div className="mt-4 p-4 bg-[var(--color-status-info-bg)] border border-[var(--color-status-info-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--color-status-info-text)] mb-2">
                📋 Informações de Face
              </h4>
              {isLoadingFaceRecords ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--color-primary-500)]"></div>
                  <span className="text-sm text-[var(--color-status-info-text)]">Verificando registros...</span>
                </div>
              ) : selectedPersonFaceInfo ? (
                <div className="space-y-2 text-sm text-[var(--color-status-info-text)]">
                  {selectedPersonFaceInfo.hasRecords ? (
                    <>
                      <div className="flex justify-between">
                        <span>Registros de face:</span>
                        <span className="font-medium">{selectedPersonFaceInfo.count} total</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Registros ativos:</span>
                        <span className="font-medium">{selectedPersonFaceInfo.activeRecords}</span>
                      </div>
                      {selectedPersonFaceInfo.count > 0 && (
                        <div className="mt-3 p-2 bg-[var(--color-status-warning-bg)] border border-[var(--color-status-warning-border)] rounded text-[var(--color-status-warning-text)]">
                          ⚠️ Esta pessoa já possui registros de face. A detecção será associada ao registro existente.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-[var(--color-status-success-text)]">✅</span>
                      <span>Esta pessoa não possui registros de face. Um novo registro será criado.</span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => selectedPersonId && associateMutation.mutate(selectedPersonId)}
              disabled={!selectedPersonId || associateMutation.isPending}
            >
              {associateMutation.isPending ? 'Associando...' : 'Associar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// New Person Modal Component
interface NewPersonModalProps {
  detection: Detection;
  onClose: () => void;
  onSuccess: () => void;
}

const NewPersonModal: React.FC<NewPersonModalProps> = ({ detection, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    personType: 'individual' as 'individual' | 'company',
    documentNumber: '',
    notes: '',
  });

  const createPersonMutation = useMutation({
    mutationFn: async (personData: any) => {
      return await apiClient.createPersonFromDetection(detection.id, personData);
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (error) => {
      console.error('Error creating person from detection:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createPersonMutation.mutate(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-background-primary)] rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            Criar Nova Pessoa
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Nome *
            </label>
            <Input
              id="name"
              required
              placeholder="Digite o nome da pessoa..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="personType" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Tipo de Pessoa
            </label>
            <Select
              id="personType"
              value={formData.personType}
              onChange={(e) => setFormData({ ...formData, personType: e.target.value as 'individual' | 'company' })}
              options={[
                { value: 'individual', label: 'Pessoa Física' },
                { value: 'company', label: 'Pessoa Jurídica' },
              ]}
            />
          </div>

          <div>
            <label htmlFor="documentNumber" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {formData.personType === 'individual' ? 'CPF' : 'CNPJ'}
            </label>
            <Input
              id="documentNumber"
              placeholder={formData.personType === 'individual' ? 'Digite o CPF...' : 'Digite o CNPJ...'}
              value={formData.documentNumber}
              onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Observações
            </label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Observações adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-[var(--color-border)]">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!formData.name.trim() || createPersonMutation.isPending}
            >
              {createPersonMutation.isPending ? 'Criando...' : 'Criar Pessoa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeteccoesPage;