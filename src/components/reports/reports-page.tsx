'use client'

import { useState, useCallback, useMemo } from 'react'
import { 
  BarChart3, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  Ticket,
  Users,
  Activity,
  AlertCircle,
  FileText,
  Settings2,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useReports } from '@/hooks/use-reports'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { cn } from '@/lib/utils'

// Componente estandarizado
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'

// Componentes consolidados
import { ReportFilters } from './report-filters'
import { ReportKPIMetrics } from './report-kpi-metrics'

// Componentes de gráficos
import { TicketTrendsChart } from './charts/ticket-trends-chart'
import { PriorityDistributionChart } from './charts/priority-distribution-chart'
import { CategoryPerformanceChart } from './charts/category-performance-chart'
import { TechnicianPerformanceChart } from './charts/technician-performance-chart'
import { DetailedTicketsTable } from './detailed-tickets-table'
import { DepartmentPerformanceTable } from './department-performance-table'
import { SLAMetricsCard } from './sla-metrics-card'

export default function ReportsPage() {
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'export' | 'data'>('dashboard')
  
  const {
    // Estados principales
    ticketReport,
    technicianReport,
    categoryReport,
    departmentReport,
    referenceData,
    
    // Estados de carga
    loading,
    loadingReports,
    error,
    
    // Estados de filtros
    filters,
    applyFilters,
    resetFilters,
    
    // Estados de UI
    exporting,
    exportingType,
    
    // Datos procesados
    stats,
    paginatedTickets,
    
    // Funciones principales
    loadReports,
    handleExport,
    refresh,
    
    // Estados de sesión
    isAuthenticated,
  } = useReports({
    cacheTTL: 5 * 60 * 1000,
    enableCache: true,
    autoRefresh: false,
    enablePagination: true,
    pageSize: 100,
  })

  // Función de exportación unificada
  const handleReportExport = useCallback((type: string, format: string = 'csv') => {
    return handleExport(type, format as 'csv' | 'excel' | 'pdf' | 'json')
  }, [handleExport])

  // Paginación para tablas de técnicos y categorías
  const [technicianPageSize, setTechnicianPageSize] = useState(10)
  const [categoryPageSize, setCategoryPageSize] = useState(10)
  
  const technicianPagination = useTablePagination(technicianReport, { pageSize: technicianPageSize })
  const categoryPagination = useTablePagination(categoryReport, { pageSize: categoryPageSize })

  // Renderizado de error de autenticación
  if (!isAuthenticated) {
    return null
  }

  const mainTabs = [
    { 
      id: 'dashboard', 
      label: 'Dashboard Ejecutivo', 
      icon: BarChart3,
      description: 'Métricas clave y análisis estratégico unificado'
    },
    { 
      id: 'data', 
      label: 'Datos Detallados', 
      icon: FileText,
      description: 'Exploración granular con exportación'
    },
    { 
      id: 'export', 
      label: 'Centro de Exportación', 
      icon: Download,
      description: 'Reportes multi-formato'
    },
  ]

  return (
    <ModuleLayout
      title='Centro de Reportes Ejecutivos'
      subtitle='Análisis avanzado, métricas de rendimiento y reportes del sistema'
      loading={loading}
      error={error}
      onRetry={refresh}
    >
      <div className='space-y-6'>
        <BackToTickets />
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className={`h-3 w-3 rounded-full ${loadingReports ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className="text-sm font-medium">
                    {loadingReports ? 'Actualizando datos...' : 'Datos actualizados'}
                  </span>
                </div>
                {stats.hasActiveFilters && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {stats.filterCount} filtros activos
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refresh()}
                        disabled={loadingReports}
                        className="bg-white"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loadingReports ? 'animate-spin' : ''}`} />
                        Actualizar
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Actualizar todos los reportes y métricas con los datos más recientes</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveView('export')}
                        className="bg-white text-green-700 border-green-200 hover:bg-green-50"
                        disabled={!ticketReport && technicianReport.length === 0 && categoryReport.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar Datos
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exportar reportes en formato CSV para análisis externo</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtros avanzados - Siempre visibles */}
        <ReportFilters
          filters={filters}
          onFiltersChange={applyFilters}
          onApplyFilters={() => loadReports(true)}
          onResetFilters={resetFilters}
          loading={loadingReports}
          referenceData={referenceData}
          hasActiveFilters={stats.hasActiveFilters}
          filterCount={stats.filterCount}
        />

        {/* KPI Metrics - Siempre visibles */}
        <ReportKPIMetrics stats={stats} loading={loadingReports} />

        {/* Centro de Análisis - Tabs principales sin anidamiento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings2 className="h-5 w-5" />
              <span>Centro de Análisis</span>
            </CardTitle>
            <CardDescription>
              Herramientas avanzadas para análisis ejecutivo y toma de decisiones estratégicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)} className="space-y-6">
              <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                {mainTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id} 
                      className="flex flex-col items-center space-y-1 p-3 h-auto"
                    >
                      <Icon className="h-5 w-5" />
                      <div className="text-center">
                        <div className="font-medium">{tab.label}</div>
                        <div className="text-xs text-muted-foreground hidden sm:block">
                          {tab.description}
                        </div>
                      </div>
                    </TabsTrigger>
                  )
                })}
              </TabsList>

              {/* Dashboard Ejecutivo Unificado */}
              <TabsContent value="dashboard" className="space-y-6">
                {/* Advertencias de volumen de datos */}
                {ticketReport?.metadata?.wasLimited && (
                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="py-4">
                      <div className="flex items-start space-x-3">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-yellow-800">Datos Limitados</h4>
                          <p className="text-sm text-yellow-700 mt-1">
                            Se muestran {ticketReport.metadata.returnedRecords} de {ticketReport.metadata.totalRecords} tickets totales. 
                            Use filtros más específicos para obtener datos más precisos.
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-xs text-yellow-600">
                            <span>• Límite aplicado: {ticketReport.metadata.limitApplied}</span>
                            <span>• Registros disponibles: {ticketReport.metadata.totalRecords - ticketReport.metadata.returnedRecords} más</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {loadingReports && !ticketReport && (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Cargando dashboard ejecutivo...</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {ticketReport ? (
                  <div className="space-y-6">
                    {/* Métricas SLA - Nueva sección */}
                    <SLAMetricsCard 
                      slaMetrics={ticketReport.slaMetrics}
                      loading={loadingReports}
                    />

                    {/* Gráficos principales unificados */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <TicketTrendsChart 
                        data={ticketReport.dailyTickets}
                        title="Análisis Predictivo de Tendencias"
                        description="Proyección estratégica de carga de trabajo y planificación de recursos"
                      />
                      <PriorityDistributionChart 
                        data={ticketReport.ticketsByPriority}
                        title="Matriz de Riesgo Operacional"
                        description="Análisis de criticidad para gestión estratégica de riesgos"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <CategoryPerformanceChart 
                        data={ticketReport.ticketsByCategory}
                        title="Eficiencia por Línea de Negocio"
                        description="Optimización de procesos y identificación de oportunidades"
                      />
                      {technicianReport.length > 0 && (
                        <TechnicianPerformanceChart 
                          data={technicianReport}
                          title="Análisis de Capacidad del Equipo"
                          description="Optimización de recursos humanos y distribución estratégica"
                        />
                      )}
                    </div>

                    {/* Insights ejecutivos mejorados */}
                    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          <span>Insights Ejecutivos Estratégicos</span>
                        </CardTitle>
                        <CardDescription>
                          Métricas clave para toma de decisiones y planificación estratégica
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-3xl font-bold text-blue-600 mb-2">
                              {((stats.resolvedTickets / Math.max(stats.totalTickets, 1)) * 100).toFixed(1)}%
                            </div>
                            <div className="text-sm font-medium text-blue-700">Eficiencia Global</div>
                            <div className="text-xs text-blue-600 mt-1">
                              {stats.resolvedTickets} de {stats.totalTickets} resueltos
                            </div>
                          </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-3xl font-bold text-green-600 mb-2">
                              {stats.activeTechnicians}
                            </div>
                            <div className="text-sm font-medium text-green-700">Técnicos Activos</div>
                            <div className="text-xs text-green-600 mt-1">
                              {stats.avgTechnicianResolutionRate}% eficiencia promedio
                            </div>
                          </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-3xl font-bold text-purple-600 mb-2">
                              {stats.avgResolutionTime}
                            </div>
                            <div className="text-sm font-medium text-purple-700">Tiempo Promedio</div>
                            <div className="text-xs text-purple-600 mt-1">
                              De resolución por ticket
                            </div>
                          </div>
                          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                            <div className="text-3xl font-bold text-orange-600 mb-2">
                              {stats.activeCategories}
                            </div>
                            <div className="text-sm font-medium text-orange-700">Áreas Activas</div>
                            <div className="text-xs text-orange-600 mt-1">
                              {stats.avgCategoryResolutionRate}% eficiencia promedio
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Análisis detallado por técnicos */}
                    {technicianReport.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Users className="h-5 w-5" />
                            <span>Análisis Individual de Rendimiento</span>
                          </CardTitle>
                          <CardDescription>
                            Métricas detalladas por técnico para evaluación de desempeño y planificación de recursos
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className='space-y-4'>
                            {technicianReport.slice(0, 5).map(tech => (
                              <div
                                key={tech.technicianId}
                                className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors'
                              >
                                <div className='flex items-center space-x-4'>
                                  <div className='h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold'>
                                    {tech.technicianName.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p className='font-medium text-lg'>{tech.technicianName}</p>
                                    <p className='text-sm text-muted-foreground'>
                                      {tech.resolved} resueltos de {tech.totalAssigned} asignados
                                    </p>
                                  </div>
                                </div>
                                <div className='flex items-center space-x-6'>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-green-600'>{tech.resolutionRate.toFixed(1)}%</p>
                                    <p className='text-xs text-muted-foreground'>Eficiencia</p>
                                  </div>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-purple-600'>{tech.avgResolutionTime}</p>
                                    <p className='text-xs text-muted-foreground'>Tiempo promedio</p>
                                  </div>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-orange-600'>{tech.inProgress}</p>
                                    <p className='text-xs text-muted-foreground'>En progreso</p>
                                  </div>
                                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    tech.workload === 'Baja' ? 'bg-green-100 text-green-800' :
                                    tech.workload === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                                    tech.workload === 'Alta' ? 'bg-orange-100 text-orange-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    Carga: {tech.workload}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {technicianReport.length > 5 && (
                              <div className="text-center py-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setActiveView('data')}
                                >
                                  Ver todos los técnicos ({technicianReport.length})
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Análisis detallado por categorías */}
                    {categoryReport.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Activity className="h-5 w-5" />
                            <span>Análisis por Líneas de Negocio</span>
                          </CardTitle>
                          <CardDescription>
                            Métricas de rendimiento y oportunidades de mejora por área estratégica
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className='space-y-4'>
                            {categoryReport.slice(0, 5).map(category => (
                              <div
                                key={category.categoryId}
                                className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors'
                              >
                                <div className='flex items-center space-x-4'>
                                  <div className='h-12 w-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold'>
                                    {category.categoryName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className='font-medium text-lg'>{category.categoryName}</p>
                                    <p className='text-sm text-muted-foreground'>
                                      {category.resolvedTickets} resueltos de {category.totalTickets} tickets
                                    </p>
                                  </div>
                                </div>
                                <div className='flex items-center space-x-6'>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-green-600'>{category.resolutionRate.toFixed(1)}%</p>
                                    <p className='text-xs text-muted-foreground'>Eficiencia</p>
                                  </div>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-purple-600'>{category.avgResolutionTime}</p>
                                    <p className='text-xs text-muted-foreground'>Tiempo promedio</p>
                                  </div>
                                  <div className='text-center'>
                                    <p className='text-lg font-bold text-blue-600'>{category.totalTickets}</p>
                                    <p className='text-xs text-muted-foreground'>Volumen total</p>
                                  </div>
                                  <div className='text-center min-w-[120px]'>
                                    <p className='text-sm font-medium text-orange-600'>
                                      {category.topTechnicians[0]?.name || 'Sin asignar'}
                                    </p>
                                    <p className='text-xs text-muted-foreground'>
                                      {category.topTechnicians[0] ? `${category.topTechnicians[0].resolved} resueltos` : 'Top especialista'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {categoryReport.length > 5 && (
                              <div className="text-center py-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setActiveView('data')}
                                >
                                  Ver todas las categorías ({categoryReport.length})
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                ) : !loadingReports ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
                      <h3 className="text-xl font-medium text-foreground mb-2">Error al cargar datos</h3>
                      <p className="text-muted-foreground text-center mb-6 max-w-md">
                        Hubo un problema al cargar los datos del dashboard. Intente recargar.
                      </p>
                      <Button onClick={() => loadReports(true)} disabled={loadingReports}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Reintentar
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              {/* Datos Detallados Unificados */}
              <TabsContent value="data" className="space-y-6">
                {/* Selector de tipo de datos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5" />
                      <span>Exploración de Datos</span>
                    </CardTitle>
                    <CardDescription>
                      Análisis granular con exportación de datos filtrados
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="tickets" className="space-y-4">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="tickets" className="flex items-center space-x-2">
                          <Ticket className="h-4 w-4" />
                          <span>Tickets Detallados</span>
                        </TabsTrigger>
                        <TabsTrigger value="technicians" className="flex items-center space-x-2">
                          <Users className="h-4 w-4" />
                          <span>Análisis de Técnicos</span>
                        </TabsTrigger>
                        <TabsTrigger value="categories" className="flex items-center space-x-2">
                          <Activity className="h-4 w-4" />
                          <span>Rendimiento por Categorías</span>
                        </TabsTrigger>
                        <TabsTrigger value="departments" className="flex items-center space-x-2">
                          <BarChart3 className="h-4 w-4" />
                          <span>Análisis de Departamentos</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* Tabla de Tickets Detallados */}
                      <TabsContent value="tickets" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Tickets con Información Completa</h4>
                            <p className="text-sm text-muted-foreground">
                              {ticketReport?.detailedTickets?.length || 0} tickets con datos completos
                            </p>
                          </div>
                        </div>
                        
                        {ticketReport?.detailedTickets && ticketReport.detailedTickets.length > 0 ? (
                          <DetailedTicketsTable 
                            tickets={paginatedTickets ? paginatedTickets.paginatedData as any : ticketReport.detailedTickets as any}
                          />
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-medium text-foreground mb-2">Sin tickets para mostrar</h3>
                              <p className="text-muted-foreground text-center">
                                Ajuste los filtros para ver tickets detallados
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      {/* Tabla de Técnicos Detallados */}
                      <TabsContent value="technicians" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Análisis Completo de Técnicos</h4>
                            <p className="text-sm text-muted-foreground">
                              {technicianReport.length} técnicos con métricas detalladas
                            </p>
                          </div>
                        </div>

                        {technicianReport.length > 0 ? (
                          <Card>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-muted/50">
                                    <tr className="border-b">
                                      <th className="text-left p-4 font-medium">Técnico</th>
                                      <th className="text-left p-4 font-medium">Departamento</th>
                                      <th className="text-center p-4 font-medium">Asignados</th>
                                      <th className="text-center p-4 font-medium">Resueltos</th>
                                      <th className="text-center p-4 font-medium">En Progreso</th>
                                      <th className="text-center p-4 font-medium">Eficiencia</th>
                                      <th className="text-center p-4 font-medium">Tiempo Promedio</th>
                                      <th className="text-center p-4 font-medium">SLA (%)</th>
                                      <th className="text-center p-4 font-medium">Carga</th>
                                      <th className="text-center p-4 font-medium">Calificación</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {technicianPagination.paginatedData.map((tech, index) => (
                                      <tr key={tech.technicianId} className={`border-b hover:bg-muted/30 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                        <td className="p-4">
                                          <div className="flex items-center space-x-3">
                                            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                              {tech.technicianName.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <p className="font-medium">{tech.technicianName}</p>
                                              <p className="text-xs text-muted-foreground">{tech.department || 'Sin departamento'}</p>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-4 text-sm">{tech.department || 'Sin departamento'}</td>
                                        <td className="p-4 text-center font-medium">{tech.totalAssigned}</td>
                                        <td className="p-4 text-center">
                                          <span className="text-green-600 font-medium">{tech.resolved}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                          <span className="text-orange-600 font-medium">{tech.inProgress}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                          <span className="text-blue-600 font-bold">{tech.resolutionRate.toFixed(1)}%</span>
                                        </td>
                                        <td className="p-4 text-center text-sm">{tech.avgResolutionTime}</td>
                                        <td className="p-4 text-center">
                                          {tech.slaMetrics?.totalWithSLA > 0 ? (
                                            <div className="text-center">
                                              <span className={`font-bold ${
                                                tech.slaMetrics.slaComplianceRate >= 95 ? 'text-green-600' :
                                                tech.slaMetrics.slaComplianceRate >= 85 ? 'text-yellow-600' :
                                                'text-red-600'
                                              }`}>
                                                {tech.slaMetrics.slaComplianceRate.toFixed(1)}%
                                              </span>
                                              <div className="text-xs text-muted-foreground">
                                                {tech.slaMetrics.slaCompliant}/{tech.slaMetrics.totalWithSLA}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">Sin SLA</span>
                                          )}
                                        </td>
                                        <td className="p-4 text-center">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            tech.workload === 'Baja' ? 'bg-green-100 text-green-800' :
                                            tech.workload === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                                            tech.workload === 'Alta' ? 'bg-orange-100 text-orange-800' :
                                            'bg-red-100 text-red-800'
                                          }`}>
                                            {tech.workload}
                                          </span>
                                        </td>
                                        <td className="p-4 text-center">
                                          {tech.averageRating ? (
                                            <span className="text-purple-600 font-medium">{tech.averageRating.toFixed(1)}/5</span>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">Sin calificar</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    
                                    {/* Fila de totales/promedios */}
                                    <tr className="bg-muted/50 font-semibold border-t-2">
                                      <td className="p-4">TOTALES / PROMEDIOS</td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">
                                        {technicianReport.reduce((sum, t) => sum + t.totalAssigned, 0)}
                                      </td>
                                      <td className="p-4 text-center">
                                        {technicianReport.reduce((sum, t) => sum + t.resolved, 0)}
                                      </td>
                                      <td className="p-4 text-center">
                                        {technicianReport.reduce((sum, t) => sum + t.inProgress, 0)}
                                      </td>
                                      <td className="p-4 text-center">
                                        {(technicianReport.reduce((sum, t) => sum + t.resolutionRate, 0) / technicianReport.length).toFixed(1)}%
                                      </td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">
                                        {(() => {
                                          const withSLA = technicianReport.filter(t => t.slaMetrics?.totalWithSLA > 0)
                                          if (withSLA.length === 0) return '-'
                                          const avgSLA = withSLA.reduce((sum, t) => sum + (t.slaMetrics?.slaComplianceRate || 0), 0) / withSLA.length
                                          return `${avgSLA.toFixed(1)}%`
                                        })()}
                                      </td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">
                                        {(() => {
                                          const withRating = technicianReport.filter(t => t.averageRating)
                                          if (withRating.length === 0) return '-'
                                          const avgRating = withRating.reduce((sum, t) => sum + (t.averageRating || 0), 0) / withRating.length
                                          return `${avgRating.toFixed(1)}/5`
                                        })()}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Paginación */}
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-muted-foreground">
                                    Mostrando {technicianPagination.startIndex} a {technicianPagination.endIndex} de {technicianPagination.totalItems} elementos
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={technicianPageSize}
                                    onChange={(e) => {
                                      setTechnicianPageSize(Number(e.target.value))
                                      technicianPagination.resetPage()
                                    }}
                                    className="px-3 py-1 border border-border rounded text-sm bg-background"
                                  >
                                    {[10, 20, 50, 100].map(option => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  
                                  <button
                                    onClick={technicianPagination.previousPage}
                                    disabled={!technicianPagination.hasPreviousPage}
                                    className={cn(
                                      "px-3 py-1 border border-border rounded text-sm transition-colors",
                                      !technicianPagination.hasPreviousPage
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-background hover:bg-muted"
                                    )}
                                  >
                                    Anterior
                                  </button>
                                  
                                  <span className="text-sm">
                                    Página {technicianPagination.currentPage} de {technicianPagination.totalPages}
                                  </span>
                                  
                                  <button
                                    onClick={technicianPagination.nextPage}
                                    disabled={!technicianPagination.hasNextPage}
                                    className={cn(
                                      "px-3 py-1 border border-border rounded text-sm transition-colors",
                                      !technicianPagination.hasNextPage
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-background hover:bg-muted"
                                    )}
                                  >
                                    Siguiente
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Users className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-medium text-foreground mb-2">Sin técnicos para mostrar</h3>
                              <p className="text-muted-foreground text-center">
                                Ajuste los filtros para ver técnicos
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      {/* Tabla de Categorías Detalladas */}
                      <TabsContent value="categories" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Análisis Completo por Categorías</h4>
                            <p className="text-sm text-muted-foreground">
                              {categoryReport.length} categorías con análisis detallado
                            </p>
                          </div>
                        </div>

                        {categoryReport.length > 0 ? (
                          <Card>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full">
                                  <thead className="bg-muted/50">
                                    <tr className="border-b">
                                      <th className="text-left p-4 font-medium">Categoría</th>
                                      <th className="text-left p-4 font-medium">Departamento</th>
                                      <th className="text-center p-4 font-medium">Total Tickets</th>
                                      <th className="text-center p-4 font-medium">Resueltos</th>
                                      <th className="text-center p-4 font-medium">Eficiencia</th>
                                      <th className="text-center p-4 font-medium">Tiempo Promedio</th>
                                      <th className="text-center p-4 font-medium">Prioridad Promedio</th>
                                      <th className="text-left p-4 font-medium">Top Técnico</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {categoryPagination.paginatedData.map((category, index) => (
                                      <tr key={category.categoryId} className={`border-b hover:bg-muted/30 ${index % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}>
                                        <td className="p-4">
                                          <div className="flex items-center space-x-3">
                                            <div className="h-8 w-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                              {category.categoryName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                            </div>
                                            <div>
                                              <p className="font-medium">{category.categoryName}</p>
                                              {category.description && (
                                                <p className="text-xs text-muted-foreground">{category.description.slice(0, 50)}...</p>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="p-4 text-sm">{category.department || 'Sin departamento'}</td>
                                        <td className="p-4 text-center font-medium">{category.totalTickets}</td>
                                        <td className="p-4 text-center">
                                          <span className="text-green-600 font-medium">{category.resolvedTickets}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                          <span className="text-blue-600 font-bold">{category.resolutionRate.toFixed(1)}%</span>
                                        </td>
                                        <td className="p-4 text-center text-sm">{category.avgResolutionTime}</td>
                                        <td className="p-4 text-center">
                                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            category.averagePriority === 'Baja' ? 'bg-green-100 text-green-800' :
                                            category.averagePriority === 'Media' ? 'bg-yellow-100 text-yellow-800' :
                                            category.averagePriority === 'Alta' ? 'bg-orange-100 text-orange-800' :
                                            category.averagePriority === 'Urgente' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {category.averagePriority}
                                          </span>
                                        </td>
                                        <td className="p-4">
                                          {category.topTechnicians[0] ? (
                                            <div>
                                              <p className="text-sm font-medium">{category.topTechnicians[0].name}</p>
                                              <p className="text-xs text-muted-foreground">{category.topTechnicians[0].resolved} resueltos</p>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-xs">Sin asignar</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                    
                                    {/* Fila de totales/promedios */}
                                    <tr className="bg-muted/50 font-semibold border-t-2">
                                      <td className="p-4">TOTALES / PROMEDIOS</td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">
                                        {categoryReport.reduce((sum, c) => sum + c.totalTickets, 0)}
                                      </td>
                                      <td className="p-4 text-center">
                                        {categoryReport.reduce((sum, c) => sum + c.resolvedTickets, 0)}
                                      </td>
                                      <td className="p-4 text-center">
                                        {(categoryReport.reduce((sum, c) => sum + c.resolutionRate, 0) / categoryReport.length).toFixed(1)}%
                                      </td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">-</td>
                                      <td className="p-4 text-center">-</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* Paginación */}
                              <div className="flex items-center justify-between mt-4">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm text-muted-foreground">
                                    Mostrando {categoryPagination.startIndex} a {categoryPagination.endIndex} de {categoryPagination.totalItems} elementos
                                  </span>
                                </div>
                                
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={categoryPageSize}
                                    onChange={(e) => {
                                      setCategoryPageSize(Number(e.target.value))
                                      categoryPagination.resetPage()
                                    }}
                                    className="px-3 py-1 border border-border rounded text-sm bg-background"
                                  >
                                    {[10, 20, 50, 100].map(option => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                  
                                  <button
                                    onClick={categoryPagination.previousPage}
                                    disabled={!categoryPagination.hasPreviousPage}
                                    className={cn(
                                      "px-3 py-1 border border-border rounded text-sm transition-colors",
                                      !categoryPagination.hasPreviousPage
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-background hover:bg-muted"
                                    )}
                                  >
                                    Anterior
                                  </button>
                                  
                                  <span className="text-sm">
                                    Página {categoryPagination.currentPage} de {categoryPagination.totalPages}
                                  </span>
                                  
                                  <button
                                    onClick={categoryPagination.nextPage}
                                    disabled={!categoryPagination.hasNextPage}
                                    className={cn(
                                      "px-3 py-1 border border-border rounded text-sm transition-colors",
                                      !categoryPagination.hasNextPage
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-background hover:bg-muted"
                                    )}
                                  >
                                    Siguiente
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-medium text-foreground mb-2">Sin categorías para mostrar</h3>
                              <p className="text-muted-foreground text-center">
                                Ajuste los filtros para ver categorías
                              </p>
                            </CardContent>
                          </Card>
                        )}
                      </TabsContent>

                      {/* Tabla de Departamentos Detallados */}
                      <TabsContent value="departments" className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">Análisis Completo por Departamentos</h4>
                            <p className="text-sm text-muted-foreground">
                              {departmentReport.length} departamentos con análisis detallado
                            </p>
                          </div>
                        </div>

                        <DepartmentPerformanceTable
                          departments={departmentReport}
                          loading={loadingReports}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Centro de Exportación Simplificado */}
              <TabsContent value="export" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Download className="h-5 w-5" />
                      <span>Centro de Exportación</span>
                    </CardTitle>
                    <CardDescription>
                      Descarga reportes con los filtros aplicados actualmente
                      {stats.hasActiveFilters && (
                        <span className="block mt-1 text-blue-600 font-medium">
                          ✓ {stats.filterCount} filtros activos serán aplicados a la exportación
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Exportación de Tickets */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                               onClick={() => handleReportExport('tickets', 'csv')}>
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Ticket className="h-6 w-6 text-blue-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">Reporte de Tickets</h4>
                                <p className="text-sm text-muted-foreground">
                                  {ticketReport?.totalTickets || 0} tickets con datos completos y métricas SLA
                                  {stats.hasActiveFilters && (
                                    <span className="text-blue-600 font-medium"> • Filtrado</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Exportar CSV</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Exporta todos los tickets con información detallada, métricas SLA y filtros aplicados</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Exportación de Técnicos */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                               onClick={() => handleReportExport('technicians', 'csv')}>
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <Users className="h-6 w-6 text-green-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">Reporte de Técnicos</h4>
                                <p className="text-sm text-muted-foreground">
                                  {technicianReport.length} técnicos con métricas completas y SLA
                                  {stats.hasActiveFilters && (
                                    <span className="text-blue-600 font-medium"> • Filtrado</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Exportar CSV</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Exporta el rendimiento de técnicos con métricas de productividad y cumplimiento SLA</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Exportación de Categorías */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                               onClick={() => handleReportExport('categories', 'csv')}>
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Activity className="h-6 w-6 text-purple-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">Reporte de Categorías</h4>
                                <p className="text-sm text-muted-foreground">
                                  {categoryReport.length} categorías con análisis detallado
                                  {stats.hasActiveFilters && (
                                    <span className="text-blue-600 font-medium"> • Filtrado</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Exportar CSV</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Exporta el análisis de categorías con distribución de tickets y tiempos de resolución</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Exportación de Departamentos */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                               onClick={() => handleReportExport('departments', 'csv')}>
                            <div className="flex items-center space-x-4">
                              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                <BarChart3 className="h-6 w-6 text-orange-600" />
                              </div>
                              <div>
                                <h4 className="font-medium">Reporte de Departamentos</h4>
                                <p className="text-sm text-muted-foreground">
                                  {departmentReport.length} departamentos con análisis detallado
                                  {stats.hasActiveFilters && (
                                    <span className="text-blue-600 font-medium"> • Filtrado</span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Download className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Exportar CSV</span>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Exporta el análisis de departamentos con métricas de rendimiento y cumplimiento SLA</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Advertencias de exportación */}
                    {(ticketReport?.metadata?.hasMoreRecords || technicianReport.length >= 1000 || categoryReport.length >= 500) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-900">
                            Advertencia de Volumen de Datos
                          </span>
                        </div>
                        <div className="text-xs text-amber-700 space-y-1">
                          {ticketReport?.metadata?.hasMoreRecords && (
                            <p>• Tickets: {ticketReport.metadata.totalRecords} registros totales, exportación limitada a {ticketReport.metadata.returnedRecords}</p>
                          )}
                          {technicianReport.length >= 1000 && (
                            <p>• Técnicos: Exportación limitada a 1000 registros</p>
                          )}
                          {categoryReport.length >= 500 && (
                            <p>• Categorías: Exportación limitada a 500 registros</p>
                          )}
                          <p className="font-medium">💡 Use filtros más específicos para obtener datos completos</p>
                        </div>
                      </div>
                    )}

                    {/* Información de filtros aplicados */}
                    {stats.hasActiveFilters && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Filter className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            Filtros aplicados en exportación
                          </span>
                        </div>
                        <p className="text-xs text-blue-700">
                          Los archivos exportados incluirán solo los datos que coincidan con los {stats.filterCount} filtros activos.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}