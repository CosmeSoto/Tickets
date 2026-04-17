'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Clock, User, Tag, AlertCircle, MessageSquare, Paperclip, History, Save, FileText, Lightbulb, BookOpen, Star, CheckCircle, MapPin } from 'lucide-react'
import Link from 'next/link'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useTicketData, type Ticket as TicketType, TICKET_STATUSES, TICKET_PRIORITIES, formatDate, getTicketDisplayCode } from '@/hooks/use-ticket-data'
import { formatTimeAgo } from '@/hooks/use-users'
import { AttachmentButton } from '@/components/tickets/attachment-button'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export default function TechnicianTicketDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { getTicket, updateTicket } = useTicketData()
  
  const ticketId = params.id as string
  
  // Estados
  const [ticket, setTicket] = useState<TicketType | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [fileRefreshKey, setFileRefreshKey] = useState(0)
  
  // Estados del formulario
  const [newStatus, setNewStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'>('OPEN')

  // Variables derivadas - artículo disponible en RESOLVED o CLOSED
  const canCreateArticle = (ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED') && session?.user?.role === 'TECHNICIAN'
  const hasArticle = !!ticket?.knowledgeArticleId

  const handleViewArticle = () => {
    if (ticket?.knowledgeArticleId) {
      router.push(`/technician/knowledge/${ticket.knowledgeArticleId}`)
    }
  }

  const handleCreateArticle = () => {
    // Redirigir a crear artículo con datos del ticket
    router.push(`/technician/knowledge/new?fromTicket=${ticket?.id}`)
  }

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'TECHNICIAN') {
      router.push('/login')
      return
    }

    if (ticketId) {
      loadTicket()
    }
  }, [session, status, router, ticketId])

  // Polling para detectar cambios de estado (ej: cliente calificó → ticket CLOSED)
  useEffect(() => {
    if (!ticketId || loading) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.success || !data.data) return
        const fresh = data.data
        setTicket(prev => {
          if (!prev) return prev
          // Solo actualizar si el estado cambió
          if (prev.status !== fresh.status || prev.updatedAt !== fresh.updatedAt) {
            setNewStatus(fresh.status as typeof newStatus)
            return fresh
          }
          return prev
        })
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [ticketId, loading])

  const loadTicket = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const ticketData = await getTicket(ticketId)
      if (ticketData) {
        setTicket(ticketData)
        setNewStatus(ticketData.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD')
      } else {
        setError('Ticket no encontrado')
      }
    } catch (err) {
      setError('Error al cargar el ticket')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!ticket || !newStatus || newStatus === ticket.status) return

    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Error al actualizar estado')
      }
      // Actualizar estado local inmediatamente con la respuesta del PATCH
      setTicket(prev => prev ? {
        ...prev,
        status: newStatus,
        updatedAt: data.data.updatedAt,
        resolvedAt: data.data.resolvedAt ?? prev.resolvedAt,
        closedAt: data.data.closedAt ?? prev.closedAt,
      } : prev)
      setNewStatus(newStatus)
      setTimelineRefreshKey(k => k + 1)
      toast({
        title: 'Estado actualizado',
        description: `El ticket ahora está ${getStatusConfig(newStatus).label}`,
      })
    } catch (err) {
      toast({
        title: 'Error al actualizar estado',
        description: err instanceof Error ? err.message : 'Intenta nuevamente.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusConfig = (status: string) => {
    return TICKET_STATUSES.find(s => s.value === status) || TICKET_STATUSES[0]
  }

  const getPriorityConfig = (priority: string) => {
    return TICKET_PRIORITIES.find(p => p.value === priority) || TICKET_PRIORITIES[0]
  }

  const getAvailableStatuses = (): ('OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD')[] => {
    if (!ticket) return []
    
    // Lógica de transición de estados para técnicos
    // NOTA: CLOSED no está disponible para técnicos. El cierre ocurre
    // automáticamente cuando el cliente califica el ticket resuelto.
    switch (ticket.status) {
      case 'OPEN':
        return ['OPEN', 'IN_PROGRESS']
      case 'IN_PROGRESS':
        return ['IN_PROGRESS', 'RESOLVED', 'ON_HOLD']
      case 'ON_HOLD':
        return ['ON_HOLD', 'IN_PROGRESS']
      case 'RESOLVED':
        return ['RESOLVED', 'IN_PROGRESS'] // Puede reabrir si es necesario
      case 'CLOSED':
        return ['CLOSED'] // Solo lectura, no puede cambiar
      default:
        return [ticket.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD']
    }
  }

  if (status === 'loading' || loading) {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del ticket'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto'></div>
            <p className='mt-2 text-muted-foreground'>Cargando ticket...</p>
          </div>
        </div>
      </ModuleLayout>
    )
  }

  if (!session || session.user.role !== 'TECHNICIAN') {
    return null
  }

  if (error || !ticket) {
    return (
      <ModuleLayout title='Error' subtitle='No se pudo cargar el ticket'>
        <div className='text-center py-8'>
          <AlertCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
          <h1 className='text-2xl font-bold text-foreground mb-2'>Error</h1>
          <p className='text-muted-foreground mb-4'>{error || 'Ticket no encontrado'}</p>
          <Button asChild>
            <Link href='/technician/tickets'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Volver a Mis Tickets
            </Link>
          </Button>
        </div>
      </ModuleLayout>
    )
  }

  const statusConfig = getStatusConfig(ticket.status)
  const priorityConfig = getPriorityConfig(ticket.priority)

  return (
    <ModuleLayout
      title={ticket.title}
      subtitle={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">
            #{getTicketDisplayCode(ticket)}
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-xs text-muted-foreground">Creado {formatDate ? formatDate(ticket.createdAt) : ticket.createdAt}</span>
        </span>
      }
      headerActions={
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' size='sm' asChild>
            <Link href='/technician/tickets'>
              <ArrowLeft className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Mis Tickets</span>
            </Link>
          </Button>
          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
          {canCreateArticle && (
            hasArticle ? (
              <Button variant='outline' size='sm' onClick={handleViewArticle}>
                <BookOpen className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Ver Artículo</span>
              </Button>
            ) : (
              <Button variant='outline' size='sm' onClick={handleCreateArticle}>
                <Lightbulb className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Crear Artículo</span>
              </Button>
            )
          )}
        </div>
      }
      loading={loading}
    >
      <div className='max-w-6xl mx-auto'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Columna Principal */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Información del Ticket */}
            <Card>
              <CardContent className='pt-5 space-y-3'>
                <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>{ticket.description}</p>
                {(ticket as any).location && (
                  <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2'>
                    <MapPin className='h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0' />
                    <div>
                      <p className='text-xs font-semibold text-amber-700 dark:text-amber-400'>Ubicación del problema</p>
                      <p className='text-sm text-amber-800 dark:text-amber-300'>{(ticket as any).location}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="status">Estado</TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Actualiza el estado del ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="timeline">Historial</TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cronología completa de actividades y cambios</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="resolution">Plan de Resolución</TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Gestiona las tareas para resolver este ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <TabsTrigger value="files">Archivos</TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Archivos adjuntos del ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TabsList>
              
              <TabsContent value="status" className="space-y-4">
                {/* Banner: Esperando calificación del cliente */}
                {ticket.status === 'RESOLVED' && (
                  <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <Star className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-amber-900 dark:text-amber-100">
                            Esperando calificación del cliente
                          </p>
                          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                            El ticket se cerrará automáticamente cuando el cliente envíe su calificación. 
                            Si necesitas reabrir el ticket, puedes cambiar el estado a &quot;En Progreso&quot;.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Banner: Ticket cerrado - promover a artículo */}
                {ticket.status === 'CLOSED' && (
                  <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-green-900 dark:text-green-100">
                            Ticket cerrado y calificado
                          </p>
                          <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                            El cliente ha calificado el servicio. Este ticket puede ser promovido a artículo de conocimiento para ayudar a resolver casos similares en el futuro.
                          </p>
                          {!hasArticle && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-3 border-green-300 text-green-800 hover:bg-green-100 dark:border-green-700 dark:text-green-200 dark:hover:bg-green-900"
                              onClick={handleCreateArticle}
                            >
                              <BookOpen className="h-4 w-4 mr-2" />
                              Promover a Artículo de Conocimiento
                            </Button>
                          )}
                          {hasArticle && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-3 border-green-300 text-green-800 hover:bg-green-100 dark:border-green-700 dark:text-green-200 dark:hover:bg-green-900"
                              onClick={handleViewArticle}
                            >
                              <BookOpen className="h-4 w-4 mr-2" />
                              Ver Artículo Creado
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Actualizar Estado - solo si no está cerrado */}
                {ticket.status !== 'CLOSED' && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center space-x-2'>
                      <Clock className='h-5 w-5' />
                      <span>Actualizar Estado del Ticket</span>
                    </CardTitle>
                    <CardDescription>
                      Cambia el estado del ticket según su progreso. Solo puedes usar transiciones válidas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    <div className='flex items-center space-x-4'>
                      <div className='flex-1'>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Select value={newStatus} onValueChange={(value) => setNewStatus(value as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD')}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getAvailableStatuses().map(status => {
                                    const config = getStatusConfig(status)
                                    return (
                                      <SelectItem key={status} value={status}>
                                        <div className='flex items-center space-x-2'>
                                          <div className={`w-3 h-3 rounded-full ${
                                            status === 'OPEN' ? 'bg-orange-500' :
                                            status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                                            status === 'RESOLVED' ? 'bg-green-500' :
                                            status === 'ON_HOLD' ? 'bg-purple-500' :
                                            'bg-gray-500'
                                          }`} />
                                          <span>{config.label}</span>
                                        </div>
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Selecciona el nuevo estado del ticket según su progreso</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              onClick={handleStatusUpdate}
                              disabled={updating || newStatus === ticket.status}
                            >
                              <Save className='h-4 w-4 mr-2' />
                              {updating ? 'Actualizando...' : 'Actualizar Estado'}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Guarda el nuevo estado del ticket</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    {newStatus !== ticket.status && (
                      <div className='p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg'>
                        <p className='text-sm text-blue-800 dark:text-blue-200'>
                          El estado cambiará de <strong>{statusConfig.label}</strong> a{' '}
                          <strong>{getStatusConfig(newStatus).label}</strong>
                        </p>
                      </div>
                    )}

                    {/* Información sobre transiciones */}
                    <div className='p-3 bg-muted rounded-lg'>
                      <p className='text-sm font-medium text-foreground mb-2'>Transiciones de Estado Permitidas:</p>
                      <ul className='text-xs text-muted-foreground space-y-1'>
                        <li>• <strong>Abierto</strong> → En Progreso</li>
                        <li>• <strong>En Progreso</strong> → Resuelto, En Espera</li>
                        <li>• <strong>En Espera</strong> → En Progreso</li>
                        <li>• <strong>Resuelto</strong> → En Progreso (reabrir si es necesario)</li>
                        <li>• <strong>Resuelto</strong> → Cerrado (automático tras calificación del cliente)</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
                )}
              </TabsContent>
              
              {/* Timeline: siempre montado fuera del sistema de tabs para evitar desmontaje */}
              <TabsContent value="timeline" className="space-y-4">
                <TicketTimeline 
                  ticketId={ticket.id}
                  canAddComments={ticket.status !== 'CLOSED'}
                  canViewInternal={true}
                  refreshKey={timelineRefreshKey}
                  onCommentAdded={() => setFileRefreshKey(k => k + 1)}
                />
              </TabsContent>
              
              <TabsContent value="resolution" className="space-y-4">
                <TicketResolutionTracker 
                  ticketId={ticket.id}
                  canEdit={ticket.assignee?.id === session?.user?.id}
                  mode='technician'
                  onPlanChange={() => setTimelineRefreshKey(k => k + 1)}
                />
              </TabsContent>
              
              <TabsContent value="files" className="space-y-4">
                <CompactFileManager 
                  ticketId={ticket.id}
                  onAttachmentsChange={loadTicket}
                  canUpload={ticket.status !== 'CLOSED'}
                  canDelete={ticket.status !== 'CLOSED'}
                  refreshKey={fileRefreshKey}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            {/* Información del Cliente */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <User className='h-5 w-5' />
                  <span>Cliente</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='flex items-center space-x-3'>
                  <Avatar className='h-10 w-10'>
                    <AvatarImage src={ticket.client?.avatar || undefined} />
                    <AvatarFallback>
                      {ticket.client?.name?.charAt(0) || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className='font-medium'>{ticket.client?.name || 'Cliente'}</p>
                    <p className='text-sm text-muted-foreground'>{ticket.client?.email || 'Sin email'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalles del Ticket */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
              </CardHeader>
              <CardContent className='space-y-3'>
                <div>
                  <label className='text-sm font-medium text-muted-foreground'>Categoría</label>
                  <div className='flex items-center space-x-2 mt-1'>
                    <div
                      className='w-3 h-3 rounded-full'
                      style={{ backgroundColor: ticket.category?.color || '#6B7280' }}
                    />
                    <p className='text-sm'>{ticket.category?.name || 'Sin categoría'}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <label className='text-sm font-medium text-muted-foreground'>Creado</label>
                  <p className='text-sm'>{formatTimeAgo(ticket.createdAt)}</p>
                </div>
                
                <div>
                  <label className='text-sm font-medium text-muted-foreground'>Última actualización</label>
                  <p className='text-sm'>{formatTimeAgo(ticket.updatedAt)}</p>
                </div>
                
                {ticket.resolvedAt && (
                  <div>
                    <label className='text-sm font-medium text-muted-foreground'>Resuelto</label>
                    <p className='text-sm'>{formatTimeAgo(ticket.resolvedAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}