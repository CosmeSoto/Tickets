'use client'

import { UnifiedDashboardBase } from '@/components/dashboard/unified-dashboard-base'
import { TicketsStatsSection } from '@/components/dashboard/modules/tickets-stats-section'
import { InventoryStatsSection } from '@/components/dashboard/modules/inventory-stats-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Ticket,
  Clock,
  FileText,
  Target,
  Zap,
  TrendingUp,
  Star,
  AlertCircle,
  Layers,
  User,
  MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { useUnifiedDashboard } from '@/hooks/use-unified-dashboard'
import { getPriorityColor, getStatusColor } from '@/lib/utils/ticket-utils'
import { AssignedFamiliesPanel } from '@/components/dashboard/assigned-families-panel'

export default function TechnicianDashboard() {
  const {
    userName,
    isLoading,
    isAuthorized,
    error,
    stats,
    tickets: recentTickets,
    refetch,
  } = useUnifiedDashboard({ role: 'TECHNICIAN' })

  const performanceLevel = stats.performance || 'good'
  const urgentTickets = recentTickets.filter(
    t => t.priority === 'HIGH' || t.urgencyLevel === 'critical'
  ).length
  const overdueTickets = recentTickets.filter(t => t.isOverdue).length

  return (
    <UnifiedDashboardBase
      userName={userName}
      userRole='TECHNICIAN'
      isLoading={isLoading}
      isAuthorized={isAuthorized}
      error={error}
      title='Dashboard Técnico'
      subtitle={`${urgentTickets > 0 ? `${urgentTickets} urgentes · ` : ''}${overdueTickets > 0 ? `${overdueTickets} vencidos · ` : ''}${stats.assignedTickets || 0} tickets asignados`}
      loadingMessage='Cargando tus tickets asignados...'
      onRefresh={refetch}
      notificationsMaxVisible={2}
      statusBadge={{
        text: `Rendimiento: ${performanceLevel === 'excellent' ? 'Excelente' : performanceLevel === 'good' ? 'Bueno' : 'Mejorable'}`,
        variant: performanceLevel === 'excellent' ? 'default' : 'secondary',
        className: performanceLevel === 'excellent' ? 'bg-green-100 text-green-800' : '',
      }}
    >
      {/* 1. Contexto del usuario — familias de trabajo */}
      {(stats.assignedFamilies?.length > 0 || stats.inventoryFamilies?.length > 0) && (
        <div className='mb-8'>
          <AssignedFamiliesPanel
            families={stats.assignedFamilies ?? []}
            inventoryFamilies={stats.inventoryFamilies}
            isInventoryManager={stats.isInventoryManager}
            role='TECHNICIAN'
          />
        </div>
      )}

      {/* 2. Módulo Tickets */}
      <TicketsStatsSection stats={stats} role='TECHNICIAN' />

      {/* 3. Módulo Inventario (autocontenido, aparece solo si es gestor) */}
      <InventoryStatsSection role='TECHNICIAN' />

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Tickets Asignados */}
        <div className='lg:col-span-2'>
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center justify-between'>
                <div className='flex items-center'>
                  <Ticket className='h-5 w-5 mr-2 text-blue-600' />
                  Mis Tickets Asignados
                </div>
                <div className='flex items-center space-x-2'>
                  {urgentTickets > 0 && (
                    <Badge variant='destructive' className='text-xs'>
                      {urgentTickets} urgentes
                    </Badge>
                  )}
                  <Button variant='outline' size='sm' asChild>
                    <Link href='/technician/tickets'>Ver Todos</Link>
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {recentTickets.length > 0 ? (
                  recentTickets.map(ticket => (
                    <div
                      key={ticket.id}
                      className={`flex flex-col p-4 border rounded-lg hover:shadow-sm transition-all ${
                        ticket.urgencyLevel === 'critical'
                          ? 'border-red-200 bg-red-50/50'
                          : ticket.urgencyLevel === 'high'
                            ? 'border-orange-200 bg-orange-50/50'
                            : 'border-border hover:border-primary/20'
                      }`}
                    >
                      <div className='flex-1'>
                        <div className='flex flex-wrap items-center gap-2 mb-2'>
                          <h3 className='font-semibold text-foreground line-clamp-1 flex-1 min-w-0'>
                            {ticket.title}
                          </h3>
                          <div className='flex flex-wrap gap-1'>
                            <Badge className={getPriorityColor(ticket.priority)} variant='secondary'>
                              {ticket.priority}
                            </Badge>
                            <Badge className={getStatusColor(ticket.status)} variant='secondary'>
                              {ticket.status}
                            </Badge>
                            {ticket.isOverdue && (
                              <Badge variant='destructive' className='text-xs'>
                                Vencido
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className='flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2'>
                          <div className='flex items-center'>
                            <User className='h-4 w-4 mr-1' />
                            {ticket.client}
                          </div>
                          <div className='flex items-center'>
                            <FileText className='h-4 w-4 mr-1' />
                            {ticket.category}
                          </div>
                          <div className='flex items-center'>
                            <Clock className='h-4 w-4 mr-1' />
                            {ticket.timeElapsed}
                          </div>
                        </div>
                        {ticket.description && (
                          <p className='text-xs text-muted-foreground line-clamp-2 mb-2'>
                            {ticket.description}
                          </p>
                        )}
                        <div className='flex flex-wrap items-center gap-3 text-xs text-muted-foreground'>
                          {ticket.hasUnreadMessages && (
                            <div className='flex items-center text-blue-600'>
                              <MessageSquare className='h-3 w-3 mr-1' />
                              Mensajes nuevos
                            </div>
                          )}
                          <span>{ticket.commentCount || 0} comentarios</span>
                          <span>{ticket.attachmentCount || 0} archivos</span>
                        </div>
                      </div>
                      <div className='flex items-center gap-2 mt-3'>
                        <Button variant='outline' size='sm' className='flex-shrink-0'>
                          <MessageSquare className='h-4 w-4' />
                        </Button>
                        <Button size='sm' asChild className='flex-1 sm:flex-none'>
                          <Link href={`/technician/tickets/${ticket.id}`}>Ver Detalles</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-center py-8'>
                    <Ticket className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                    <p className='text-sm text-muted-foreground'>No tienes tickets asignados</p>
                    <Button variant='outline' size='sm' className='mt-2' asChild>
                      <Link href='/technician/tickets'>Buscar tickets disponibles</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className='space-y-6'>
          {/* Mis Familias */}
          {stats.familyMetrics && stats.familyMetrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <Layers className='h-5 w-5 mr-2 text-indigo-600' />
                  Mis Familias
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {stats.familyMetrics.map((fm: any) => (
                    <div
                      key={fm.familyId}
                      className='flex items-center justify-between p-2 rounded-lg bg-muted/50'
                    >
                      <div className='flex items-center space-x-2'>
                        {fm.color && (
                          <div
                            className='w-3 h-3 rounded-full flex-shrink-0'
                            style={{ backgroundColor: fm.color }}
                          />
                        )}
                        <span className='text-sm font-medium'>{fm.familyName}</span>
                      </div>
                      <Badge variant='secondary' className='text-xs'>
                        {fm.openTickets ?? 0} activos
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Zap className='h-5 w-5 mr-2 text-green-600' />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <Button className='w-full justify-start' variant='outline' asChild>
                  <Link href='/technician/tickets?status=unassigned'>
                    <Ticket className='h-4 w-4 mr-2' />
                    Tomar Ticket Disponible
                  </Link>
                </Button>
                <Button className='w-full justify-start' variant='outline' asChild>
                  <Link href='/technician/stats'>
                    <TrendingUp className='h-4 w-4 mr-2' />
                    Mi Rendimiento
                  </Link>
                </Button>
                <Button className='w-full justify-start' variant='outline' asChild>
                  <Link href='/technician/knowledge'>
                    <FileText className='h-4 w-4 mr-2' />
                    Base de Conocimiento
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Métricas Personales */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <Target className='h-5 w-5 mr-2 text-orange-600' />
                Métricas Personales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Tiempo Respuesta</p>
                    <p className='text-xs text-muted-foreground'>Promedio actual</p>
                  </div>
                  <Badge className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                    {stats.avgFirstResponseTime || '45min'}
                  </Badge>
                </div>
                <div className='flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Resolución</p>
                    <p className='text-xs text-muted-foreground'>Tiempo promedio</p>
                  </div>
                  <Badge className='bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'>
                    {stats.avgResolutionTime || '2h'}
                  </Badge>
                </div>
                <div className='flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/50 rounded-lg'>
                  <div>
                    <p className='text-sm font-medium'>Calificación</p>
                    <p className='text-xs text-muted-foreground'>Satisfacción cliente</p>
                  </div>
                  <div className='flex items-center space-x-1'>
                    <Star className='h-4 w-4 text-yellow-500 fill-current' />
                    <Badge className='bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'>
                      {stats.satisfactionScore || 0}/5
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recordatorios */}
          {(urgentTickets > 0 || overdueTickets > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center'>
                  <AlertCircle className='h-5 w-5 mr-2 text-orange-600' />
                  Recordatorios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3 text-sm'>
                  {urgentTickets > 0 && (
                    <div className='flex items-start space-x-2 p-2 bg-red-50 dark:bg-red-950/50 rounded-lg'>
                      <div className='w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0' />
                      <div>
                        <p className='font-medium text-foreground'>Tickets urgentes</p>
                        <p className='text-muted-foreground'>
                          {urgentTickets} tickets requieren atención inmediata
                        </p>
                      </div>
                    </div>
                  )}
                  {overdueTickets > 0 && (
                    <div className='flex items-start space-x-2 p-2 bg-yellow-50 dark:bg-yellow-950/50 rounded-lg'>
                      <div className='w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0' />
                      <div>
                        <p className='font-medium text-foreground'>Tickets vencidos</p>
                        <p className='text-muted-foreground'>
                          {overdueTickets} tickets han superado el SLA
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </UnifiedDashboardBase>
  )
}
