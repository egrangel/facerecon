import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';

interface CadastroStats {
  totalPessoas: number;
  totalCameras: number;
  totalUsuarios: number;
  ultimosCadastros: Array<{
    id: number;
    tipo: 'pessoa' | 'camera' | 'usuario';
    nome: string;
    data: string;
  }>;
}

const CadastrosPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'resumo' | 'pessoas' | 'cameras' | 'usuarios'>('resumo');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['cadastros-stats'],
    queryFn: async () => {
      // Simulando dados para o exemplo
      const mockStats: CadastroStats = {
        totalPessoas: 1234,
        totalCameras: 12,
        totalUsuarios: 5,
        ultimosCadastros: [
          { id: 1, tipo: 'pessoa', nome: 'João Silva', data: new Date().toISOString() },
          { id: 2, tipo: 'camera', nome: 'Câmera Entrada Principal', data: new Date().toISOString() },
          { id: 3, tipo: 'pessoa', nome: 'Maria Santos', data: new Date().toISOString() },
          { id: 4, tipo: 'usuario', nome: 'Admin System', data: new Date().toISOString() },
          { id: 5, tipo: 'pessoa', nome: 'Pedro Costa', data: new Date().toISOString() },
        ]
      };
      return mockStats;
    },
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'pessoa':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'camera':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'usuario':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'pessoa':
        return 'bg-blue-100 text-blue-800';
      case 'camera':
        return 'bg-green-100 text-green-800';
      case 'usuario':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'resumo', name: 'Resumo', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: 'pessoas', name: 'Pessoas', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    )},
    { id: 'cameras', name: 'Câmeras', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )},
    { id: 'usuarios', name: 'Usuários', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cadastros</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gerencie todos os cadastros do sistema
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'resumo' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <h3 className="text-lg font-medium text-gray-900">Pessoas</h3>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.totalPessoas.toLocaleString() || 0}
                    </div>
                    <p className="text-sm text-gray-500">Total cadastradas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <h3 className="text-lg font-medium text-gray-900">Câmeras</h3>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.totalCameras || 0}
                    </div>
                    <p className="text-sm text-gray-500">Total configuradas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="ml-5">
                    <h3 className="text-lg font-medium text-gray-900">Usuários</h3>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats?.totalUsuarios || 0}
                    </div>
                    <p className="text-sm text-gray-500">Com acesso ao sistema</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Cadastros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </div>
                ) : (
                  stats?.ultimosCadastros.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-lg ${getTipoColor(item.tipo)}`}>
                        {getTipoIcon(item.tipo)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.nome}</p>
                        <p className="text-sm text-gray-500 capitalize">
                          {item.tipo} cadastrado(a) em {new Date(item.data).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'pessoas' && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <div className="p-4 bg-blue-100 rounded-full w-16 h-16 mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Cadastro de Pessoas</h3>
              <p className="text-gray-500 mb-6">
                Para gerenciar pessoas, acesse a seção dedicada.
              </p>
              <Button onClick={() => window.location.href = '/dashboard/pessoas'}>
                Ir para Pessoas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'cameras' && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <div className="p-4 bg-green-100 rounded-full w-16 h-16 mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Cadastro de Câmeras</h3>
              <p className="text-gray-500 mb-6">
                Para gerenciar câmeras, acesse a seção dedicada.
              </p>
              <Button onClick={() => window.location.href = '/dashboard/cameras'}>
                Ir para Câmeras
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'usuarios' && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <div className="p-4 bg-purple-100 rounded-full w-16 h-16 mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Gerenciamento de Usuários</h3>
              <p className="text-gray-500 mb-6">
                Funcionalidade de gerenciamento de usuários em desenvolvimento.
              </p>
              <Button variant="outline" disabled>
                Em breve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CadastrosPage;