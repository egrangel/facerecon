import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { apiClient } from '../services/api';

const DashboardHome: React.FC = () => {
  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      return await apiClient.getDashboardStats();
    },
  });

  const { data: systemStatus, isLoading: isLoadingStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: async () => {
      return await apiClient.getSystemStatus();
    },
  });

  const stats = [
    {
      name: 'Total de Pessoas',
      value: isLoadingStats ? '...' : (dashboardStats?.totalPeople.toLocaleString() || '0'),
      change: '+12%', // This could be calculated from historical data
      changeType: 'increase',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      name: 'Detecções Hoje',
      value: isLoadingStats ? '...' : (dashboardStats?.detectionsToday.toString() || '0'),
      change: '+23%', // This could be calculated from historical data
      changeType: 'increase',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      name: 'Câmeras Ativas',
      value: isLoadingStats ? '...' : (dashboardStats?.activeCameras.toString() || '0'),
      change: '+1', // This could be calculated from historical data
      changeType: 'increase',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Eventos Hoje',
      value: isLoadingStats ? '...' : (dashboardStats?.eventsToday.toString() || '0'),
      change: '+8%', // This could be calculated from historical data
      changeType: 'increase',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Visão geral do sistema de reconhecimento facial
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.name}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 bg-primary-100 rounded-lg text-primary-600">
                    {item.icon}
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {item.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {item.value}
                      </div>
                      <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                        <svg className="self-center flex-shrink-0 h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="sr-only">Increased by</span>
                        {item.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flow-root">
              <ul className="-mb-8">
                {isLoadingStats ? (
                  <li className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                  </li>
                ) : (
                  (dashboardStats?.recentActivity || []).map((item, itemIdx) => (
                    <li key={item.id}>
                      <div className="relative pb-8">
                        {itemIdx !== (dashboardStats?.recentActivity.length || 1) - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              item.type === 'person' ? 'bg-blue-500' :
                              item.type === 'detection' ? 'bg-green-500' :
                              item.type === 'event' ? 'bg-yellow-500' :
                              'bg-primary-500'
                            }`}>
                              {item.type === 'person' && (
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              )}
                              {item.type === 'detection' && (
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                                </svg>
                              )}
                              {item.type === 'event' && (
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                                </svg>
                              )}
                              {!['person', 'detection', 'event'].includes(item.type) && (
                                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                              )}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-sm text-gray-500">{item.content}</p>
                            </div>
                            <div className="text-right text-sm whitespace-nowrap text-gray-500">
                              <time>{item.time}</time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingStatus ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-3 ${
                        systemStatus?.api.status === 'online' ? 'bg-green-400' :
                        systemStatus?.api.status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">API Backend</span>
                    </div>
                    <span className={`text-sm ${
                      systemStatus?.api.status === 'online' ? 'text-green-600' :
                      systemStatus?.api.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                    }`}>{systemStatus?.api.message || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-3 ${
                        systemStatus?.database.status === 'connected' ? 'bg-green-400' :
                        systemStatus?.database.status === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Banco de Dados</span>
                    </div>
                    <span className={`text-sm ${
                      systemStatus?.database.status === 'connected' ? 'text-green-600' :
                      systemStatus?.database.status === 'disconnected' ? 'text-red-600' : 'text-yellow-600'
                    }`}>{systemStatus?.database.message || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-3 ${
                        systemStatus?.ai.status === 'online' ? 'bg-green-400' :
                        systemStatus?.ai.status === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Serviço de IA</span>
                    </div>
                    <span className={`text-sm ${
                      systemStatus?.ai.status === 'online' ? 'text-green-600' :
                      systemStatus?.ai.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                    }`}>{systemStatus?.ai.message || 'Unknown'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`h-4 w-4 rounded-full mr-3 ${
                        systemStatus?.storage.status === 'available' ? 'bg-green-400' :
                        systemStatus?.storage.status === 'full' ? 'bg-red-400' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm font-medium text-gray-900">Storage</span>
                    </div>
                    <span className={`text-sm ${
                      systemStatus?.storage.status === 'available' ? 'text-green-600' :
                      systemStatus?.storage.status === 'full' ? 'text-red-600' : 'text-yellow-600'
                    }`}>{systemStatus?.storage.message || 'Unknown'}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;