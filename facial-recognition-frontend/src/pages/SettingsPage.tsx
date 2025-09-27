import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Organization, User } from '../types/api';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import ThemeConfiguration from '../components/ThemeConfiguration';

interface UserFormData {
  email: string;
  password?: string;
  name: string;
  role: 'admin' | 'user' | 'operator';
}

interface OrganizationFormData {
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'organization' | 'users' | 'theme'>('organization');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const queryClient = useQueryClient();

  // Organization data and form
  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiClient.getCurrentOrganization(),
  });

  const {
    register: registerOrg,
    handleSubmit: handleOrgSubmit,
    formState: { errors: orgErrors },
    reset: resetOrg,
  } = useForm<OrganizationFormData>();

  // Users data and form
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['organization-users'],
    queryFn: () => apiClient.getOrganizationUsers(),
  });

  const {
    register: registerUser,
    handleSubmit: handleUserSubmit,
    formState: { errors: userErrors },
    reset: resetUser,
    setValue: setUserValue,
  } = useForm<UserFormData>();

  // Mutations
  const updateOrgMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => apiClient.updateCurrentOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      alert('Organization updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error updating organization');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (data: { email: string; password: string; name: string; role?: 'admin' | 'user' | 'operator' }) =>
      apiClient.createOrganizationUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      setShowUserModal(false);
      resetUser();
      alert('User created successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error creating user');
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<User> }) =>
      apiClient.updateOrganizationUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      setShowUserModal(false);
      setEditingUser(null);
      resetUser();
      alert('User updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error updating user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiClient.deleteOrganizationUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-users'] });
      alert('User deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Error deleting user');
    },
  });

  // Reset organization form when data loads
  useEffect(() => {
    if (organization) {
      resetOrg({
        name: organization.name,
        description: organization.description || '',
        status: organization.status as 'active' | 'inactive',
      });
    }
  }, [organization, resetOrg]);

  // Handle edit user
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserValue('email', user.email);
    setUserValue('name', user.name);
    setUserValue('role', user.role);
    setShowUserModal(true);
  };

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    if (window.confirm(`Are you sure you want to delete user "${user.name}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  // Form submissions
  const onOrgSubmit = (data: OrganizationFormData) => {
    updateOrgMutation.mutate(data);
  };

  const onUserSubmit = (data: UserFormData) => {
    if (editingUser) {
      // Update existing user (exclude password)
      const updateData: Partial<User> = {
        email: data.email,
        name: data.name,
        role: data.role,
      };
      updateUserMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      // Create new user - password is required for new users
      if (!data.password) {
        alert('Password is required for new users');
        return;
      }
      const createData = {
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
      };
      createUserMutation.mutate(createData);
    }
  };

  // Close user modal
  const closeUserModal = () => {
    setShowUserModal(false);
    setEditingUser(null);
    resetUser();
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-[var(--color-background-primary)]">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[var(--color-primary-500)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[var(--color-background-primary)]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Configurações</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border-light)]">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('organization')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'organization'
                ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-medium)]'
            }`}
          >
            Organização
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'users'
                ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-medium)]'
            }`}
          >
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'theme'
                ? 'border-[var(--color-primary-500)] text-[var(--color-primary-600)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-medium)]'
            }`}
          >
            Tema
          </button>
        </nav>
      </div>

      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <Card>
          <CardHeader>
            <CardTitle>Informações da Organização</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOrgSubmit(onOrgSubmit)} className="space-y-4">
              <div>
                <Input
                  label="Organization Name"
                  error={orgErrors.name?.message}
                  {...registerOrg('name', {
                    required: 'Organization name is required',
                  })}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Descrição
                </label>
                <textarea
                  id="description"
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-[var(--border-radius-md)] shadow-[var(--shadow-sm)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-all duration-200"
                  {...registerOrg('description')}
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                  Status
                </label>
                <select
                  id="status"
                  className="mt-1 block w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-[var(--border-radius-md)] shadow-[var(--shadow-sm)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-all duration-200"
                  {...registerOrg('status')}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>

              <Button
                type="submit"
                isLoading={updateOrgMutation.isPending}
                className="w-full sm:w-auto"
              >
                Atualizar Organização
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Usuários da Organização</h2>
            <Button
              onClick={() => setShowUserModal(true)}
              className="bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]"
            >
              Adicionar Usuário
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary-500)]"></div>
            </div>
          ) : (
            <div className="bg-[var(--color-background-secondary)] shadow-[var(--shadow-md)] overflow-hidden sm:rounded-[var(--border-radius-md)]">
              <ul className="divide-y divide-[var(--color-border-light)]">
                {users.map((user) => (
                  <li key={user.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-[var(--color-primary-600)] truncate">
                            {user.name}
                          </p>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'admin' ? 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error-text)]' :
                            user.role === 'operator' ? 'bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]' :
                            'bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-[var(--color-text-secondary)]">{user.email}</p>
                        </div>
                        <div className="mt-1 flex items-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.status === 'active' ? 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success-text)]' : 'bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]'
                          }`}>
                            {user.status}
                          </span>
                          {user.lastLoginAt && (
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                              Último acesso: {new Date(user.lastLoginAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user)}
                          className="text-[var(--color-status-error-text)] border-[var(--color-status-error-border)] hover:bg-[var(--color-status-error-bg)]"
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Theme Tab */}
      {activeTab === 'theme' && (
        <ThemeConfiguration />
      )}

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-[var(--color-text-primary)] bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-[var(--color-border-light)] w-96 shadow-[var(--shadow-xl)] rounded-[var(--border-radius-lg)] bg-[var(--color-background-secondary)]">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <form onSubmit={handleUserSubmit(onUserSubmit)} className="space-y-4">
                <div>
                  <Input
                    label="Name"
                    error={userErrors.name?.message}
                    {...registerUser('name', {
                      required: 'Name is required',
                    })}
                  />
                </div>

                <div>
                  <Input
                    label="Email"
                    type="email"
                    error={userErrors.email?.message}
                    {...registerUser('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: 'Invalid email format',
                      },
                    })}
                  />
                </div>

                {!editingUser && (
                  <div>
                    <Input
                      label="Password"
                      type="password"
                      error={userErrors.password?.message}
                      {...registerUser('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 6,
                          message: 'Password must be at least 6 characters',
                        },
                      })}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    Perfil
                  </label>
                  <select
                    id="role"
                    className="mt-1 block w-full px-3 py-2 border border-[var(--color-border-medium)] rounded-[var(--border-radius-md)] shadow-[var(--shadow-sm)] bg-[var(--color-background-secondary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-500)] focus:border-[var(--color-primary-500)] transition-all duration-200"
                    {...registerUser('role')}
                  >
                    <option value="user">Usuário</option>
                    <option value="operator">Operador</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeUserModal}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    isLoading={createUserMutation.isPending || updateUserMutation.isPending}
                  >
                    {editingUser ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;