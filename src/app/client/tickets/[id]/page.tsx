'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Clock,
  User,
  Tag,
  Paperclip,
  AlertCircle,
  Trash2,
  Edit,
  Save,
  X,
  Star,
} from 'lucide-react'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { useToast } from '@/hooks/use-toast'
import { 
  useTicketData, 
  type Ticket,
  formatDate,
  getStatusConfig,
  getPriorityConfig,
  getTicketDisplayCode
} from '@/hooks/use-ticket-data'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function ClientTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { getTicket, updateTicket, deleteTicket, loading } = useTicketData()
  const { toast } = useToast()
  
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('timeline')
  const stopTimelinePollingRef = useRef<(() => void) | null>(null)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [fileRefreshKey, setFileRefreshKey] = useState(0)
  const [editForm, setEditForm] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    if (params.id && params.id !== 'create' && session?.user?.id) {
      loadTicket()
    }
  }, [params.id, session?.user?.id])

  // Polling para detectar cambios de estado (ej: técnico marcó como RESOLVED)
  useEffect(() => {
    const ticketId = params.id as string
    if (!ticketId || ticketId === 'create' || !session?.user?.id) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`)
        if (!res.ok) return
        const data = await res.json()
        if (!data.success || !data.data) return
        const fresh = data.data
        setTicket(prev => {
          if (!prev) return prev
          if (prev.status !== fresh.status || prev.updatedAt !== fresh.updatedAt) {
            // También refrescar el timeline cuando el ticket cambia
            setTimelineRefreshKey(k => k + 1)
            return fresh
          }
          return prev
        })
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [params.id, session?.user?.id])

  const loadTicket = async () => {
    if (!params.id || params.id === 'create' || !session?.user?.id) {
      return
    }
    
    const ticketData = await getTicket(params.id as string)
    if (ticketData) {
      // Verificar que el ticket pertenece al cliente actual
      if (ticketData.client?.id !== session.user.id) {
        router.push('/unauthorized')
        return
      }
      setTicket(ticketData)
      setEditForm({
        title: ticketData.title,
        description: ticketData.description
      })
    }
  }

  const handleEditTicket = async () => {
    if (!ticket) return

    try {
      const updatedTicket = await updateTicket(ticket.id, {
        title: editForm.title,
        description: editForm.description
      })

      if (updatedTicket) {
        setTicket(updatedTicket)
        setIsEditing(false)
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo actualizar el ticket. Solo puedes editar tickets que aún no han sido revisados.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[CRITICAL] Error updating ticket:', error)
      toast({
        title: 'Error',
        description: 'Ocurrió un error al actualizar el ticket',
        variant: 'destructive',
      })
    }
  }

  const handleCancelEdit = () => {
    if (ticket) {
      setEditForm({
        title: ticket.title,
        description: ticket.description
      })
    }
    setIsEditing(false)
  }

  const handleDeleteTicket = async () => {
    if (!ticket) return

    // Detener el polling del timeline ANTES de eliminar para evitar 404s
    stopTimelinePollingRef.current?.()

    setDeleting(true)
    try {
      const success = await deleteTicket(ticket.id)
      if (success) {
        toast({
          title: 'Ticket eliminado',
          description: 'El ticket ha sido eliminado exitosamente',
        })
        // Cerrar el diálogo inmediatamente
        setShowDeleteDialog(false)
        // Navegar inmediatamente antes de que se intenten recargar los datos
        router.push('/client/tickets')
        router.refresh()
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el ticket. Solo puedes eliminar tickets que aún no han sido revisados.',
          variant: 'destructive',
        })
        setDeleting(false)
        setShowDeleteDialog(false)
      }
    } catch (error) {
      console.error('[CRITICAL] Error deleting ticket:', error)
      toast({
        title: 'Error',
        description: 'Ocurrió un error al eliminar el ticket',
        variant: 'destructive',
      })
      setDeleting(false)
      setShowDeleteDialog(false)
    }
    // No hacer finally aquí para evitar cambiar el estado después de la redirección
  }

  // Verificar si el ticket puede ser eliminado: solo OPEN y sin técnico asignado
  const canDeleteTicket = ticket?.status === 'OPEN' && !ticket?.assignee
  
  // Verificar si el ticket puede ser editado (solo si está en estado OPEN)
  const canEditTicket = ticket?.status === 'OPEN'

  const getStatusBadge = (status: Ticket['status']) => {
    const statusConfig = getStatusConfig(status)
    if (!statusConfig) return null

    return (
      <Badge className={statusConfig.color}>
        {statusConfig.label}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const priorityConfig = getPriorityConfig(priority)
    if (!priorityConfig) return null

    return <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
  }

  if (loading) {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del ticket'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto'></div>
            <p className='mt-2 text-muted-foreground'>Cargando ticket...</p>
          </div>
        </div>
      </ModuleLayout>
    )
  }

  if (!ticket) {
    return (
      <ModuleLayout title='Ticket no encontrado' subtitle='El ticket solicitado no existe'>
        <div className='text-center py-8'>
          <AlertCircle className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
          <p className='text-muted-foreground mb-4'>Ticket no encontrado</p>
          <Button onClick={() => router.push('/client/tickets')}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver a Mis Tickets
          </Button>
        </div>
      </ModuleLayout>
    )
  }

  const headerActions = (
    <div className='flex flex-wrap items-center gap-2'>
      {canEditTicket && !isEditing && (
        <Button variant='outline' size='sm' onClick={() => setIsEditing(true)}>
          <Edit className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Editar</span>
        </Button>
      )}
      {isEditing && (
        <>
          <Button variant='outline' size='sm' onClick={handleCancelEdit}>
            <X className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Cancelar</span>
          </Button>
          <Button size='sm' onClick={handleEditTicket}>
            <Save className='h-4 w-4 sm:mr-2' />
            <span className='hidden sm:inline'>Guardar</span>
          </Button>
        </>
      )}
      {canDeleteTicket && !isEditing && (
        <Button variant='destructive' size='sm' onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
          <Trash2 className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Eliminar</span>
        </Button>
      )}
    </div>
  )

  const statusConfig = getStatusConfig(ticket.status)
  const priorityConfig = getPriorityConfig(ticket.priority)
  const shortTitle = ticket.title.length > 50 ? ticket.title.slice(0, 50) + '…' : ticket.title

  return (
    <ModuleLayout
      title={shortTitle}
      subtitle={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">
            #{getTicketDisplayCode(ticket)}
          </span>
          <span className="text-xs">·</span>
          <Badge className={`text-xs ${statusConfig.color}`}>{statusConfig.label}</Badge>
          <Badge className={`text-xs ${priorityConfig.color}`}>{priorityConfig.label}</Badge>
        </span>
      }
      headerActions={headerActions}
    >
      <BackToTickets />
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Contenido principal */}
        <div className='lg:col-span-2 space-y-4'>
          {/* Información del ticket */}
          <Card>
            <CardContent className='pt-5 space-y-3'>
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input
                      id="title"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      placeholder="Título del ticket"
                      className="mt-1"
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea
                      id="description"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Descripción detallada del problema"
                      rows={6}
                      className="mt-1"
                    />
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      ℹ️ Solo puedes editar el título y descripción mientras el ticket no haya sido revisado. 
                      Una vez asignado, usa los comentarios para agregar información adicional.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>{ticket.description}</p>

                  {!canEditTicket && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 text-sm">
                        ℹ️ Este ticket ya está en proceso. Usa los comentarios para agregar información adicional.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Banner prominente: Califica para cerrar el ticket */}
          {ticket.status === 'RESOLVED' && (
            <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 dark:border-amber-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3 shrink-0">
                    <Star className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-100 text-lg">
                      Tu ticket ha sido resuelto
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                      El técnico ha marcado este ticket como resuelto. Por favor califica el servicio recibido para cerrar el ticket. 
                      Tu opinión nos ayuda a mejorar.
                    </p>
                    <Button 
                      className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                      size="sm"
                      onClick={() => setActiveTab('rating')}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Calificar Servicio
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs para organizar el contenido */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timeline">Historial</TabsTrigger>
              <TabsTrigger value="rating">Calificación</TabsTrigger>
              <TabsTrigger value="files">Archivos</TabsTrigger>
            </TabsList>
            
            {/* forceMount mantiene el componente montado siempre → polling activo */}
            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline 
                ticketId={ticket.id}
                canAddComments={ticket.status !== 'CLOSED'}
                canViewInternal={false}
                refreshKey={timelineRefreshKey}
                onCommentAdded={() => setFileRefreshKey(k => k + 1)}
                onStopPolling={(fn) => { stopTimelinePollingRef.current = fn }}
              />
            </TabsContent>
            
            <TabsContent value="rating" className="space-y-4">
              <TicketRatingSystem 
                ticketId={ticket.id}
                technicianId={ticket.assignee?.id}
                canRate={ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'}
                showTechnicianStats={false}
                mode='client'
                onRatingSubmitted={() => {
                  setTicket(prev => prev ? { ...prev, status: 'CLOSED', closedAt: new Date().toISOString() } : prev)
                  setTimelineRefreshKey(k => k + 1)
                }}
              />
            </TabsContent>
            
            <TabsContent value="files" className="space-y-4">
              <CompactFileManager
                ticketId={ticket.id}
                onUploadComplete={loadTicket}
                disabled={ticket.status === 'CLOSED'}
                refreshKey={fileRefreshKey}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-4'>
          {/* Detalles */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Detalles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 pt-0'>
              <div className='flex items-start gap-2'>
                <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Asignado a</p>
                  {ticket.assignee ? (
                    <>
                      <p className='text-sm'>{ticket.assignee.name}</p>
                      <p className='text-xs text-muted-foreground'>{ticket.assignee.email}</p>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>Pendiente de asignación</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-start gap-2'>
                <Tag className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Categoría</p>
                  <div className='flex items-center gap-1.5 mt-0.5'>
                    <div className='w-2.5 h-2.5 rounded-full shrink-0' style={{ backgroundColor: ticket.category?.color || '#6B7280' }} />
                    <span className='text-sm'>{ticket.category?.name || 'Sin categoría'}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className='flex items-start gap-2'>
                <Clock className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs font-medium text-muted-foreground'>Fechas</p>
                  <p className='text-xs text-muted-foreground'>Creado: {formatDate(ticket.createdAt)}</p>
                  <p className='text-xs text-muted-foreground'>Actualizado: {formatDate(ticket.updatedAt)}</p>
                  {ticket.resolvedAt && (
                    <p className='text-xs text-green-600 dark:text-green-400'>Resuelto: {formatDate(ticket.resolvedAt)}</p>
                  )}
                </div>
              </div>

              {ticket._count && (
                <>
                  <Separator />
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-muted-foreground flex items-center gap-1.5'>
                      <Paperclip className='h-3.5 w-3.5' />
                      Archivos adjuntos
                    </span>
                    <Badge variant='outline' className="text-xs">{ticket._count.attachments || 0}</Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar este ticket? Esta acción no se puede deshacer.
              {!canDeleteTicket && (
                <div className='mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg'>
                  <p className='text-amber-800 text-sm font-medium'>
                    ⚠️ {ticket?.assignee
                      ? 'No puedes eliminar este ticket porque ya ha sido asignado a un técnico.'
                      : 'Solo puedes eliminar tickets que aún no han sido revisados o asignados.'}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTicket}
              disabled={deleting || !canDeleteTicket}
              className='bg-red-600 hover:bg-red-700'
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
