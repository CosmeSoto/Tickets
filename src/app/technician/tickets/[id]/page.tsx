'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Clock, User, Tag, AlertCircle, MessageSquare, Paperclip, History, Save, FileText, Lightbulb, BookOpen } from 'lucide-react'
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
import { useTicketData, type Ticket as TicketType, TICKET_STATUSES, TICKET_PRIORITIES, formatDate } from '@/hooks/use-ticket-data'
import { formatTimeAgo } from '@/hooks/use-users'
import { AttachmentButton } from '@/components/tickets/attachment-button'
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
  
  // Estados del formulario
  const [newStatus, setNewStatus] = useState<'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'>('OPEN')

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
      const oldStatusLabel = getStatusConfig(ticket.status).label
      const newStatusLabel = getStatusConfig(newStatus).label
      
      const updatedTicket = await updateTicket(ticket.id, { status: newStatus })
      if (updatedTicket) {
        setTicket(updatedTicket)
        toast({
          title: 'Estado actualizado exitosamente',
          description: `El ticket "${ticket.title}" cambió de ${oldStatusLabel} a ${newStatusLabel}`,
          duration: 4000
        })
      }
    } catch (err) {
      toast({
        title: 'Error al actualizar estado',
        description: 'No se pudo actualizar el estado del ticket. Intenta nuevamente.',
        variant: 'destructive',
        duration: 5000
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
    switch (ticket.status) {
      case 'OPEN':
        return ['OPEN', 'IN_PROGRESS']
      case 'IN_PROGRESS':
        return ['IN_PROGRESS', 'RESOLVED', 'ON_HOLD']
      case 'ON_HOLD':
        return ['ON_HOLD', 'IN_PROGRESS']
      case 'RESOLVED':
        return ['RESOLVED', 'IN_PROGRESS'] // Puede reabrir si es necesario
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

  // Verificar si puede crear artículo (ticket resuelto y es el técnico asignado)
  const canCreateArticle = ticket.status === 'RESOLVED' && ticket.assignee?.id === session?.user?.id
  const hasArticle = ticket.knowledge_article !== null && ticket.knowledge_article !== undefined

  const handleCreateArticle = () => {
    // Redirigir a crear artículo con datos del ticket
    router.push(`/technician/knowledge/new?fromTicket=${ticket.id}`)
  }

  const handleViewArticle = () => {
    // Redirigir al artículo existente
    if (ticket.knowledge_article?.id) {
      router.push(`/technician/knowledge/${ticket.knowledge_article.id}`)
    }
  }

  return (
    <ModuleLayout
      title={`Ticket #${ticket.id.slice(-8)}`}
      subtitle={`${ticket.title}`}
      loading={loading}
    >
      <div className='max-w-6xl mx-auto'>
        {/* Header con navegación */}
        <div className='flex flex-wrap items-center justify-between gap-4 mb-6'>
          <div className='flex items-center space-x-4'>
            <Button variant='outline' size='sm' asChild>
              <Link href='/technician/tickets'>
                <ArrowLeft className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Mis Tickets</span>
              </Link>
            </Button>
            <div>
              <h1 className='text-2xl font-bold text-foreground'>#{ticket.id.slice(-8)}</h1>
              <p className='text-muted-foreground hidden sm:block'>Detalles del Ticket</p>
            </div>
          </div>
          
          <div className='flex flex-wrap items-center gap-2'>
            <Badge className={statusConfig.color}>
              {statusConfig.label}
            </Badge>
            <Badge className={priorityConfig.color}>
              {priorityConfig.label}
            </Badge>
            {canCreateArticle && (
              hasArticle ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='outline' size='sm' onClick={handleViewArticle}>
                        <BookOpen className='h-4 w-4 sm:mr-2' />
                        <span className='hidden sm:inline'>Ver Artículo</span>
                        <span className='sm:hidden'>Artículo</span>
                        {ticket.knowledge_article && !ticket.knowledge_article.isPublished && (
                          <Badge variant='secondary' className='ml-2 text-xs'>Borrador</Badge>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ver el artículo de conocimiento creado desde este ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='outline' size='sm' onClick={handleCreateArticle}>
                        <Lightbulb className='h-4 w-4 sm:mr-2' />
                        <span className='hidden sm:inline'>Crear Artículo</span>
                        <span className='sm:hidden'>Artículo</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Crea un artículo de conocimiento con la solución de este ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            )}
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          {/* Columna Principal */}
          <div className='lg:col-span-2 space-y-6'>
            {/* Información del Ticket */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Tag className='h-5 w-5' />
                  <span>{ticket.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='prose max-w-none'>
                  <p className='text-foreground whitespace-pre-wrap'>{ticket.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tabs para organizar el contenido */}
            <Tabs defaultValue="status" className="w-full">
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
                {/* Actualizar Estado */}
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
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="timeline" className="space-y-4">
                <TicketTimeline 
                  ticketId={ticket.id}
                  canAddComments={true}
                  canViewInternal={true}
                />
              </TabsContent>
              
              <TabsContent value="resolution" className="space-y-4">
                <TicketResolutionTracker 
                  ticketId={ticket.id}
                  canEdit={ticket.assignee?.id === session?.user?.id}
                  mode='technician'
                />
              </TabsContent>
              
              <TabsContent value="files" className="space-y-4">
                {/* Lista de archivos existentes */}
                {ticket.attachments && ticket.attachments.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className='flex items-center'>
                        <Paperclip className='h-5 w-5 mr-2' />
                        Archivos Adjuntos ({ticket.attachments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='space-y-2'>
                        {ticket.attachments.map(attachment => (
                          <div
                            key={attachment.id}
                            className='flex items-center justify-between p-3 bg-muted rounded-lg'
                          >
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                {attachment.mimeType?.startsWith('image/') ? (
                                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                    <span className="text-blue-600 text-xs font-medium">IMG</span>
                                  </div>
                                ) : attachment.mimeType === 'application/pdf' ? (
                                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                                    <span className="text-red-600 text-xs font-medium">PDF</span>
                                  </div>
                                ) : (
                                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                    <Paperclip className="h-4 w-4 text-gray-600" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className='text-sm font-medium'>{attachment.originalName}</p>
                                <p className='text-xs text-muted-foreground'>
                                  {attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Tamaño desconocido'} • {formatDate(attachment.createdAt)}
                                </p>
                              </div>
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant='outline' size='sm'>
                                    Descargar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Descarga el archivo {attachment.originalName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className='py-8 text-center'>
                      <Paperclip className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                      <p className='text-sm text-muted-foreground'>No hay archivos adjuntos</p>
                    </CardContent>
                  </Card>
                )}
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
                    <AvatarImage src={ticket.client?.avatar || ''} />
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