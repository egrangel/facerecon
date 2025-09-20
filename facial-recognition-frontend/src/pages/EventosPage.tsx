import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';

interface Evento {
  id: number;
  tipo: 'deteccao' | 'acesso_negado' | 'sistema' | 'erro' | 'alerta';
  descricao: string;
  timestamp: string;
  pessoa?: {
    id: number;
    nome: string;
  };
  camera?: {
    id: number;
    nome: string;
    localizacao: string;
  };
  deteccao?: {
    id: number;
    confianca: number;
  };
  metadata?: any;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'novo' | 'visto' | 'resolvido';
}

const EventosPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [severidadeFilter, setSeveridadeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: async () => {
      const response = await apiClient.get('/eventos');
      return response.data;
    },
  });

  const filteredEventos = eventos.filter((evento: Evento) => {
    const matchesSearch = evento.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evento.pessoa?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         evento.camera?.nome.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = !tipoFilter || evento.tipo === tipoFilter;
    const matchesSeveridade = !severidadeFilter || evento.severidade === severidadeFilter;
    const matchesStatus = !statusFilter || evento.status === statusFilter;
    const matchesDate = !dateFilter || new Date(evento.timestamp).toDateString() === new Date(dateFilter).toDateString();

    return matchesSearch && matchesTipo && matchesSeveridade && matchesStatus && matchesDate;
  });

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
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

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case 'critica':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'alta':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'baixa':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Input
              placeholder="Buscar eventos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos os tipos</option>
              <option value="deteccao">Detecção</option>
              <option value="acesso_negado">Acesso Negado</option>
              <option value="sistema">Sistema</option>
              <option value="erro">Erro</option>
              <option value="alerta">Alerta</option>
            </select>

            <select
              value={severidadeFilter}
              onChange={(e) => setSeveridadeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todas severidades</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Todos os status</option>
              <option value="novo">Novo</option>
              <option value="visto">Visto</option>
              <option value="resolvido">Resolvido</option>
            </select>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />

            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setTipoFilter('');
                setSeveridadeFilter('');
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
            ) : filteredEventos.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                Nenhum evento encontrado
              </div>
            ) : (
              filteredEventos.map((evento: Evento) => (
                <div
                  key={evento.id}
                  className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedEvento(evento)}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg ${getSeveridadeColor(evento.severidade)} border`}>
                      <div className="text-current">
                        {getTipoIcon(evento.tipo)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900 capitalize">
                            {evento.tipo.replace('_', ' ')}
                          </h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSeveridadeColor(evento.severidade)}`}>
                            {evento.severidade}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(evento.status)}`}>
                            {evento.status}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(evento.timestamp)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700 mb-2">
                        {evento.descricao}
                      </p>

                      {(evento.pessoa || evento.camera) && (
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {evento.pessoa && (
                            <span>Pessoa: {evento.pessoa.nome}</span>
                          )}
                          {evento.camera && (
                            <span>Câmera: {evento.camera.nome} ({evento.camera.localizacao})</span>
                          )}
                          {evento.deteccao && (
                            <span>Confiança: {evento.deteccao.confianca.toFixed(1)}%</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      {selectedEvento && (
        <EventoModal
          evento={selectedEvento}
          onClose={() => setSelectedEvento(null)}
        />
      )}
    </div>
  );
};

interface EventoModalProps {
  evento: Evento;
  onClose: () => void;
}

const EventoModal: React.FC<EventoModalProps> = ({ evento, onClose }) => {
  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case 'critica':
        return 'bg-red-100 text-red-800';
      case 'alta':
        return 'bg-orange-100 text-orange-800';
      case 'media':
        return 'bg-yellow-100 text-yellow-800';
      case 'baixa':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
              {evento.tipo.replace('_', ' ')}
            </h4>
            <div className="flex space-x-2">
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getSeveridadeColor(evento.severidade)}`}>
                {evento.severidade}
              </span>
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(evento.status)}`}>
                {evento.status}
              </span>
            </div>
          </div>

          {/* Informações principais */}
          <div className="space-y-4">
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">Descrição</h5>
              <p className="text-gray-900">{evento.descricao}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Data e Hora</h5>
                <p className="text-gray-900">{new Date(evento.timestamp).toLocaleString('pt-BR')}</p>
              </div>

              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">ID do Evento</h5>
                <p className="text-gray-900">#{evento.id}</p>
              </div>
            </div>

            {evento.pessoa && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Pessoa Relacionada</h5>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{evento.pessoa.nome}</p>
                  <p className="text-sm text-gray-500">ID: {evento.pessoa.id}</p>
                </div>
              </div>
            )}

            {evento.camera && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Câmera Relacionada</h5>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{evento.camera.nome}</p>
                  <p className="text-sm text-gray-500">{evento.camera.localizacao}</p>
                  <p className="text-sm text-gray-500">ID: {evento.camera.id}</p>
                </div>
              </div>
            )}

            {evento.deteccao && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Detecção Relacionada</h5>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm">ID: {evento.deteccao.id}</p>
                  <p className="text-sm">Confiança: {evento.deteccao.confianca.toFixed(2)}%</p>
                </div>
              </div>
            )}

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