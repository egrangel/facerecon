import React, { useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Person } from '../../types/api';

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

interface PersonModalProps {
  person: Person | null;
  onClose: () => void;
  onSave: (data: PersonFormData) => void;
  isLoading: boolean;
}

export const PersonModal: React.FC<PersonModalProps> = ({ person, onClose, onSave, isLoading }) => {
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