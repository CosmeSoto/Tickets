'use client'

import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { StatsCard, SymmetricStatsCard } from '@/components/shared/stats-card'
import { ActionCard, ActionGrid } from '@/components/common/action-card'
import { LoadingDashboard } from '@/components/shared/loading-dashboard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  RefreshCw,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { Notifications } from '@/components/ui/notifications'
import Link from 'next/link'
import { useClientProtection } from '@/hooks/use-role-protection'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { getPriorityColor, getStatusColor } from '@/lib/utils/ticket-utils'

export default function ClientDashboard() {
  // Protección de ruta y carga de datos usando hooks
  const { session, isAuthorized, isLoading: authLoading } = useClientProtection()
  const { stats, tickets: recentTickets, isLoading: dataLoading, error, refetch } = useDashboardData('CLIENT')

  // Mostrar loading mientras se verifica autenticación o se cargan datos
  if (authLoading || dataLoading) {
    return (
      <LoadingDashboard
        title='Dashboard Cliente'
        subtitle='Mi panel principal'
        message='Cargando tus tickets...'
      />
    )
  }

  // Si no está autorizado, el hook ya redirigió
  if (!isAuthorized) return null

  // Mostrar error si hay problemas cargando datos
  if (error) {
    return (
      <RoleDashboardLayout
        title={`¡Bienvenido, ${session?.user?.name}!`}
        subtitle='Panel de cliente'
      >
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Error al cargar datos: {error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  // Calcular métricas
  const supportQuality = stats.supportQuality || 'good'
  const hasOpenTickets = (stats.openTickets || 0) > 0
  const hasUnreadMessages = recentTickets.some(t => t.hasUnreadMessages)

  return (
    <RoleDashboardLayout
      title={`¡Bienvenido, ${session?.user?.name}!`}
      subtitle='Panel de cliente'
      headerActions={
        <div className="flex items-center space-x-3">
          <Badge 
            variant={supportQuality === 'excellent' ? 'default' : 'secondary'}
            className={supportQuality === 'excellent' ? 'bg-green-100 text-green-800' : ''}
          >
            Soporte: {supportQuality === 'excellent' ? 'Excelente' : 
                     supportQuality === 'good' ? 'Bueno' : 'Regular'}
          </Badge>
          <Link href='/client/tickets/create'>
            <Button size='lg' className='bg-primary hover:bg-primary/90'>
              <Plus className='h-5 w-5 mr-2' />
              Crear Ticket
            </Button>
          </Link>
        </div>
      }
    >
      {/* Alertas importantes */}
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

      {/* Notificaciones y Alertas Unificadas */}
      <Notifications variant="dashboard" className="mb-6" maxVisible={2} />

      {/* Stats Cards con Tema Cliente */}
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

      {/* Crear Ticket - Destacado y Mejorado */}
      <div className='mb-8'>
        <Card className='border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 hover:shadow-lg transition-all'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-4'>
                <div className='p-4 bg-primary rounded-xl shadow-lg'>
                  <Ticket className='h-8 w-8 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-2xl font-bold text-foreground'>¿Necesitas ayuda?</h3>
                  <p className='text-muted-foreground mt-1 max-w-md'>
                    Crea un nuevo ticket y nuestro equipo técnico especializado te ayudará lo antes posible
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Respuesta promedio: {stats.responseTime || '2h'}
                    </div>
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-1 text-yellow-500" />
                      Satisfacción: {stats.satisfactionRating || 4.5}/5
                    </div>
                  </div>
                </div>
              </div>
              <div className='flex space-x-3'>
                <Link href='/client/tickets'>
                  <Button variant='outline' size='lg' className="shadow-sm">
                    <Eye className='h-5 w-5 mr-2' />
                    Ver Mis Tickets
                  </Button>
                </Link>
                <Link href='/client/tickets/create'>
                  <Button size='lg' className='bg-primary hover:bg-primary/90 shadow-lg'>
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
        {/* Quick Actions Mejoradas */}
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
                    href: '/client/profile',
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

        {/* Recent Tickets Mejorados */}
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

      {/* Support Status Mejorado - Layout Vertical para evitar overflow */}
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
                  Actualizado: {new Date().toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Layout vertical en 2 columnas para evitar overflow */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='flex flex-col space-y-3 p-4 bg-green-50 dark:bg-green-950/50 rounded-lg border border-green-200 dark:border-green-800'>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <p className='text-sm font-semibold text-foreground'>Tiempo de Respuesta</p>
                  </div>
                  <Badge variant='default' className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs'>
                    ✓ Excelente
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className='text-lg font-bold text-green-700 dark:text-green-300'>{stats.responseTime || '2h'}</p>
                  <p className='text-xs text-muted-foreground'>Promedio de respuesta inicial</p>
                </div>
              </div>
              
              <div className='flex flex-col space-y-3 p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800'>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <p className='text-sm font-semibold text-foreground'>Disponibilidad del Sistema</p>
                  </div>
                  <Badge variant='default' className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs'>
                    ✓ 99.9%
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
                    Lun - Vie
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className='text-lg font-bold text-purple-700 dark:text-purple-300'>8:00 - 18:00</p>
                  <p className='text-xs text-muted-foreground'>Atención personalizada</p>
                </div>
              </div>
              
              <div className='flex flex-col space-y-3 p-4 bg-yellow-50 dark:bg-yellow-950/50 rounded-lg border border-yellow-200 dark:border-yellow-800'>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="h-4 w-4 text-yellow-600 fill-current" />
                    <p className='text-sm font-semibold text-foreground'>Satisfacción del Cliente</p>
                  </div>
                  <Badge variant='default' className='bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs'>
                    {Math.floor((stats.satisfactionRating || 4.5) * 20)}%
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className='text-lg font-bold text-yellow-700 dark:text-yellow-300'>{stats.satisfactionRating || 4.5}/5</p>
                  <p className='text-xs text-muted-foreground'>Calidad del servicio</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
