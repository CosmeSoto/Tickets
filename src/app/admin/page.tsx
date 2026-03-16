'use client'

import { UnifiedDashboardBase } from '@/components/dashboard/unified-dashboard-base'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { ActionCard } from '@/components/common/action-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'
import {
  Users,
  Ticket,
  CheckCircle,
  AlertCircle,
  BarChart3,
  FileText,
  Activity,
  UserPlus,
  TicketPlus,
  Eye,
  Zap,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard'
import { useSystemStatus } from '@/hooks/use-system-status'

export default function AdminDashboard() {
  const {
    userName,
    isLoading: dashboardLoading,
    isAuthorized,
    error: dashboardError,
    stats,
    recentActivity,
    refetch: refetchDashboard
  } = useUnifiedDashboard({ role: 'ADMIN' })

  const { 
    systemStatus, 
    isLoading: systemLoading, 
    error: systemError, 
    refetch: refetchSystem 
  } = useSystemStatus()

  // Combinar estados de carga
  const isLoading = dashboardLoading || systemLoading
  const error = dashboardError || systemError

  // Función de refresh combinada
  const handleRefresh = () => {
    refetchDashboard()
    refetchSystem()
  }

  // Calcular métricas
  const resolutionRate = stats.resolutionRate || 0
  const systemHealth = stats.systemHealth || 'good'

  return (
    <UnifiedDashboardBase
      userName={userName}
      userRole="ADMIN"
      isLoading={isLoading}
      isAuthorized={isAuthorized}
      error={error}
      title="Dashboard Administrativo"
      subtitle="Vista general del sistema de tickets"
      loadingMessage="Cargando estadísticas del sistema..."
      onRefresh={handleRefresh}
      notificationsMaxVisible={3}
      statusBadge={{
        text: `Sistema: ${systemHealth === 'excellent' ? 'Excelente' : 'Normal'}`,
        variant: systemHealth === 'excellent' ? 'default' : 'secondary',
        className: systemHealth === 'excellent' ? 'bg-green-100 text-green-800' : ''
      }}
    >
      {/* Error adicional de sistema */}
      {systemError && !dashboardError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Error al cargar estado del sistema: {systemError}</span>
            <Button variant="outline" size="sm" onClick={refetchSystem}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar Sistema
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <SymmetricStatsCard
          title='Total Usuarios'
          value={stats.totalUsers || 0}
          icon={Users}
          color='blue'
          badge={{ text: `${stats.todayTickets || 0} nuevos hoy`, variant: 'secondary' }}
          status='success'
        />

        <SymmetricStatsCard
          title='Total Tickets'
          value={stats.totalTickets || 0}
          icon={Ticket}
          color='green'
          badge={{ text: `${stats.activeTickets || 0} activos`, variant: 'default' }}
        />

        <SymmetricStatsCard
          title='Tickets Abiertos'
          value={stats.openTickets || 0}
          icon={AlertCircle}
          color='orange'
          status={stats.openTickets && stats.openTickets > 20 ? 'warning' : 'normal'}
          badge={{ 
            text: `${stats.urgentTickets || 0} urgentes`, 
            variant: stats.urgentTickets && stats.urgentTickets > 0 ? 'destructive' : 'default' 
          }}
        />

        <SymmetricStatsCard
          title='Tasa de Resolución'
          value={`${resolutionRate}%`}
          icon={CheckCircle}
          color='purple'
          status={resolutionRate >= 85 ? 'success' : resolutionRate >= 70 ? 'warning' : 'error'}
        />
      </div>

      {/* Métricas de Planes de Resolución */}
      {stats.resolutionPlans && stats.resolutionPlans.total > 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
          <SymmetricStatsCard
            title='Planes Creados'
            value={stats.resolutionPlans.total}
            icon={FileText}
            color='blue'
            badge={{ text: 'Total', variant: 'secondary' }}
          />

          <SymmetricStatsCard
            title='Tiempo Estimado Promedio'
            value={`${stats.resolutionPlans.avgEstimatedHours}h`}
            icon={Calendar}
            color='green'
            badge={{ text: 'Planificado', variant: 'default' }}
          />

          <SymmetricStatsCard
            title='Tiempo Real Promedio'
            value={`${stats.resolutionPlans.avgActualHours}h`}
            icon={Clock}
            color='orange'
            badge={{ text: 'Ejecutado', variant: 'default' }}
          />

          <SymmetricStatsCard
            title='Eficiencia de Planes'
            value={`${stats.resolutionPlans.efficiency}%`}
            icon={Activity}
            color='purple'
            status={stats.resolutionPlans.efficiency >= 90 ? 'success' : stats.resolutionPlans.efficiency >= 70 ? 'normal' : 'warning'}
            badge={{ 
              text: `${stats.resolutionPlans.taskCompletionRate}% tareas`, 
              variant: 'default' 
            }}
          />
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Quick Actions */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <Zap className='h-5 w-5 mr-2 text-blue-600' />
                  Acciones Rápidas
                </div>
                <Badge variant="outline" className="text-xs">
                  Gestión del Sistema
                </Badge>
              </CardTitle>
              <CardDescription>Administra los aspectos principales del sistema de tickets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <ActionCard
                  href='/admin/users'
                  icon={Users}
                  title='Gestión de Usuarios'
                  description='Administrar usuarios y roles del sistema'
                  color='blue'
                  badge={stats.totalUsers}
                />

                <ActionCard
                  href='/admin/tickets'
                  icon={Ticket}
                  title='Gestión de Tickets'
                  description='Ver, asignar y gestionar tickets'
                  color='green'
                  badge={stats.activeTickets}
                />

                <ActionCard
                  href='/admin/reports'
                  icon={BarChart3}
                  title='Reportes y Análisis'
                  description='Estadísticas detalladas y métricas'
                  color='purple'
                />

                <ActionCard
                  href='/admin/categories'
                  icon={FileText}
                  title='Categorías y Departamentos'
                  description='Organizar tipos de tickets y áreas'
                  color='orange'
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <Activity className='h-5 w-5 mr-2 text-green-600' />
                  Actividad Reciente
                </div>
                <Button variant='ghost' size='sm' asChild>
                  <Link href="/admin/reports?view=activity">
                    <Eye className='h-4 w-4' />
                  </Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map(activity => (
                    <div key={activity.id} className='flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors'>
                      <div className='flex-shrink-0'>
                        {activity.type === 'ticket_created' && (
                          <div className='p-1.5 bg-blue-100 rounded-full'>
                            <TicketPlus className='h-3 w-3 text-blue-600' />
                          </div>
                        )}
                        {activity.type === 'ticket_resolved' && (
                          <div className='p-1.5 bg-green-100 rounded-full'>
                            <CheckCircle className='h-3 w-3 text-green-600' />
                          </div>
                        )}
                        {activity.type === 'user_created' && (
                          <div className='p-1.5 bg-purple-100 rounded-full'>
                            <UserPlus className='h-3 w-3 text-purple-600' />
                          </div>
                        )}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <p className='text-sm font-medium text-foreground line-clamp-1'>{activity.title}</p>
                        <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>{activity.description}</p>
                        <div className='flex items-center justify-between mt-2'>
                          <span className='text-xs font-medium text-muted-foreground'>{activity.user}</span>
                          <span className='text-xs text-muted-foreground'>{activity.time}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Status */}
      <div className='mt-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Activity className='h-5 w-5 mr-2 text-green-600' />
                Estado del Sistema
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Actualizado: {systemStatus ? new Date(systemStatus.lastUpdated).toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) : '--:--'}
                </span>
                <Button variant="outline" size="sm" onClick={refetchSystem}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {systemStatus ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                {/* Base de Datos */}
                <div className={`flex flex-col p-4 rounded-lg border ${
                  systemStatus.database.status === 'active' 
                    ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className='text-sm font-semibold text-foreground'>Base de Datos</p>
                    <Badge variant='default' className={`text-xs ${
                      systemStatus.database.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {systemStatus.database.status === 'active' ? '✓ Activo' : '✗ Error'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>{systemStatus.database.type}</p>
                  {systemStatus.database.connections ? (
                    <p className='text-xs text-muted-foreground'>
                      Conexiones: {systemStatus.database.connections.active}/{systemStatus.database.connections.max}
                    </p>
                  ) : (
                    <p className='text-xs text-red-500'>{systemStatus.database.error}</p>
                  )}
                  {systemStatus.database.responseTime && (
                    <p className='text-xs text-muted-foreground'>Respuesta: {systemStatus.database.responseTime}</p>
                  )}
                </div>
                
                {/* Cache */}
                <div className={`flex flex-col p-4 rounded-lg border ${
                  systemStatus.cache.status === 'active' 
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
                    : 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className='text-sm font-semibold text-foreground'>Cache</p>
                    <Badge variant='default' className={`text-xs ${
                      systemStatus.cache.status === 'active'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {systemStatus.cache.status === 'active' ? '✓ Activo' : '? Desconocido'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>{systemStatus.cache.type}</p>
                  {systemStatus.cache.usage ? (
                    <p className='text-xs text-muted-foreground'>
                      {systemStatus.cache.usage.percentage}% uso
                    </p>
                  ) : (
                    <p className='text-xs text-yellow-600'>Estado desconocido</p>
                  )}
                  {systemStatus.cache.hitRate && (
                    <p className='text-xs text-muted-foreground'>Hit rate: {systemStatus.cache.hitRate}%</p>
                  )}
                </div>
                
                {/* Email Service */}
                <div className={`flex flex-col p-4 rounded-lg border ${
                  systemStatus.email.status === 'active' 
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
                    : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className='text-sm font-semibold text-foreground'>Email Service</p>
                    <Badge variant='default' className={`text-xs ${
                      systemStatus.email.status === 'active'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {systemStatus.email.status === 'active' ? '✓ Activo' : '✗ Error'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>{systemStatus.email.type}</p>
                  {systemStatus.email.emailsSent ? (
                    <p className='text-xs text-muted-foreground'>
                      {systemStatus.email.emailsSent.today} enviados hoy
                    </p>
                  ) : (
                    <p className='text-xs text-red-500'>{systemStatus.email.error}</p>
                  )}
                  {systemStatus.email.queue !== undefined && (
                    <p className='text-xs text-muted-foreground'>Cola: {systemStatus.email.queue}</p>
                  )}
                </div>
                
                {/* Backup */}
                <div className={`flex flex-col p-4 rounded-lg border ${
                  systemStatus.backup.status === 'scheduled' 
                    ? 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800'
                    : systemStatus.backup.status === 'overdue'
                    ? 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800'
                    : 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className='text-sm font-semibold text-foreground'>Backup</p>
                    <Badge variant='default' className={`text-xs ${
                      systemStatus.backup.status === 'scheduled'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : systemStatus.backup.status === 'overdue'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {systemStatus.backup.status === 'scheduled' ? '✓ Programado' : 
                       systemStatus.backup.status === 'overdue' ? '⚠ Atrasado' : '✗ Error'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>{systemStatus.backup.type}</p>
                  {systemStatus.backup.lastBackup ? (
                    <p className='text-xs text-muted-foreground'>
                      Último: {systemStatus.backup.lastBackup.timeAgo}
                    </p>
                  ) : (
                    <p className='text-xs text-red-500'>{systemStatus.backup.error}</p>
                  )}
                  {systemStatus.backup.lastBackup?.size && (
                    <p className='text-xs text-muted-foreground'>Tamaño: {systemStatus.backup.lastBackup.size}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-sm text-muted-foreground">Cargando estado del sistema...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedDashboardBase>
  )
}
