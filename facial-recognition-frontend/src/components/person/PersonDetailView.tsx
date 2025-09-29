import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { apiClient } from '../../services/api';
import { Person, PersonAddress, PersonContact, PersonFace } from '../../types/api';

// PersonDetailView Component
interface PersonDetailViewProps {
  person: Person;
  onBack: () => void;
}

export const PersonDetailView: React.FC<PersonDetailViewProps> = ({ person, onBack }) => {
  const [activeTab, setActiveTab] = useState<'addresses' | 'contacts' | 'faces'>('addresses');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    personType: '',
    documentNumber: '',
    nationalId: '',
    birthDate: '',
    gender: '',
    status: '',
    notes: '',
  });
  const queryClient = useQueryClient();

  const personId = person.id;

  // Fetch person addresses
  const { data: addresses = [], isLoading: isAddressesLoading, error: addressesError } = useQuery({
    queryKey: ['person-addresses', personId],
    queryFn: () => apiClient.getPersonAddresses(personId),
    enabled: !!personId,
    retry: false,
  });

  // Fetch person contacts
  const { data: contacts = [], isLoading: isContactsLoading, error: contactsError } = useQuery({
    queryKey: ['person-contacts', personId],
    queryFn: () => apiClient.getPersonContacts(personId),
    enabled: !!personId,
    retry: false,
  });

  // Fetch person faces
  const { data: faces = [], isLoading: isFacesLoading, error: facesError } = useQuery({
    queryKey: ['person-faces', personId],
    queryFn: () => apiClient.getPersonFaces(personId),
    enabled: !!personId,
    retry: false,
  });

  // Populate form when person data loads
  useEffect(() => {
    if (person) {
      setEditForm({
        name: person.name || '',
        personType: person.personType || '',
        documentNumber: person.documentNumber || '',
        nationalId: person.nationalId || '',
        birthDate: person.birthDate || '',
        gender: person.gender || '',
        status: person.status || '',
        notes: person.notes || '',
      });
    }
  }, [person]);

  // Update person mutation
  const updatePersonMutation = useMutation({
    mutationFn: (data: any) => apiClient.updatePerson(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', personId] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setIsEditing(false);
    },
  });

  // Handle save
  const handleSave = () => {
    updatePersonMutation.mutate(editForm);
  };

  // Handle cancel
  const handleCancel = () => {
    if (person) {
      setEditForm({
        name: person.name || '',
        personType: person.personType || '',
        documentNumber: person.documentNumber || '',
        nationalId: person.nationalId || '',
        birthDate: person.birthDate || '',
        gender: person.gender || '',
        status: person.status || '',
        notes: person.notes || '',
      });
    }
    setIsEditing(false);
  };

  // Delete mutations
  const deleteAddressMutation = useMutation({
    mutationFn: (addressId: number) => apiClient.deletePersonAddress(personId, addressId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: number) => apiClient.deletePersonContact(personId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-contacts', personId] });
    },
  });

  const deleteFaceMutation = useMutation({
    mutationFn: (faceId: number) => apiClient.deletePersonFace(personId, faceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-faces', personId] });
    },
  });


  return (
    <div className="space-y-6 min-h-screen bg-[var(--color-background-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{person.name}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Detalhes da pessoa</p>
          </div>
        </div>
        <div className="flex space-x-3">
          {isEditing ? (
            <>
              <Button
                onClick={handleSave}
                disabled={updatePersonMutation.isPending}
                variant="primary"
              >
                {updatePersonMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                disabled={updatePersonMutation.isPending}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              Editar Pessoa
            </Button>
          )}
        </div>
      </div>

      {/* Person Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Nome</label>
              {isEditing ? (
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nome da pessoa"
                />
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tipo de Pessoa</label>
              {isEditing ? (
                <select
                  value={editForm.personType}
                  onChange={(e) => setEditForm({ ...editForm, personType: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
                >
                  <option value="fisica">Física</option>
                  <option value="juridica">Jurídica</option>
                </select>
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.personType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Documento</label>
              {isEditing ? (
                <Input
                  value={editForm.documentNumber}
                  onChange={(e) => setEditForm({ ...editForm, documentNumber: e.target.value })}
                  placeholder="Número do documento"
                />
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.documentNumber || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">ID Nacional</label>
              {isEditing ? (
                <Input
                  value={editForm.nationalId}
                  onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })}
                  placeholder="ID Nacional"
                />
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.nationalId || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Data de Nascimento</label>
              {isEditing ? (
                <Input
                  type="date"
                  value={editForm.birthDate}
                  onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })}
                />
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.birthDate || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Gênero</label>
              {isEditing ? (
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
                >
                  <option value="">Selecionar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="O">Outro</option>
                </select>
              ) : (
                <p className="text-[var(--color-text-primary)] py-2">{person.gender || '-'}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Status</label>
              {isEditing ? (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              ) : (
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  person.status === 'active'
                    ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]'
                    : 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]'
                }`}>
                  {person.status}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Notas</label>
            {isEditing ? (
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Notas sobre a pessoa"
                rows={3}
                className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
              />
            ) : (
              <p className="text-[var(--color-text-primary)] py-2">{person.notes || '-'}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <div className="border-b border-[var(--color-border-light)]">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'addresses', label: 'Endereços', count: addresses.length, available: true },
              { id: 'contacts', label: 'Contatos', count: contacts.length, available: true },
              { id: 'faces', label: 'Faces', count: faces.length, available: true },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-medium)]'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </nav>
        </div>

        <CardContent className="p-6">
          {activeTab === 'addresses' && (
            <AddressesTab
              addresses={addresses}
              isLoading={isAddressesLoading}
              error={addressesError}
              onDelete={(id) => deleteAddressMutation.mutate(id)}
              personId={personId}
            />
          )}
          {activeTab === 'contacts' && (
            <ContactsTab
              contacts={contacts}
              isLoading={isContactsLoading}
              error={contactsError}
              onDelete={(id) => deleteContactMutation.mutate(id)}
              personId={personId}
            />
          )}
          {activeTab === 'faces' && (
            <FacesTab
              faces={faces}
              isLoading={isFacesLoading}
              error={facesError}
              onDelete={(id) => deleteFaceMutation.mutate(id)}
              personId={personId}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Addresses Tab Component
interface AddressesTabProps {
  addresses: PersonAddress[];
  isLoading: boolean;
  error?: Error | null;
  onDelete: (id: number) => void;
  personId: number;
}

const AddressesTab: React.FC<AddressesTabProps> = ({ addresses, isLoading, error, onDelete, personId }) => {
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForms, setEditForms] = useState<Record<number, Partial<PersonAddress>>>({});
  const [createForm, setCreateForm] = useState({
    type: 'residencial',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Brasil',
    isPrimary: false,
    status: 'active'
  });
  const queryClient = useQueryClient();

  // Address mutations
  const createAddressMutation = useMutation({
    mutationFn: (data: any) => apiClient.createPersonAddress(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] });
      setIsCreating(false);
      setCreateForm({
        type: 'residencial',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'Brasil',
        isPrimary: false,
        status: 'active'
      });
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao criar endereço: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ addressId, data }: { addressId: number; data: any }) =>
      apiClient.updatePersonAddress(personId, addressId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] });
      setEditingAddressId(null);
      setEditForms({});
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao atualizar endereço: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  // Handler functions
  const handleEdit = (address: PersonAddress) => {
    setEditingAddressId(address.id);
    setEditForms({
      ...editForms,
      [address.id]: {
        type: address.type,
        street: address.street,
        number: address.number || '',
        complement: address.complement || '',
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zipCode: address.zipCode || '',
        country: address.country,
        isPrimary: address.isPrimary,
        status: address.status
      }
    });
  };

  const handleSave = (addressId: number) => {
    const formData = editForms[addressId];
    if (formData) {
      updateAddressMutation.mutate({ addressId, data: formData });
    }
  };

  const handleCancel = (addressId: number) => {
    setEditingAddressId(null);
    const newEditForms = { ...editForms };
    delete newEditForms[addressId];
    setEditForms(newEditForms);
  };

  const handleCreate = () => {
    createAddressMutation.mutate(createForm);
  };

  const updateEditForm = (addressId: number, field: string, value: any) => {
    setEditForms({
      ...editForms,
      [addressId]: {
        ...editForms[addressId],
        [field]: value
      }
    });
  };

  const updateCreateForm = (field: string, value: any) => {
    setCreateForm({
      ...createForm,
      [field]: value
    });
  };

  if (isLoading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)] mx-auto"></div>;
  }

  // Show interface even if API returns 404 - the functionality is ready
  const hasApiError = error && error.message?.includes('404');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Endereços</h3>
        <Button onClick={() => setIsCreating(true)}>Adicionar Endereço</Button>
      </div>

      {/* Show notice if backend not ready but keep interface functional */}
      {hasApiError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Interface pronta:</strong> A funcionalidade de endereços está implementada, mas aguarda a implementação do backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create new address form */}
      {isCreating && (
        <div className="border border-[var(--color-border-light)] rounded-lg p-4 bg-[var(--color-background-secondary)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tipo</label>
              <select
                value={createForm.type}
                onChange={(e) => updateCreateForm('type', e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
              >
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="correspondencia">Correspondência</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Rua</label>
              <Input
                value={createForm.street}
                onChange={(e) => updateCreateForm('street', e.target.value)}
                placeholder="Nome da rua"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Número</label>
              <Input
                value={createForm.number}
                onChange={(e) => updateCreateForm('number', e.target.value)}
                placeholder="Número"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Complemento</label>
              <Input
                value={createForm.complement}
                onChange={(e) => updateCreateForm('complement', e.target.value)}
                placeholder="Apartamento, bloco, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Bairro</label>
              <Input
                value={createForm.neighborhood}
                onChange={(e) => updateCreateForm('neighborhood', e.target.value)}
                placeholder="Bairro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Cidade</label>
              <Input
                value={createForm.city}
                onChange={(e) => updateCreateForm('city', e.target.value)}
                placeholder="Cidade"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Estado</label>
              <Input
                value={createForm.state}
                onChange={(e) => updateCreateForm('state', e.target.value)}
                placeholder="Estado"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">CEP</label>
              <Input
                value={createForm.zipCode}
                onChange={(e) => updateCreateForm('zipCode', e.target.value)}
                placeholder="CEP"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">País</label>
              <Input
                value={createForm.country}
                onChange={(e) => updateCreateForm('country', e.target.value)}
                placeholder="País"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="createPrimary"
                checked={createForm.isPrimary}
                onChange={(e) => updateCreateForm('isPrimary', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="createPrimary" className="text-sm text-[var(--color-text-secondary)]">
                Endereço principal
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreating(false)}
              disabled={createAddressMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createAddressMutation.isPending}
            >
              {createAddressMutation.isPending ? 'Salvando...' : 'Salvar Endereço'}
            </Button>
          </div>
        </div>
      )}

      {addresses.length === 0 && !isCreating ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-secondary)]">Nenhum endereço cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {addresses.map((address) => (
            <div key={address.id} className="border border-[var(--color-border-light)] rounded-lg p-4">
              {editingAddressId === address.id ? (
                /* Edit mode */
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tipo</label>
                      <select
                        value={editForms[address.id]?.type || address.type}
                        onChange={(e) => updateEditForm(address.id, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
                      >
                        <option value="residencial">Residencial</option>
                        <option value="comercial">Comercial</option>
                        <option value="correspondencia">Correspondência</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Rua</label>
                      <Input
                        value={editForms[address.id]?.street || address.street}
                        onChange={(e) => updateEditForm(address.id, 'street', e.target.value)}
                        placeholder="Nome da rua"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Número</label>
                      <Input
                        value={editForms[address.id]?.number || address.number || ''}
                        onChange={(e) => updateEditForm(address.id, 'number', e.target.value)}
                        placeholder="Número"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Complemento</label>
                      <Input
                        value={editForms[address.id]?.complement || address.complement || ''}
                        onChange={(e) => updateEditForm(address.id, 'complement', e.target.value)}
                        placeholder="Apartamento, bloco, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Bairro</label>
                      <Input
                        value={editForms[address.id]?.neighborhood || address.neighborhood}
                        onChange={(e) => updateEditForm(address.id, 'neighborhood', e.target.value)}
                        placeholder="Bairro"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Cidade</label>
                      <Input
                        value={editForms[address.id]?.city || address.city}
                        onChange={(e) => updateEditForm(address.id, 'city', e.target.value)}
                        placeholder="Cidade"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Estado</label>
                      <Input
                        value={editForms[address.id]?.state || address.state}
                        onChange={(e) => updateEditForm(address.id, 'state', e.target.value)}
                        placeholder="Estado"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">CEP</label>
                      <Input
                        value={editForms[address.id]?.zipCode || address.zipCode || ''}
                        onChange={(e) => updateEditForm(address.id, 'zipCode', e.target.value)}
                        placeholder="CEP"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">País</label>
                      <Input
                        value={editForms[address.id]?.country || address.country}
                        onChange={(e) => updateEditForm(address.id, 'country', e.target.value)}
                        placeholder="País"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`editPrimary-${address.id}`}
                        checked={editForms[address.id]?.isPrimary !== undefined ? editForms[address.id]?.isPrimary : address.isPrimary}
                        onChange={(e) => updateEditForm(address.id, 'isPrimary', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor={`editPrimary-${address.id}`} className="text-sm text-[var(--color-text-secondary)]">
                        Endereço principal
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleCancel(address.id)}
                      disabled={updateAddressMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => handleSave(address.id)}
                      disabled={updateAddressMutation.isPending}
                    >
                      {updateAddressMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-[var(--color-text-primary)]">{address.type}</span>
                      {address.isPrimary && (
                        <span className="px-2 py-1 text-xs bg-[var(--color-primary-100)] text-[var(--color-primary-700)] rounded">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--color-text-secondary)]">
                      {address.street}, {address.number} {address.complement && `- ${address.complement}`}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      {address.neighborhood}, {address.city} - {address.state}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      {address.zipCode} - {address.country}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(address)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja excluir este endereço?')) {
                          if (hasApiError) {
                            alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
                          } else {
                            onDelete(address.id);
                          }
                        }
                      }}
                      className="text-[var(--color-status-error-text)] border-[var(--color-status-error-border)]"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Contacts Tab Component
interface ContactsTabProps {
  contacts: PersonContact[];
  isLoading: boolean;
  error?: Error | null;
  onDelete: (id: number) => void;
  personId: number;
}

const ContactsTab: React.FC<ContactsTabProps> = ({ contacts, isLoading, error, onDelete, personId }) => {
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForms, setEditForms] = useState<Record<number, Partial<PersonContact>>>({});
  const [createForm, setCreateForm] = useState({
    type: 'email',
    value: '',
    isPrimary: false,
    status: 'active'
  });
  const queryClient = useQueryClient();

  // Contact mutations
  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiClient.createPersonContact(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-contacts', personId] });
      setIsCreating(false);
      setCreateForm({
        type: 'email',
        value: '',
        isPrimary: false,
        status: 'active'
      });
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao criar contato: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: any }) =>
      apiClient.updatePersonContact(personId, contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-contacts', personId] });
      setEditingContactId(null);
      setEditForms({});
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao atualizar contato: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  // Handler functions
  const handleEdit = (contact: PersonContact) => {
    setEditingContactId(contact.id);
    setEditForms({
      ...editForms,
      [contact.id]: {
        type: contact.type,
        value: contact.value,
        isPrimary: contact.isPrimary,
        status: contact.status
      }
    });
  };

  const handleSave = (contactId: number) => {
    const formData = editForms[contactId];
    if (formData) {
      updateContactMutation.mutate({ contactId, data: formData });
    }
  };

  const handleCancel = (contactId: number) => {
    setEditingContactId(null);
    const newEditForms = { ...editForms };
    delete newEditForms[contactId];
    setEditForms(newEditForms);
  };

  const handleCreate = () => {
    createContactMutation.mutate(createForm);
  };

  const updateEditForm = (contactId: number, field: string, value: any) => {
    setEditForms({
      ...editForms,
      [contactId]: {
        ...editForms[contactId],
        [field]: value
      }
    });
  };

  const updateCreateForm = (field: string, value: any) => {
    setCreateForm({
      ...createForm,
      [field]: value
    });
  };

  // Show interface even if API returns 404 - the functionality is ready
  const hasApiError = error && error.message?.includes('404');

  if (isLoading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)] mx-auto"></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Contatos</h3>
        <Button onClick={() => setIsCreating(true)}>Adicionar Contato</Button>
      </div>

      {/* Show notice if backend not ready but keep interface functional */}
      {hasApiError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Interface pronta:</strong> A funcionalidade de contatos está implementada, mas aguarda a implementação do backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create new contact form */}
      {isCreating && (
        <div className="border border-[var(--color-border-light)] rounded-lg p-4 bg-[var(--color-background-secondary)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tipo</label>
              <select
                value={createForm.type}
                onChange={(e) => updateCreateForm('type', e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
              >
                <option value="email">Email</option>
                <option value="phone">Telefone</option>
                <option value="mobile">Celular</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Valor</label>
              <Input
                value={createForm.value}
                onChange={(e) => updateCreateForm('value', e.target.value)}
                placeholder="Digite o contato"
                type={createForm.type === 'email' ? 'email' : 'text'}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="createContactPrimary"
                checked={createForm.isPrimary}
                onChange={(e) => updateCreateForm('isPrimary', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="createContactPrimary" className="text-sm text-[var(--color-text-secondary)]">
                Contato principal
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsCreating(false)}
              disabled={createContactMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createContactMutation.isPending}
            >
              {createContactMutation.isPending ? 'Salvando...' : 'Salvar Contato'}
            </Button>
          </div>
        </div>
      )}

      {contacts.length === 0 && !isCreating ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-secondary)]">Nenhum contato cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {contacts.map((contact) => (
            <div key={contact.id} className="border border-[var(--color-border-light)] rounded-lg p-4">
              {editingContactId === contact.id ? (
                /* Edit mode */
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Tipo</label>
                      <select
                        value={editForms[contact.id]?.type || contact.type}
                        onChange={(e) => updateEditForm(contact.id, 'type', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] bg-[var(--color-background-primary)] text-[var(--color-text-primary)]"
                      >
                        <option value="email">Email</option>
                        <option value="phone">Telefone</option>
                        <option value="mobile">Celular</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telegram">Telegram</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Valor</label>
                      <Input
                        value={editForms[contact.id]?.value || contact.value}
                        onChange={(e) => updateEditForm(contact.id, 'value', e.target.value)}
                        placeholder="Digite o contato"
                        type={editForms[contact.id]?.type === 'email' || contact.type === 'email' ? 'email' : 'text'}
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`editContactPrimary-${contact.id}`}
                        checked={editForms[contact.id]?.isPrimary !== undefined ? editForms[contact.id]?.isPrimary : contact.isPrimary}
                        onChange={(e) => updateEditForm(contact.id, 'isPrimary', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor={`editContactPrimary-${contact.id}`} className="text-sm text-[var(--color-text-secondary)]">
                        Contato principal
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleCancel(contact.id)}
                      disabled={updateContactMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => handleSave(contact.id)}
                      disabled={updateContactMutation.isPending}
                    >
                      {updateContactMutation.isPending ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-[var(--color-text-primary)]">{contact.type}</span>
                      {contact.isPrimary && (
                        <span className="px-2 py-1 text-xs bg-[var(--color-primary-100)] text-[var(--color-primary-700)] rounded">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--color-text-secondary)]">{contact.value}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(contact)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja excluir este contato?')) {
                          if (hasApiError) {
                            alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
                          } else {
                            onDelete(contact.id);
                          }
                        }
                      }}
                      className="text-[var(--color-status-error-text)] border-[var(--color-status-error-border)]"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Faces Tab Component
interface FacesTabProps {
  faces: PersonFace[];
  isLoading: boolean;
  error?: Error | null;
  onDelete: (id: number) => void;
  personId: number;
}

const FacesTab: React.FC<FacesTabProps> = ({ faces, isLoading, error, onDelete, personId }) => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingFaceId, setEditingFaceId] = useState<number | null>(null);
  const [editForms, setEditForms] = useState<{ [key: number]: any }>({});
  const [createForm, setCreateForm] = useState({
    biometricParameters: '',
    reliability: 0.8,
    status: 'active',
    notes: ''
  });

  // Mutations
  const createFaceMutation = useMutation({
    mutationFn: (data: any) => apiClient.createPersonFace(personId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-faces', personId] });
      setIsCreating(false);
      setCreateForm({
        biometricParameters: '',
        reliability: 0.8,
        status: 'active',
        notes: ''
      });
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao criar face: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  const updateFaceMutation = useMutation({
    mutationFn: ({ faceId, data }: { faceId: number; data: any }) =>
      apiClient.updatePersonFace(personId, faceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-faces', personId] });
      setEditingFaceId(null);
      setEditForms({});
    },
    onError: (error: any) => {
      if (error.response?.status === 404) {
        alert('Backend ainda não implementado. A funcionalidade estará disponível em breve.');
      } else {
        alert('Erro ao atualizar face: ' + (error.message || 'Erro desconhecido'));
      }
    },
  });

  // Handler functions
  const handleEdit = (face: PersonFace) => {
    setEditingFaceId(face.id);
    setEditForms({
      ...editForms,
      [face.id]: {
        biometricParameters: face.biometricParameters || '',
        reliability: face.reliability || 0.8,
        status: face.status,
        notes: face.notes || ''
      }
    });
  };

  const handleSave = (faceId: number) => {
    const formData = editForms[faceId];
    if (formData) {
      updateFaceMutation.mutate({ faceId, data: formData });
    }
  };

  const handleCancel = (faceId: number) => {
    setEditingFaceId(null);
    const newEditForms = { ...editForms };
    delete newEditForms[faceId];
    setEditForms(newEditForms);
  };

  const handleCreate = () => {
    createFaceMutation.mutate(createForm);
  };

  const updateEditForm = (faceId: number, field: string, value: any) => {
    setEditForms({
      ...editForms,
      [faceId]: {
        ...editForms[faceId],
        [field]: value
      }
    });
  };

  const updateCreateForm = (field: string, value: any) => {
    setCreateForm({
      ...createForm,
      [field]: value
    });
  };

  if (isLoading) {
    return <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)] mx-auto"></div>;
  }

  // Show interface even if API returns 404 - the functionality is ready
  const hasApiError = error && error.message?.includes('404');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)]">Faces</h3>
        <Button onClick={() => setIsCreating(true)}>Adicionar Face</Button>
      </div>

      {hasApiError && (
        <div className="p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-md">
          <p className="text-[var(--color-warning-text)]">
            Interface pronta: A funcionalidade de faces está implementada, mas aguarda a implementação do backend.
          </p>
        </div>
      )}

      {/* Create Form */}
      {isCreating && (
        <div className="border border-[var(--color-border-light)] rounded-lg p-4 bg-[var(--color-background-elevated)]">
          <h4 className="font-medium text-[var(--color-text-primary)] mb-3">Nova Face</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Parâmetros Biométricos
              </label>
              <Input
                value={createForm.biometricParameters}
                onChange={(e) => updateCreateForm('biometricParameters', e.target.value)}
                placeholder="Parâmetros da face"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Confiabilidade
              </label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={createForm.reliability}
                onChange={(e) => updateCreateForm('reliability', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Status
              </label>
              <select
                value={createForm.status}
                onChange={(e) => updateCreateForm('status', e.target.value)}
                className="w-full px-3 py-2 border border-[var(--color-border-light)] rounded-md text-[var(--color-text-primary)] bg-[var(--color-background-primary)]"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                Observações
              </label>
              <Input
                value={createForm.notes}
                onChange={(e) => updateCreateForm('notes', e.target.value)}
                placeholder="Observações"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {faces.length === 0 && !hasApiError ? (
        <div className="text-center py-8">
          <p className="text-[var(--color-text-secondary)]">Nenhuma face cadastrada</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {faces.map((face) => (
            <div key={face.id} className="border border-[var(--color-border-light)] rounded-lg p-4">
              {editingFaceId === face.id ? (
                // Edit mode
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                        Parâmetros Biométricos
                      </label>
                      <Input
                        value={editForms[face.id]?.biometricParameters || ''}
                        onChange={(e) => updateEditForm(face.id, 'biometricParameters', e.target.value)}
                        placeholder="Parâmetros da face"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                        Confiabilidade
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="1"
                        step="0.1"
                        value={editForms[face.id]?.reliability || 0.8}
                        onChange={(e) => updateEditForm(face.id, 'reliability', parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                        Status
                      </label>
                      <select
                        value={editForms[face.id]?.status || 'active'}
                        onChange={(e) => updateEditForm(face.id, 'status', e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--color-border-light)] rounded-md text-[var(--color-text-primary)] bg-[var(--color-background-primary)]"
                      >
                        <option value="active">Ativo</option>
                        <option value="inactive">Inativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                        Observações
                      </label>
                      <Input
                        value={editForms[face.id]?.notes || ''}
                        onChange={(e) => updateEditForm(face.id, 'notes', e.target.value)}
                        placeholder="Observações"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => handleCancel(face.id)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => handleSave(face.id)}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-[var(--color-text-primary)]">Face #{face.id}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        face.status === 'active'
                          ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]'
                          : 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]'
                      }`}>
                        {face.status}
                      </span>
                    </div>
                    {face.reliability && (
                      <p className="text-[var(--color-text-secondary)]">
                        Confiabilidade: {(face.reliability * 100).toFixed(1)}%
                      </p>
                    )}
                    {face.biometricParameters && (
                      <p className="text-[var(--color-text-secondary)]">
                        Parâmetros: {face.biometricParameters}
                      </p>
                    )}
                    {face.notes && (
                      <p className="text-[var(--color-text-secondary)] mt-2">{face.notes}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(face)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja excluir esta face?')) {
                          onDelete(face.id);
                        }
                      }}
                      className="text-[var(--color-status-error-text)] border-[var(--color-status-error-border)]"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};