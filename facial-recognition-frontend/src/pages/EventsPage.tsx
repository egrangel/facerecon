import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Event, Camera } from '../types/api';

interface EventFormData {
  name: string;
  description?: string;
  isScheduled: boolean;
  isActive: boolean;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  weekDays?: string[];
  recurrenceType: string;
  selectedCameraIds?: number[];
}

const EventosPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const queryClient = useQueryClient();

  const { data: eventsResponse, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      return await apiClient.getEvents();
    },
  });

  // Mutations for CRUD operations
  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      // Convert weekDays array to string format for backend
      const eventData = {
        ...data,
        weekDays: data.weekDays ? JSON.stringify(data.weekDays) : undefined,
        selectedCameraIds: undefined // Remove from event data
      };

      // Create the event first
      const event = await apiClient.createEvent(eventData as any);

      // If cameras were selected, associate them with the event
      if (data.selectedCameraIds && data.selectedCameraIds.length > 0) {
        await Promise.all(
          data.selectedCameraIds.map(cameraId =>
            apiClient.addCameraToEvent(event.id, cameraId)
          )
        );
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEventModal(false);
      alert('Evento criado com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao criar evento');
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EventFormData }) => {
      // Convert weekDays array to string format for backend
      const eventData = {
        ...data,
        weekDays: data.weekDays ? JSON.stringify(data.weekDays) : undefined,
        selectedCameraIds: undefined // Remove from event data
      };

      // Update the event first
      const event = await apiClient.updateEvent(id, eventData as any);

      // Handle camera associations
      if (data.selectedCameraIds !== undefined) {
        // Get current cameras for this event
        const currentCamerasResponse = await apiClient.getEventCameras(id);
        const currentCameraIds = currentCamerasResponse.data?.map(ec => ec.cameraId) || [];

        // Remove cameras that are no longer selected
        const camerasToRemove = currentCameraIds.filter(cameraId =>
          !data.selectedCameraIds!.includes(cameraId)
        );

        // Add new cameras that were selected
        const camerasToAdd = data.selectedCameraIds.filter(cameraId =>
          !currentCameraIds.includes(cameraId)
        );

        await Promise.all([
          ...camerasToRemove.map(cameraId =>
            apiClient.removeCameraFromEvent(id, cameraId)
          ),
          ...camerasToAdd.map(cameraId =>
            apiClient.addCameraToEvent(id, cameraId)
          )
        ]);
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowEventModal(false);
      setEditingEvent(null);
      alert('Evento atualizado com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao atualizar evento');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      alert('Evento excluído com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao excluir evento');
    },
  });

  const toggleEventStatusMutation = useMutation({
    mutationFn: (eventId: number) => apiClient.toggleEventStatus(eventId),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      alert(response.message || 'Status do evento alterado com sucesso!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Erro ao alterar status do evento');
    },
  });

  const events = eventsResponse?.data || [];

  // Helper functions
  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventModal(true);
  };

  const handleDeleteEvent = (event: Event) => {
    if (window.confirm(`Tem certeza que deseja excluir o evento "${event.name}"?`)) {
      deleteEventMutation.mutate(event.id);
    }
  };

  const closeEventModal = () => {
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const filteredEvents = events.filter((event: Event) => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = !typeFilter || event.type === typeFilter;
    const matchesStatus = !statusFilter || event.status === statusFilter;

    const matchesDate = !dateFilter || (event.occurredAt && new Date(event.occurredAt).toDateString() === new Date(dateFilter).toDateString());

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deteccao':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        );
      case 'acesso_negado':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636" />
          </svg>
        );
      case 'sistema':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'erro':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'alerta':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'novo':
        return 'bg-blue-100 text-blue-800';
      case 'visto':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolvido':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Eventos</h1>
          <p className="mt-2 text-sm text-gray-700">
            Histórico de eventos e notificações do sistema
          </p>
        </div>
        <Button
          onClick={() => setShowEventModal(true)}
          className="bg-primary-600 text-white hover:bg-primary-700"
        >
          Adicionar Evento
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mt-3">
            <Input 
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('');
                setStatusFilter('');
                setDateFilter('');
              }}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Nenhum evento encontrado
              </div>
            ) : (
              filteredEvents.map((event: Event) => (
                <div
                  key={event.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${getStatusColor(event.status)} border`}>
                      <div className="text-current">
                        {getTypeIcon(event.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900 capitalize">
                            {event.type.replace('_', ' ')}
                          </h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(event.status)}`}>
                            {event.status}
                          </span>
                          {event.isScheduled && (
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                              event.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              <div className={`w-2 h-2 rounded-full mr-1 ${
                                event.isActive ? 'bg-green-500' : 'bg-gray-400'
                              }`}></div>
                              {event.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {event.occurredAt ? formatTimestamp(event.occurredAt) : 'Evento agendado'}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">
                        {event.description}
                      </p>
                    </div>

                    <div className="flex-shrink-0 flex space-x-2">
                      {event.isScheduled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEventStatusMutation.mutate(event.id);
                          }}
                          className={`${
                            event.isActive
                              ? 'text-orange-600 border-orange-300 hover:bg-orange-50'
                              : 'text-green-600 border-green-300 hover:bg-green-50'
                          }`}
                          isLoading={toggleEventStatusMutation.isPending}
                        >
                          {event.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEvent(event);
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(event);
                        }}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      {selectedEvent && (
        <EventoModal
          evento={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Modal de formulário */}
      {showEventModal && (
        <EventFormModal
          event={editingEvent}
          onClose={closeEventModal}
          onSubmit={(data) => {
            if (editingEvent) {
              updateEventMutation.mutate({ id: editingEvent.id, data });
            } else {
              createEventMutation.mutate(data);
            }
          }}
          isLoading={createEventMutation.isPending || updateEventMutation.isPending}
        />
      )}
    </div>
  );
};

interface EventFormModalProps {
  event: Event | null;
  onClose: () => void;
  onSubmit: (data: EventFormData) => void;
  isLoading: boolean;
}

const EventFormModal: React.FC<EventFormModalProps> = ({ event, onClose, onSubmit, isLoading }) => {
  const [selectedCameraIds, setSelectedCameraIds] = useState<number[]>([]);

  // Query for cameras
  const { data: camerasResponse } = useQuery({
    queryKey: ['cameras'],
    queryFn: async () => {
      return await apiClient.getCameras();
    },
  });

  // Query for event cameras if editing
  const { data: eventCamerasResponse } = useQuery({
    queryKey: ['eventCameras', event?.id],
    queryFn: async () => {
      if (!event?.id) return null;
      return await apiClient.getEventCameras(event.id);
    },
    enabled: !!event?.id,
  });

  const formatDateForInput = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const formatTimeForInput = (timeString?: string) => {
    if (!timeString) return '';
    // If it's already in HH:MM format, return as is
    if (timeString.match(/^\d{2}:\d{2}$/)) return timeString;
    try {
      return new Date(`2000-01-01 ${timeString}`).toTimeString().slice(0, 5);
    } catch {
      return '';
    }
  };

  const parseWeekDays = (weekDaysString?: string): string[] => {
    if (!weekDaysString) return [];
    try {
      if (weekDaysString.startsWith('[')) {
        return JSON.parse(weekDaysString);
      } else {
        return weekDaysString.split(',').map(day => day.trim().toLowerCase());
      }
    } catch {
      return [];
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EventFormData>({
    defaultValues: event ? {
      name: event.name,
      description: event.description || '',
      isScheduled: event.isScheduled || false,
      isActive: event.isActive !== undefined ? event.isActive : true,
      scheduledDate: event.scheduledDate ? formatDateForInput(event.scheduledDate) : '',
      startTime: formatTimeForInput(event.startTime),
      endTime: formatTimeForInput(event.endTime),
      weekDays: parseWeekDays(event.weekDays),
      recurrenceType: event.recurrenceType || 'once',
    } : {
      name: '',
      description: '',
      isScheduled: true,
      isActive: true,
      scheduledDate: '',
      startTime: '',
      endTime: '',
      weekDays: [],
      recurrenceType: 'once',
    }
  });

  const isScheduled = watch('isScheduled');
  const recurrenceType = watch('recurrenceType');

  // Set initial selected cameras when editing
  React.useEffect(() => {
    if (eventCamerasResponse?.data) {
      const cameraIds = eventCamerasResponse.data.map(ec => ec.cameraId);
      setSelectedCameraIds(cameraIds);
    }
  }, [eventCamerasResponse]);

  const onFormSubmit = (data: EventFormData) => {
    const submitData = {
      ...data,
      selectedCameraIds,
    };
    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {event ? 'Editar Evento' : 'Criar Novo Evento'}
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

        <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Informações Básicas</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Nome do Evento"
                  error={errors.name?.message}
                  {...register('name', {
                    required: 'Nome é obrigatório',
                  })}
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  {...register('description')}
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('isScheduled')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Este é um evento agendado</span>
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    {...register('isActive')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Evento ativo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Scheduling Section */}
          {isScheduled && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Configurações de Agendamento</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="recurrenceType" className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Recorrência
                  </label>
                  <select
                    id="recurrenceType"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    {...register('recurrenceType')}
                  >
                    <option value="once">Uma vez</option>
                    <option value="daily">Diariamente</option>
                    <option value="weekly">Semanalmente</option>
                    <option value="monthly">Mensalmente</option>
                  </select>
                </div>

                {recurrenceType === 'once' && (
                  <div>
                    <Input
                      label="Data Específica"
                      type="date"
                      {...register('scheduledDate')}
                    />
                  </div>
                )}

                <div>
                  <Input
                    label="Hora de Início"
                    type="time"
                    {...register('startTime')}
                  />
                </div>

                <div>
                  <Input
                    label="Hora de Fim"
                    type="time"
                    {...register('endTime')}
                  />
                </div>

                {recurrenceType === 'weekly' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dias da Semana
                    </label>
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { value: 'sunday', label: 'Dom' },
                        { value: 'monday', label: 'Seg' },
                        { value: 'tuesday', label: 'Ter' },
                        { value: 'wednesday', label: 'Qua' },
                        { value: 'thursday', label: 'Qui' },
                        { value: 'friday', label: 'Sex' },
                        { value: 'saturday', label: 'Sáb' }
                      ].map(day => (
                        <label key={day.value} className="flex flex-col items-center space-y-1">
                          <input
                            type="checkbox"
                            value={day.value}
                            {...register('weekDays')}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-600">{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Camera Selection */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900 border-b pb-2">Câmeras Associadas</h4>

            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
              {camerasResponse?.data.length ? (
                <div className="space-y-2">
                  {camerasResponse.data.map((camera: Camera) => (
                    <label key={camera.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCameraIds.includes(camera.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCameraIds([...selectedCameraIds, camera.id]);
                          } else {
                            setSelectedCameraIds(selectedCameraIds.filter(id => id !== camera.id));
                          }
                        }}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">{camera.name}</div>
                        {camera.description && (
                          <div className="text-xs text-gray-500">{camera.description}</div>
                        )}
                      </div>
                      <div className={`px-2 py-1 text-xs rounded-full ${
                        camera.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {camera.status}
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Nenhuma câmera disponível
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">
              {selectedCameraIds.length} câmera(s) selecionada(s)
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
            >
              {event ? 'Atualizar' : 'Criar'} Evento
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface EventoModalProps {
  evento: Event;
  onClose: () => void;
}

const EventoModal: React.FC<EventoModalProps> = ({ evento, onClose }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'novo':
        return 'bg-blue-100 text-blue-800';
      case 'visto':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolvido':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Detalhes do Evento
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-xl font-semibold text-gray-900 capitalize">
              {evento.type.replace('_', ' ')}
            </h4>
            <div className="flex space-x-2">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(evento.status)}`}>
                {evento.status}
              </span>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(evento.status)}`}>
                {evento.status}
              </span>
            </div>
          </div>

          {/* Informa��es principais */}
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Descri��o</h5>
              <p className="text-gray-900">{evento.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Data e Hora</h5>
                <p className="text-gray-900">
                  {evento.occurredAt ? new Date(evento.occurredAt).toLocaleString('pt-BR') : 'Evento agendado'}
                </p>
              </div>

              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">ID do Evento</h5>
                <p className="text-gray-900">#{evento.id}</p>
              </div>
            </div>



            {evento.metadata && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Metadados</h5>
                <div className="bg-gray-50 rounded-lg p-3">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(evento.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {evento.status !== 'resolvido' && (
              <Button>
                Marcar como Resolvido
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventosPage;