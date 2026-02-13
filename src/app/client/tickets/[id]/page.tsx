'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { 
  useTicketData, 
  type Ticket,
  formatDate,
  getStatusConfig,
  getPriorityConfig
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
  const [editForm, setEditForm] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    if (params.id && params.id !== 'create') {
      loadTicket()
    }
  }, [params.id])

  const loadTicket = async () => {
    if (!params.id || params.id === 'create') {
      return
    }
    
    const ticketData = await getTicket(params.id as string)
    if (ticketData) {
      // Verificar que el ticket pertenece al cliente actual
      if (ticketData.client?.id !== session?.user?.id) {
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
        toast({
          title: 'Ticket actualizado',
          description: 'Los cambios se han guardado exitosamente',
        })
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

    setDeleting(true)
    try {
      const success = await deleteTicket(ticket.id)
      if (success) {
        toast({
          title: 'Ticket eliminado',
          description: 'El ticket ha sido eliminado exitosamente',
        })
        router.push('/client/tickets')
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el ticket. Solo puedes eliminar tickets que aún no han sido revisados.',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[CRITICAL] Error deleting ticket:', error)
      toast({
        title: 'Error',
        description: 'Ocurrió un error al eliminar el ticket',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // Verificar si el ticket puede ser eliminado (solo si está en estado OPEN)
  const canDeleteTicket = ticket?.status === 'OPEN'
  
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
      <Button variant='outline' size='sm' onClick={() => router.push('/client/tickets')}>
        <ArrowLeft className='h-4 w-4 sm:mr-2' />
        <span className='hidden sm:inline'>Mis Tickets</span>
      </Button>
      {getStatusBadge(ticket.status)}
      {getPriorityBadge(ticket.priority)}
      {canEditTicket && !isEditing && (
        <Button
          variant='outline'
          size='sm'
          onClick={() => setIsEditing(true)}
        >
          <Edit className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Editar</span>
        </Button>
      )}
      {canDeleteTicket && !isEditing && (
        <Button
          variant='destructive'
          size='sm'
          onClick={() => setShowDeleteDialog(true)}
          disabled={deleting}
        >
          <Trash2 className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Eliminar</span>
        </Button>
      )}
    </div>
  )

  return (
    <ModuleLayout
      title={`Ticket #${ticket.id.slice(-8)}`}
      subtitle={`Creado ${formatDate(ticket.createdAt)}`}
      headerActions={headerActions}
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Contenido principal */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Información del ticket */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Información del Ticket</CardTitle>
                {isEditing && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleEditTicket}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
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
                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>Título</p>
                    <p className='text-lg font-medium text-foreground'>{ticket.title}</p>
                  </div>

                  <Separator />

                  <div>
                    <p className='text-sm font-medium text-muted-foreground mb-1'>Descripción</p>
                    <p className='text-foreground whitespace-pre-wrap'>{ticket.description}</p>
                  </div>

                  {!canEditTicket && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-amber-800 text-sm">
                        ℹ️ Este ticket ya está en proceso y no puede ser editado. 
                        Usa la sección de comentarios para agregar información adicional.
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tabs para organizar el contenido */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="timeline">Historial</TabsTrigger>
              <TabsTrigger value="rating">Calificación</TabsTrigger>
              <TabsTrigger value="files">Archivos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline 
                ticketId={ticket.id}
                canAddComments={true}
                canViewInternal={false}
              />
            </TabsContent>
            
            <TabsContent value="rating" className="space-y-4">
              <TicketRatingSystem 
                ticketId={ticket.id}
                technicianId={ticket.assignee?.id}
                canRate={ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'}
                showTechnicianStats={false}
                mode='client'
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
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className='text-sm font-medium'>{attachment.originalName}</p>
                              <p className='text-xs text-muted-foreground'>
                                {(attachment.size / 1024).toFixed(1)} KB • {formatDate(attachment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <Button variant='outline' size='sm'>
                            Descargar
                          </Button>
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
          {/* Detalles */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center space-x-3'>
                <User className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Asignado a</p>
                  {ticket.assignee ? (
                    <>
                      <p className='text-sm text-muted-foreground'>{ticket.assignee.name}</p>
                      <p className='text-xs text-muted-foreground'>{ticket.assignee.email}</p>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>Pendiente de asignación</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Tag className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Categoría</p>
                  <div className='flex items-center space-x-2 mt-1'>
                    <div
                      className='w-3 h-3 rounded-full'
                      style={{ backgroundColor: ticket.category?.color || '#6B7280' }}
                    />
                    <span className='text-sm text-muted-foreground'>{ticket.category?.name || 'Sin categoría'}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Clock className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Fechas</p>
                  <p className='text-xs text-muted-foreground'>Creado: {formatDate(ticket.createdAt)}</p>
                  <p className='text-xs text-muted-foreground'>Actualizado: {formatDate(ticket.updatedAt)}</p>
                  {ticket.resolvedAt && (
                    <p className='text-xs text-green-600 dark:text-green-400'>
                      Resuelto: {formatDate(ticket.resolvedAt)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estado del Ticket */}
          <Card>
            <CardHeader>
              <CardTitle>Estado del Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-muted-foreground'>Estado</span>
                  {getStatusBadge(ticket.status)}
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-muted-foreground'>Prioridad</span>
                  {getPriorityBadge(ticket.priority)}
                </div>
                {ticket._count && (
                  <>
                    <Separator />
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-muted-foreground'>Comentarios</span>
                      <Badge variant='outline'>{ticket._count.comments || 0}</Badge>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-muted-foreground'>Archivos</span>
                      <Badge variant='outline'>{ticket._count.attachments || 0}</Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Botón para volver */}
          <Button variant='outline' className='w-full' asChild>
            <a href='/client/tickets'>
              <ArrowLeft className='h-4 w-4 mr-2' />
              Volver a Mis Tickets
            </a>
          </Button>
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
                    ⚠️ Solo puedes eliminar tickets que aún no han sido revisados o asignados.
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
