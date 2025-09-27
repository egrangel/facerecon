import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Person, Detection } from '../types/api';

interface PersonFormData {
  name: string;
  personType: string;
  documentNumber?: string;
  nationalId?: string;
  birthDate?: string;
  gender?: string;
  status: string;
  notes?: string;
  metadata?: string;
  organizationId: number;
  personId: number;
  email?: string;
  telefone?: string;
}

const PessoasPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [personLatestDetections, setPersonLatestDetections] = useState<Map<number, Detection>>(new Map());
  const queryClient = useQueryClient();

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: peopleResponse, isLoading } = useQuery({
    queryKey: ['people', currentPage, pageSize, debouncedSearchTerm, statusFilter],
    queryFn: async () => {
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      };

      // Add search filter if present
      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      // Add status filter if not 'all'
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      return await apiClient.getPeople(params);
    },
  });

  const people = peopleResponse?.data || [];
  const totalPages = Math.ceil((peopleResponse?.total || 0) / pageSize);
  const totalPeople = peopleResponse?.total || 0;

  // Fetch latest detection for each person when people data changes
  useEffect(() => {
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

  const createPersonMutation = useMutation({
    mutationFn: async (data: PersonFormData) => {
      return await apiClient.createPerson(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setIsModalOpen(false);
      setEditingPerson(null);
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: PersonFormData }) => {
      return await apiClient.updatePerson(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setIsModalOpen(false);
      setEditingPerson(null);
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.deletePerson(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });

  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  // Reset to first page when debounced search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  // Handle page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleEdit = (person: Person) => {
    setEditingPerson(person);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Tem certeza que deseja excluir esta pessoa?')) {
      deletePersonMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 min-h-screen bg-[var(--color-background-primary)]">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Pessoas</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Gerencie as pessoas cadastradas no sistema
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Nova Pessoa
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center space-x-4 flex-1">
              <div className="max-w-md w-full">
                <Input
                  placeholder="Buscar por nome ou documento..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>
              <div className="min-w-[140px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {totalPeople} pessoa{totalPeople !== 1 ? 's' : ''} encontrada{totalPeople !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border-light)]">
              <thead className="bg-[var(--color-background-tertiary)]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-[var(--color-background-secondary)] divide-y divide-[var(--color-border-light)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)] mx-auto"></div>
                    </td>
                  </tr>
                ) : people.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-[var(--color-text-muted)]">
                      Nenhuma pessoa encontrada
                    </td>
                  </tr>
                ) : (
                  people.map((person: Person) => (
                    <tr key={person.id} className="hover:bg-[var(--color-background-tertiary)] transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-[var(--color-secondary-100)] flex items-center justify-center overflow-hidden">
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
                                          <span class="text-sm font-medium text-[var(--color-primary-600)]">
                                            ${person.name?.charAt(0).toUpperCase() || '?'}
                                          </span>
                                        `;
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-medium text-[var(--color-primary-600)]">
                                    {person.name?.charAt(0).toUpperCase() || '?'}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-[var(--color-text-primary)]">
                              {person.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {person.documentNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                        {person.documentNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          person.status === 'active'
                            ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]'
                            : 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]'
                        }`}>
                          {person.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => handleEdit(person)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(person.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, totalPeople)} de {totalPeople} registros
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className="text-sm text-gray-700">Itens por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      if (pageNum > totalPages) return null;

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "primary" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="min-w-[32px]"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      {isModalOpen && (
        <PersonModal
          person={editingPerson}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPerson(null);
          }}
          onSave={(data) => {
            if (editingPerson) {
              updatePersonMutation.mutate({ id: editingPerson.id, data });
            } else {
              createPersonMutation.mutate(data);
            }
          }}
          isLoading={createPersonMutation.isPending || updatePersonMutation.isPending}
        />
      )}
    </div>
  );
};

interface PersonModalProps {
  person: Person | null;
  onClose: () => void;
  onSave: (data: PersonFormData) => void;
  isLoading: boolean;
}

const PersonModal: React.FC<PersonModalProps> = ({ person, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState<PersonFormData>({
    name: person?.name || '',
    personType: person?.personType || 'fisica',
    documentNumber: person?.documentNumber || '',
    birthDate: person?.birthDate || '',
    gender: person?.gender || '',
    status: person?.status || 'active',
    notes: person?.notes || '',
    metadata: person?.metadata || '',
    organizationId: person?.organizationId || 1,
    personId: person?.id || 1,
    email: '',
    telefone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-background-primary)] rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-[var(--color-border-light)]">
          <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
            {person ? 'Editar Pessoa' : 'Nova Pessoa'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nome"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Input
            label="Telefone"
            value={formData.telefone}
            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
          />

          <Input
            label="Documento"
            value={formData.documentNumber}
            onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {person ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PessoasPage;