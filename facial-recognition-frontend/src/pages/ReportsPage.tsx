import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { apiClient } from '../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface AttendanceData {
  personName: string;
  personId: number;
  count: number;
  percentage: number;
  [key: string]: any;
}

interface EventAttendanceData {
  eventName: string;
  eventId: number;
  count: number;
  percentage: number;
  [key: string]: any;
}

type ReportType = 'participant-frequency' | 'event-frequency';

const ReportsPage: React.FC = () => {
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('participant-frequency');

  // Get available events for filter
  const { data: eventsResponse } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      return await apiClient.getEvents({ limit: 100 });
    },
  });

  // Get attendance frequency data by participants
  const { data: attendanceData, isLoading: isLoadingParticipants, refetch: refetchParticipants } = useQuery({
    queryKey: ['reports', 'attendance-frequency', selectedEventIds],
    queryFn: async () => {
      return await apiClient.getAttendanceFrequencyReport({
        eventIds: selectedEventIds.length > 0 ? selectedEventIds : undefined,
      });
    },
    enabled: false, // Only fetch when user clicks "Generate Report"
  });

  // Get attendance frequency data by events
  const { data: eventAttendanceData, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ['reports', 'event-frequency', selectedEventIds],
    queryFn: async () => {
      return await apiClient.getEventFrequencyReport({
        eventIds: selectedEventIds.length > 0 ? selectedEventIds : undefined,
      });
    },
    enabled: false, // Only fetch when user clicks "Generate Report"
  });

  const events = eventsResponse?.data || [];
  const attendance: AttendanceData[] = attendanceData?.data || [];
  const eventAttendance: EventAttendanceData[] = eventAttendanceData?.data || [];
  const isLoading = isLoadingParticipants || isLoadingEvents;

  // Colors for pie chart
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
    '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0',
    '#FFB347', '#87CEEB', '#DDA0DD', '#98FB98', '#F0E68C'
  ];

  const handleGenerateReport = () => {
    // Trigger the appropriate query based on selected report type
    if (selectedReportType === 'participant-frequency') {
      refetchParticipants();
    } else if (selectedReportType === 'event-frequency') {
      refetchEvents();
    }
  };

  const handleEventToggle = (eventId: number) => {
    setSelectedEventIds(prev => {
      if (prev.includes(eventId)) {
        return prev.filter(id => id !== eventId);
      } else {
        return [...prev, eventId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedEventIds.length === events.length) {
      // If all are selected, deselect all
      setSelectedEventIds([]);
    } else {
      // Select all events
      setSelectedEventIds(events.map((event: any) => event.id));
    }
  };

  const clearFilters = () => {
    setSelectedEventIds([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Relatórios</h1>
          <p className="mt-2 text-sm text-gray-700">
            Visualize estatísticas e relatórios do sistema
          </p>
        </div>
      </div>

      {/* Report Type and Filters */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">
            📊 Configurar Relatório
          </h3>

          <div className="space-y-6">
            {/* Report Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Relatório
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="participant-frequency"
                    checked={selectedReportType === 'participant-frequency'}
                    onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-700">Frequência por Participante</div>
                    <div className="text-xs text-gray-500">Quantas vezes cada pessoa foi detectada</div>
                  </div>
                </label>
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="event-frequency"
                    checked={selectedReportType === 'event-frequency'}
                    onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-700">Frequência por Evento</div>
                    <div className="text-xs text-gray-500">Quantas pessoas participaram de cada evento</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Event Selection */}
            <div className="flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Selecionar Eventos
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                  >
                    {selectedEventIds.length === events.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                  <span className="text-sm text-gray-500">
                    ({selectedEventIds.length} de {events.length} selecionados)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3">
                {events.map((event: any) => (
                  <label key={event.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedEventIds.includes(event.id)}
                      onChange={() => handleEventToggle(event.id)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{event.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex space-x-3">
              <Button
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="bg-primary-600 hover:bg-primary-700"
              >
                {isLoading ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Limpar Seleção
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {selectedReportType === 'participant-frequency' && attendance.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              📊 Frequência por Participante
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Distribuição de Frequência
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={attendance as any}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }: any) => `${percentage.toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="personName"
                      >
                        {attendance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [value, 'Detecções']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Gráfico de Barras
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendance} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="personName"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: any, name: any) => [value, 'Detecções']}
                        labelFormatter={(label: any) => `Participante: ${label}`}
                      />
                      <Bar dataKey="count" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="mt-6 bg-white rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Detalhes por Participante
              </h4>
              <div className="overflow-y-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participante
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Detecções
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Porcentagem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendance.map((item, index) => (
                      <tr key={item.personId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.personName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReportType === 'event-frequency' && eventAttendance.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">
              📅 Frequência por Evento
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Distribuição por Evento
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eventAttendance as any}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percentage }: any) => `${percentage.toFixed(1)}%`}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="eventName"
                      >
                        {eventAttendance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name: any) => [value, 'Participantes']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-white rounded-lg border p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Gráfico de Barras
                </h4>
                <div style={{ width: '100%', height: '400px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventAttendance} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="eventName"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        fontSize={12}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value: any, name: any) => [value, 'Participantes']}
                        labelFormatter={(label: any) => `Evento: ${label}`}
                      />
                      <Bar dataKey="count" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="mt-6 bg-white rounded-lg border p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">
                Detalhes por Evento
              </h4>
              <div className="overflow-y-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Evento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participantes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Porcentagem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {eventAttendance.map((item, index) => (
                      <tr key={item.eventId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            ></div>
                            <div className="text-sm font-medium text-gray-900">
                              {item.eventName}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {((selectedReportType === 'participant-frequency' && attendance.length === 0) ||
        (selectedReportType === 'event-frequency' && eventAttendance.length === 0)) &&
        !isLoading && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum dado encontrado</h3>
              <p className="mt-1 text-sm text-gray-500">
                Selecione eventos e clique em "Gerar Relatório" para visualizar os dados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportsPage;