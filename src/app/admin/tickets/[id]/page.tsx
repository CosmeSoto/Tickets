'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Clock,
  User,
  UserX,
  Tag,
  MessageSquare,
  Paperclip,
  History,
  Edit,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  Lightbulb,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { AutoAssignment } from '@/components/tickets/auto-assignment'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { 
  useTicketData, 
  useUserData, 
  useCategoryData,
  type Ticket,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  formatTimeAgo,
  formatDate,
  getStatusConfig,
  getPriorityConfig,
  getTicketDisplayCode
} from '@/hooks/use-ticket-data'

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { updateTicket, loading } = useTicketData()
  const { getTechnicians } = useUserData()
  
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [ticketLoading, setTicketLoading] = useState(false)
  const [technicians, setTechnicians] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const [timelineRefreshKey, setTimelineRefreshKey] = useState(0)
  const [fileRefreshKey, setFileRefreshKey] = useState(0)
  const [activeTab, setActiveTab] = useState('timeline')
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '' as Ticket['status'],
    priority: '' as Ticket['priority'],
    assigneeId: '',
  })

  useEffect(() => {
    if (params.id && params.id !== 'create') {
      loadTicket()
      loadTechnicians()
    }
  }, [params.id])

  // Polling para detectar cambios de estado
  useEffect(() => {
    const ticketId = params.id as string
    if (!ticketId || ticketId === 'create') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!data.success || !data.data) return
        const fresh = data.data
        setTicket(prev => {
          if (!prev) return prev
          if (prev.status !== fresh.status || prev.updatedAt !== fresh.updatedAt) {
            setEditForm({
              title: fresh.title,
              description: fresh.description,
              status: fresh.status,
              priority: fresh.priority,
              assigneeId: fresh.assignee?.id || '',
            })
            return fresh
          }
          return prev
        })
      } catch {}
    }, 10000)
    return () => clearInterval(interval)
  }, [params.id])

  // Fetch directo — independiente del hook para evitar conflictos de estado loading
  const loadTicket = async () => {
    if (!params.id || params.id === 'create') return
    setTicketLoading(true)
    try {
      const res = await fetch(`/api/tickets/${params.id}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.success && data.data) {
        setTicket(data.data)
        setEditForm({
          title: data.data.title,
          description: data.data.description,
          status: data.data.status,
          priority: data.data.priority,
          assigneeId: data.data.assignee?.id || '',
        })
      }
    } catch (err) {
      console.error('Error cargando ticket:', err)
    } finally {
      setTicketLoading(false)
    }
  }

  // Callback para cuando se completa una asignación automática
  const handleAssignmentComplete = async (assignedTechnician?: { id: string; name: string; email: string }) => {
    // Actualizar estado local inmediatamente si tenemos datos del técnico
    if (assignedTechnician) {
      setTicket(prev => prev ? { 
        ...prev, 
        assignee: { 
          id: assignedTechnician.id, 
          name: assignedTechnician.name, 
          email: assignedTechnician.email, 
          role: 'TECHNICIAN' as const,
          isActive: true
        },
        status: 'IN_PROGRESS' as const
      } : prev)
    }
    await loadTicket()
    setTimelineRefreshKey(k => k + 1)
  }

  // Desasignar técnico del ticket
  const handleUnassign = async () => {
    if (!ticket) return
    setUnassigning(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: null, comment: 'Técnico desasignado por administrador' }),
      })
      if (res.ok) {
        // Actualizar estado local inmediatamente para respuesta instantánea en UI
        setTicket(prev => prev ? { ...prev, assignee: undefined, status: 'OPEN' as const } : prev)
        // Luego recargar desde servidor para datos frescos
        await loadTicket()
        setTimelineRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('Error desasignando técnico:', err)
    } finally {
      setUnassigning(false)
    }
  }

  const loadTechnicians = async () => {
    const technicianData = await getTechnicians()
    setTechnicians(technicianData)
  }

  const handleSave = async () => {
    if (!ticket) return

    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          assigneeId: editForm.assigneeId || null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.data) {
        setTicket(data.data)
        setEditForm({
          title: data.data.title,
          description: data.data.description,
          status: data.data.status,
          priority: data.data.priority,
          assigneeId: data.data.assignee?.id || '',
        })
        setIsEditing(false)
        setTimelineRefreshKey(k => k + 1)
      }
    } catch (err) {
      console.error('Error guardando ticket:', err)
    }
  }

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

  if (ticketLoading && !ticket) {
    return (
      <RoleDashboardLayout title='Cargando...' subtitle='Obteniendo información del ticket'>
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto'></div>
            <p className='mt-2 text-muted-foreground'>Cargando ticket...</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!ticket) {
    return (
      <RoleDashboardLayout title='Ticket no encontrado' subtitle='El ticket solicitado no existe'>
        <div className='text-center py-8'>
          <p className='text-muted-foreground'>Ticket no encontrado</p>
          <Button onClick={() => router.back()} className='mt-4'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Button>
        </div>
      </RoleDashboardLayout>
    )
  }

  const headerActions = (
    <div className='flex flex-wrap items-center gap-2'>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant='outline' size='sm' onClick={() => router.push('/admin/tickets')}>
              <ArrowLeft className='h-4 w-4 mr-2' />
              <span className='hidden sm:inline'>Todos los Tickets</span>
              <span className='sm:hidden'>Tickets</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Volver a la lista de todos los tickets</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Botón Inteligente de Artículo (solo si ticket está RESOLVED) */}
      {ticket.status === 'RESOLVED' && (
        ticket.knowledgeArticleId ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/admin/knowledge/${ticket.knowledgeArticleId}`)}
                >
                  <BookOpen className='h-4 w-4 mr-2' />
                  <span className='hidden sm:inline'>Ver Artículo</span>
                  <span className='sm:hidden'>Artículo</span>
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
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(`/admin/knowledge/new?fromTicket=${ticket.id}`)}
                >
                  <Lightbulb className='h-4 w-4 mr-2' />
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
      {getStatusBadge(ticket.status)}
      {getPriorityBadge(ticket.priority)}
      {session?.user?.role === 'ADMIN' && (
        <>
          {ticket.assignee ? (
            // Ya hay técnico asignado → mostrar botón "Sin asignar"
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant='outline' size='sm' disabled={unassigning}>
                  {unassigning ? (
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  ) : (
                    <UserX className='h-4 w-4 mr-2' />
                  )}
                  <span className='hidden sm:inline'>Sin asignar</span>
                  <span className='sm:hidden'>Desasignar</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Desasignar técnico?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se removerá a <strong>{ticket.assignee.name}</strong> de este ticket y el estado volverá a "Abierto".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnassign}>
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            // Sin técnico → mostrar botón de asignación automática
            <AutoAssignment
              ticketId={ticket.id}
              currentAssignee={ticket.assignee}
              onAssignmentComplete={handleAssignmentComplete}
            />
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isEditing ? 'outline' : 'default'}
                  size='sm'
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false)
                      setEditForm({
                        title: ticket.title,
                        description: ticket.description,
                        status: ticket.status,
                        priority: ticket.priority,
                        assigneeId: ticket.assignee?.id || '',
                      })
                    } else {
                      setIsEditing(true)
                      // Resetear formulario con valores actuales
                      setEditForm({
                        title: ticket.title,
                        description: ticket.description,
                        status: ticket.status,
                        priority: ticket.priority,
                        assigneeId: ticket.assignee?.id || '',
                      })
                    }
                  }}
                >
                  {isEditing ? (
                    <>
                      <X className='h-4 w-4 sm:mr-2' />
                      <span className='hidden sm:inline'>Cancelar</span>
                    </>
                  ) : (
                    <>
                      <Edit className='h-4 w-4 sm:mr-2' />
                      <span className='hidden sm:inline'>Editar</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isEditing ? 'Cancelar edición y descartar cambios' : 'Editar información del ticket'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
      {isEditing && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size='sm' onClick={handleSave}>
                <Save className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Guardar</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Guarda los cambios realizados al ticket</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  return (
    <RoleDashboardLayout
      title={`Ticket #${getTicketDisplayCode(ticket)}`}
      subtitle={`Creado ${formatDate(ticket.createdAt)}`}
      headerActions={headerActions}
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Contenido principal */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Información del ticket */}
          <Card>
            <CardHeader>
              <CardTitle>Información del Ticket</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <Label htmlFor='title'>Título</Label>
                {isEditing ? (
                  <Input
                    id='title'
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  />
                ) : (
                  <p className='text-lg font-medium'>{ticket.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor='description'>Descripción</Label>
                {isEditing ? (
                  <Textarea
                    id='description'
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                  />
                ) : (
                  <p className='text-foreground whitespace-pre-wrap'>{ticket.description}</p>
                )}
              </div>

              {isEditing && (
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <Label htmlFor='status'>Estado</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(value) => setEditForm({ ...editForm, status: value as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "ON_HOLD" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map(status => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor='priority'>Prioridad</Label>
                    <Select
                      value={editForm.priority}
                      onValueChange={(value) => setEditForm({ ...editForm, priority: value as "LOW" | "MEDIUM" | "HIGH" | "URGENT" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map(priority => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs para organizar el contenido */}
          <Tabs defaultValue="timeline" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
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
                    <TabsTrigger value="rating">Calificación</TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calificación del cliente y estadísticas del técnico</p>
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
            
            {/* Timeline: sin forceMount/hidden — Radix maneja el montaje correctamente */}
            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline 
                ticketId={ticket.id}
                canAddComments={(session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN') && ticket.status !== 'CLOSED'}
                canViewInternal={session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'}
                refreshKey={timelineRefreshKey}
                onCommentAdded={() => setFileRefreshKey(k => k + 1)}
              />
            </TabsContent>
            
            <TabsContent value="resolution" className="space-y-4">
              <TicketResolutionTracker 
                ticketId={ticket.id}
                canEdit={session?.user?.role === 'ADMIN' || 
                  (session?.user?.role === 'TECHNICIAN' && ticket.assignee?.id === session?.user?.id)}
                mode={session?.user?.role === 'ADMIN' ? 'admin' : 'technician'}
                onPlanChange={() => setTimelineRefreshKey(k => k + 1)}
              />
            </TabsContent>
            
            <TabsContent value="rating" className="space-y-4">
              <TicketRatingSystem 
                ticketId={ticket.id}
                technicianId={ticket.assignee?.id}
                canRate={session?.user?.id === ticket.client.id && 
                  (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')}
                showTechnicianStats={session?.user?.role === 'ADMIN'}
                mode={session?.user?.role === 'ADMIN' ? 'admin' : 'client'}
                onRatingSubmitted={loadTicket}
              />
            </TabsContent>
            
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Archivos Adjuntos</CardTitle>
                  <CardDescription>
                    Gestiona los archivos relacionados con este ticket
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CompactFileManager
                    ticketId={ticket.id}
                    onUploadComplete={loadTicket}
                    disabled={ticket.status === 'CLOSED'}
                    maxFileSize={10}
                    refreshKey={fileRefreshKey}
                  />
                </CardContent>
              </Card>
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
                  <p className='text-sm font-medium'>Cliente</p>
                  <p className='text-sm text-muted-foreground'>{ticket.client.name}</p>
                  <p className='text-xs text-muted-foreground'>{ticket.client.email}</p>
                  {ticket.client.department && (
                    <Badge 
                      variant="outline" 
                      className='text-xs mt-1'
                      style={{ 
                        borderColor: (ticket.client.department as any)?.color || '#6B7280',
                        color: (ticket.client.department as any)?.color || '#6B7280'
                      }}
                    >
                      {typeof ticket.client.department === 'string' 
                        ? ticket.client.department 
                        : (ticket.client.department as any)?.name || 'Sin departamento'}
                    </Badge>
                  )}
                  {isEditing && (
                    <p className='text-xs text-amber-600 mt-1'>
                      ⚠️ El cliente no puede ser modificado
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <User className='h-4 w-4 text-muted-foreground' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>Asignado a</p>
                  {isEditing ? (
                    <Select
                      value={editForm.assigneeId || 'unassigned'}
                      onValueChange={value => setEditForm({ ...editForm, assigneeId: value === 'unassigned' ? '' : value })}
                    >
                      <SelectTrigger className='mt-1'>
                        <SelectValue placeholder='Seleccionar técnico' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='unassigned'>Sin asignar</SelectItem>
                        {technicians.map(tech => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : ticket.assignee ? (
                    <>
                      <p className='text-sm text-muted-foreground'>{ticket.assignee.name}</p>
                      <p className='text-xs text-muted-foreground'>{ticket.assignee.email}</p>
                    </>
                  ) : (
                    <p className='text-sm text-muted-foreground'>Sin asignar</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Tag className='h-4 w-4 text-muted-foreground' />
                <div className='flex-1'>
                  <p className='text-sm font-medium'>Categoría</p>
                  {/* La categoría NO es editable - preserva la solicitud original del cliente */}
                  <div className='flex items-center space-x-2 mt-1'>
                    <div
                      className='w-3 h-3 rounded-full'
                      style={{ backgroundColor: ticket.category.color }}
                    />
                    <span className='text-sm text-muted-foreground'>{ticket.category.name}</span>
                  </div>
                  {isEditing && (
                    <p className='text-xs text-amber-600 mt-1'>
                      ⚠️ La categoría no puede ser modificada para preservar la solicitud original
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              <div className='flex items-center space-x-3'>
                <Clock className='h-4 w-4 text-muted-foreground' />
                <div>
                  <p className='text-sm font-medium'>Fechas</p>
                  <p className='text-xs text-muted-foreground'>Creado: {formatDate(ticket.createdAt)}</p>
                  <p className='text-xs text-muted-foreground'>
                    Actualizado: {formatDate(ticket.updatedAt)}
                  </p>
                  {ticket.resolvedAt && (
                    <p className='text-xs text-muted-foreground'>
                      Resuelto: {formatDate(ticket.resolvedAt)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historial */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <History className='h-5 w-5 mr-2' />
                Actividad Reciente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3 max-h-60 overflow-y-auto'>
                {ticket.history && ticket.history.length > 0 ? (
                  <>
                    {ticket.history.slice(0, 5).map(entry => (
                      <div key={entry.id} className='text-sm'>
                        <div className='flex items-center justify-between'>
                          <span className='font-medium'>{entry.user.name}</span>
                          <span className='text-xs text-muted-foreground'>{formatTimeAgo(entry.createdAt)}</span>
                        </div>
                        <p className='text-muted-foreground'>{entry.comment}</p>
                      </div>
                    ))}
                    {ticket.history.length > 5 && (
                      <p className='text-xs text-muted-foreground text-center pt-2'>
                        Ver historial completo en la pestaña "Historial"
                      </p>
                    )}
                  </>
                ) : (
                  <p className='text-sm text-muted-foreground text-center py-4'>
                    No hay actividad reciente
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
