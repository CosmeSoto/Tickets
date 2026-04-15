'use client'

import { UnifiedDashboardBase } from '@/components/dashboard/unified-dashboard-base'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { ActionGrid } from '@/components/common/action-card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Ticket,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Bell,
  Settings,
  HelpCircle,
  Star,
  Activity,
  Calendar,
  Eye,
  Plus,
  MessageSquare,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard'
import { getPriorityColor, getStatusColor } from '@/lib/utils/ticket-utils'
import { useEffect, useState } from 'react'
import { AssignedFamiliesPanel } from '@/components/dashboard/assigned-families-panel'

interface SystemMetrics {
  responseTime: string
  responseStatus: string
  uptime: number
  uptimeStatus: string
  schedule: {
    days: string
    hours: string
    timezone: string
  }
  satisfaction: {
    rating: number
    percentage: number
    totalRatings: number
    status: string
  }
  lastUpdated: string
}

export default function ClientDashboard() {
  const {
    userName,
    isLoading,
    isAuthorized,
    error,
    stats,
    tickets: recentTickets,
    refetch
  } = useUnifiedDashboard({ role: 'CLIENT' })

  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)

  // Cargar métricas del sistema
  useEffect(() => {
    const fetchSystemMetrics = async () => {
      try {
        const response = await fetch('/api/system/metrics')
        if (response.ok) {
          const data = await response.json()
          setSystemMetrics(data)
        }
      } catch (error) {
        console.error('Error loading system metrics:', error)
      }
    }

    fetchSystemMetrics()
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchSystemMetrics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Calcular métricas
  const supportQuality = stats.supportQuality || 'good'
  const hasOpenTickets = (stats.openTickets || 0) > 0
  const hasUnreadMessages = recentTickets.some(t => t.hasUnreadMessages)

  return (
    <UnifiedDashboardBase
      userName={userName}
      userRole="CLIENT"
      isLoading={isLoading}
      isAuthorized={isAuthorized}
      error={error}
      title="Mi Panel"
      subtitle={hasOpenTickets ? `Tienes ${stats.openTickets} ticket${stats.openTickets > 1 ? 's' : ''} abierto${stats.openTickets > 1 ? 's' : ''}` : 'Todo al día'}
      loadingMessage="Cargando tus tickets..."
      onRefresh={refetch}
      notificationsMaxVisible={2}
      statusBadge={{
        text: `Soporte: ${supportQuality === 'excellent' ? 'Excelente' : 
                         supportQuality === 'good' ? 'Bueno' : 'Regular'}`,
        variant: supportQuality === 'excellent' ? 'default' : 'secondary',
        className: supportQuality === 'excellent' ? 'bg-green-100 text-green-800' : ''
      }}
    >
      {/* Alerta de mensajes sin leer */}
      {hasUnreadMessages && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Bell className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <strong>Nuevas respuestas:</strong> Tienes mensajes sin leer en tus tickets. 
            <Link href="/client/tickets" className="ml-2 underline font-medium">
              Ver tickets
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        <SymmetricStatsCard
          title='Total Tickets'
          value={stats.totalTickets || 0}
          icon={Ticket}
          color='blue'
          role='CLIENT'
          trend={{ 
            value: stats.thisMonthTickets || 0, 
            label: 'este mes', 
            isPositive: true 
          }}
        />

        <SymmetricStatsCard
          title='Tickets Abiertos'
          value={stats.openTickets || 0}
          icon={AlertCircle}
          color='orange'
          role='CLIENT'
          status={hasOpenTickets ? 'warning' : 'normal'}
        />

        <SymmetricStatsCard
          title='Tickets Resueltos'
          value={stats.resolvedTickets || 0}
          icon={CheckCircle}
          color='green'
          role='CLIENT'
          status='success'
        />

        <SymmetricStatsCard
          title='Mi Satisfacción'
          value={`${stats.satisfactionRating || 0}/5`}
          icon={Star}
          color='purple'
          role='CLIENT'
          status={(stats.satisfactionRating || 0) >= 4.5 ? 'success' : (stats.satisfactionRating || 0) >= 4 ? 'normal' : 'warning'}
          badge={{ 
            text: `${Math.floor((stats.satisfactionRating || 0) * 20)}%`,
            variant: 'default'
          }}
        />
      </div>

      {/* Stats de equipos — solo si tiene equipos asignados */}
      {(stats.assignedEquipment || 0) > 0 && (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-8'>
          <SymmetricStatsCard
            title='Equipos Asignados'
            value={stats.assignedEquipment || 0}
            icon={Activity}
            color='blue'
            role='CLIENT'
            badge={{ text: 'A tu cargo', variant: 'secondary' }}
          />
          <SymmetricStatsCard
            title='Mantenimientos Pendientes'
            value={stats.pendingMaintenance || 0}
            icon={Calendar}
            color='orange'
            role='CLIENT'
            status={(stats.pendingMaintenance || 0) > 0 ? 'warning' : 'normal'}
            badge={{ text: 'Tus equipos', variant: 'default' }}
          />
        </div>
      )}

      {/* Familias asignadas */}
      {(stats.assignedFamilies?.length > 0 || stats.inventoryFamilies?.length > 0) && (
        <div className='mb-8'>
          <AssignedFamiliesPanel
            families={stats.assignedFamilies ?? []}
            inventoryFamilies={stats.inventoryFamilies}
            isInventoryManager={stats.isInventoryManager}
            role="CLIENT"
          />
        </div>
      )}

      {/* Crear Ticket - Destacado */}
      <div className='mb-8'>
        <Card className='border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 hover:shadow-lg transition-all'>
          <CardContent className='p-6'>
            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
              <div className='flex items-start sm:items-center space-x-4'>
                <div className='p-4 bg-primary rounded-xl shadow-lg flex-shrink-0'>
                  <Ticket className='h-8 w-8 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-xl sm:text-2xl font-bold text-foreground'>¿Necesitas ayuda?</h3>
                  <p className='text-muted-foreground mt-1 max-w-md text-sm'>
                    Crea un nuevo ticket y nuestro equipo técnico especializado te ayudará lo antes posible
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Respuesta: {stats.responseTime || '2h'}
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-yellow-500" />
                      {stats.satisfactionRating || 4.5}/5
                    </div>
                  </div>
                </div>
              </div>
              <div className='flex flex-col sm:flex-row gap-2 sm:gap-3'>
                <Link href='/client/tickets'>
                  <Button variant='outline' size='lg' className="shadow-sm w-full sm:w-auto">
                    <Eye className='h-5 w-5 mr-2' />
                    Ver Mis Tickets
                  </Button>
                </Link>
                <Link href='/client/tickets/create'>
                  <Button size='lg' className='bg-primary hover:bg-primary/90 shadow-lg w-full sm:w-auto'>
                    <Plus className='h-5 w-5 mr-2' />
                    Crear Ticket
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Quick Actions */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <Zap className='h-5 w-5 mr-2 text-primary' />
                  Acceso Rápido
                </div>
                <Badge variant="outline" className="text-xs">
                  Servicios Disponibles
                </Badge>
              </CardTitle>
              <CardDescription>Accede a las funciones principales y servicios de soporte</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionGrid
                role="CLIENT"
                columns={2}
                actions={[
                  {
                    href: '/profile',
                    icon: User,
                    title: 'Mi Perfil',
                    description: 'Gestionar información personal y preferencias',
                    color: 'primary'
                  },
                  {
                    href: '/client/notifications',
                    icon: Bell,
                    title: 'Notificaciones',
                    description: 'Ver actualizaciones y alertas importantes',
                    color: 'green',
                    badge: hasUnreadMessages ? 'Nuevas' : undefined
                  },
                  {
                    href: '/settings',
                    icon: Settings,
                    title: 'Configuración',
                    description: 'Preferencias de cuenta y privacidad',
                    color: 'purple'
                  },
                  {
                    href: '/client/help',
                    icon: HelpCircle,
                    title: 'Centro de Ayuda',
                    description: 'FAQ, guías y soporte adicional',
                    color: 'orange'
                  }
                ]}
              />
            </CardContent>
          </Card>
        </div>

        {/* Recent Tickets */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <Ticket className='h-5 w-5 mr-2 text-green-600 dark:text-green-400' />
                  Tickets Recientes
                </div>
                <Button variant='ghost' size='sm' asChild>
                  <Link href="/client/tickets">
                    <Eye className='h-4 w-4' />
                  </Link>
                </Button>
              </CardTitle>
              <CardDescription>
                Tus últimos tickets • {recentTickets.length} de {stats.totalTickets || 0} tickets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {recentTickets.length === 0 ? (
                  <div className='text-center py-8'>
                    <Ticket className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                    <p className='text-sm text-muted-foreground mb-3'>No tienes tickets aún</p>
                    <Button size="sm" asChild>
                      <Link href="/client/tickets/create">
                        <Plus className="h-4 w-4 mr-2" />
                        Crear tu primer ticket
                      </Link>
                    </Button>
                  </div>
                ) : (
                  recentTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className={`p-4 border rounded-lg hover:shadow-sm transition-all cursor-pointer ${
                        ticket.hasUnreadMessages ? 'border-blue-200 bg-blue-50/50' : 'border-border'
                      }`}
                    >
                      <div className='flex items-start justify-between mb-2'>
                        <h4 className='text-sm font-semibold text-foreground line-clamp-1 flex-1'>
                          {ticket.title}
                        </h4>
                        {ticket.hasUnreadMessages && (
                          <div className='w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 ml-2 mt-1'></div>
                        )}
                      </div>
                      
                      {ticket.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {ticket.description}
                        </p>
                      )}
                      
                      <div className='flex items-center space-x-2 mb-3'>
                        <Badge className={getPriorityColor(ticket.priority)} variant='secondary'>
                          {ticket.priority}
                        </Badge>
                        <Badge className={getStatusColor(ticket.status)} variant='secondary'>
                          {ticket.status}
                        </Badge>
                        {ticket.isOverdue && (
                          <Badge variant="destructive" className="text-xs">
                            Atención
                          </Badge>
                        )}
                      </div>
                      
                      <div className='flex items-center justify-between text-xs text-muted-foreground'>
                        <div className="flex items-center space-x-3">
                          <span className='flex items-center'>
                            <Calendar className='h-3 w-3 mr-1' />
                            {new Date(ticket.createdAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                          {ticket.assignee && (
                            <span className='flex items-center'>
                              <User className='h-3 w-3 mr-1' />
                              {ticket.assignee}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {ticket.hasUnreadMessages && (
                            <MessageSquare className="h-3 w-3 text-blue-500" />
                          )}
                          <span>{ticket.commentCount || 0} comentarios</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Support Status */}
      <div className='mt-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Activity className='h-5 w-5 mr-2 text-green-600 dark:text-green-400' />
                Estado del Soporte Técnico
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Actualizado: {systemMetrics ? new Date(systemMetrics.lastUpdated).toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  }) : new Date().toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!systemMetrics ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando métricas del sistema...
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='flex flex-col space-y-3 p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800'>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <p className='text-sm font-semibold text-foreground'>Tiempo de Respuesta</p>
                    </div>
                    <Badge variant='default' className={`text-xs ${
                      systemMetrics.responseStatus === 'excellent' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : systemMetrics.responseStatus === 'good'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {systemMetrics.responseStatus === 'excellent' ? '✓ Excelente' : 
                       systemMetrics.responseStatus === 'good' ? '✓ Bueno' : '⚠ Mejorable'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className='text-lg font-bold text-green-700 dark:text-green-300'>{systemMetrics.responseTime}</p>
                    <p className='text-xs text-muted-foreground'>Promedio de respuesta inicial</p>
                  </div>
                </div>
                
                <div className='flex flex-col space-y-3 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800'>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <p className='text-sm font-semibold text-foreground'>Disponibilidad del Sistema</p>
                    </div>
                    <Badge variant='default' className={`text-xs ${
                      systemMetrics.uptimeStatus === 'excellent'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : systemMetrics.uptimeStatus === 'good'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      ✓ {systemMetrics.uptime}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className='text-lg font-bold text-blue-700 dark:text-blue-300'>24/7</p>
                    <p className='text-xs text-muted-foreground'>Sistema operativo continuamente</p>
                  </div>
                </div>
                
                <div className='flex flex-col space-y-3 p-4 bg-purple-50 dark:bg-purple-950/50 rounded-lg border border-purple-200 dark:border-purple-800'>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-purple-600" />
                      <p className='text-sm font-semibold text-foreground'>Horario de Soporte</p>
                    </div>
                    <Badge variant='default' className='bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs'>
                      {systemMetrics.schedule.days}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className='text-lg font-bold text-purple-700 dark:text-purple-300'>{systemMetrics.schedule.hours}</p>
                    <p className='text-xs text-muted-foreground'>Atención personalizada</p>
                  </div>
                </div>
                
                <div className='flex flex-col space-y-3 p-4 bg-yellow-50 dark:bg-yellow-950/50 rounded-lg border border-yellow-200 dark:border-yellow-800'>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Star className="h-4 w-4 text-yellow-600 fill-current" />
                      <p className='text-sm font-semibold text-foreground'>Satisfacción del Cliente</p>
                    </div>
                    <Badge variant='default' className={`text-xs ${
                      systemMetrics.satisfaction.status === 'excellent'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : systemMetrics.satisfaction.status === 'good'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                    }`}>
                      {systemMetrics.satisfaction.percentage}%
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className='text-lg font-bold text-yellow-700 dark:text-yellow-300'>
                      {systemMetrics.satisfaction.rating > 0 ? systemMetrics.satisfaction.rating.toFixed(1) : 'N/A'}/5
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {systemMetrics.satisfaction.totalRatings > 0 
                        ? `Basado en ${systemMetrics.satisfaction.totalRatings} calificaciones`
                        : 'Sin calificaciones aún'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedDashboardBase>
  )
}
