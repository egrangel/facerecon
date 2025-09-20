import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { Person } from '../types/api';

interface PersonFormData {
  name: string;
  personType: string;
  documentNumber?: string;
  birthDate?: string;
  gender?: string;
  status: string;
  notes?: string;
  metadata?: string;
  organizationId: number;
  cadastroId: number;
  email?: string;
  telefone?: string;
}

const PessoasPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();

  const { data: peopleResponse, isLoading } = useQuery({
    queryKey: ['people'],
    queryFn: async () => {
      return await apiClient.getPeople();
    },
  });

  const people = peopleResponse?.data || [];

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

  const filteredPeople = people.filter((person: Person) =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.documentNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Pessoas</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gerencie as pessoas cadastradas no sistema
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          Nova Pessoa
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="max-w-md w-full">
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    </td>
                  </tr>
                ) : filteredPeople.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      Nenhuma pessoa encontrada
                    </td>
                  </tr>
                ) : (
                  filteredPeople.map((person: Person) => (
                    <tr key={person.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary-600">
                                {person.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {person.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.documentNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.documentNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          person.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {person.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(person)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
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
    cadastroId: person?.id || 1,
    email: '',
    telefone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
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