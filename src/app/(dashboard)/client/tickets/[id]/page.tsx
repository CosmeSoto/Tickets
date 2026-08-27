'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Clock,
  User,
  Tag,
  Paperclip,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit,
  Save,
  X,
  Star,
  MapPin,
} from 'lucide-react'

import { TicketDetailLayout } from '@/components/tickets/ticket-detail-layout'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useTicketSSE } from '@/hooks/use-ticket-sse'
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
import {
  useTicketData,
  type Ticket,
  formatDate,
  getStatusConfig,
  getPriorityConfig,
  getTicketDisplayCode,
} from '@/hooks/use-ticket-data'

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
  const stopPollingRef = useRef<(() => void) | null>(null)
  const [timelineKey, setTimelineKey] = useState(0)
  const [fileKey, setFileKey] = useState(0)
  const [ratingKey, setRatingKey] = useState(0)
  const [editForm, setEditForm] = useState({ title: '', description: '' })
  const [showRatingModal, setShowRatingModal] = useState(false)
  const prevStatusRef = useRef<string | null>(null)

  const ticketId = params.id as string

  // Persistir la pestaña activa por ticket — mismo motivo que en las vistas
  // de técnico/admin: si el árbol llega a remontarse, no debe perderse la
  // posición donde estaba el cliente.
  useEffect(() => {
    if (!ticketId) return
    try {
      const saved = sessionStorage.getItem(`ticket-tab:${ticketId}`)
      if (saved) setActiveTab(saved)
    } catch {
      /* sessionStorage no disponible */
    }
  }, [ticketId])
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    try {
      sessionStorage.setItem(`ticket-tab:${ticketId}`, value)
    } catch {
      /* ignore */
    }
  }

  const applyTicketUpdate = useCallback(
    (data: Ticket, opts?: { openRatingIfResolved?: boolean }) => {
      const prevStatus = prevStatusRef.current
      prevStatusRef.current = data.status
      setTicket(data)
      setEditForm({ title: data.title, description: data.description })

      if (prevStatus && (prevStatus !== data.status || opts?.openRatingIfResolved)) {
        setTimelineKey(k => k + 1)
        setRatingKey(k => k + 1)
      }

      if (
        opts?.openRatingIfResolved !== false &&
        prevStatus &&
        prevStatus !== 'RESOLVED' &&
        data.status === 'RESOLVED' &&
        data.source !== 'PATROL'
      ) {
        setShowRatingModal(true)
      }
    },
    []
  )

  const refreshTicketSilent = useCallback(async () => {
    if (!ticketId || ticketId === 'create') return
    try {
      const res = await fetch(`/api/tickets/${ticketId}?_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { success, data } = await res.json()
      if (!success || !data) return
      if (data.client?.id !== session?.user?.id) return
      applyTicketUpdate(data)
    } catch {
      /* ignore */
    }
  }, [ticketId, session?.user?.id, applyTicketUpdate])

  useEffect(() => {
    if (ticketId && ticketId !== 'create' && session?.user?.id) loadTicket()
  }, [ticketId, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tiempo real: resolución → modal de calificación; calificación → ver estrellas
  useTicketSSE(ticketId, refreshTicketSilent)

  // Fallback por si se pierde la conexión SSE
  useEffect(() => {
    if (!ticketId || ticketId === 'create' || !session?.user?.id) return
    const interval = setInterval(() => {
      void refreshTicketSilent()
    }, 30_000)
    return () => clearInterval(interval)
  }, [ticketId, session?.user?.id, refreshTicketSilent])

  const loadTicket = async () => {
    const data = await getTicket(ticketId)
    if (!data) return
    if (data.client?.id !== session?.user?.id) {
      router.push('/unauthorized')
      return
    }
    prevStatusRef.current = data.status
    setTicket(data)
    setEditForm({ title: data.title, description: data.description })
    // Si ya está resuelto al entrar, ofrecer calificar
    if (data.status === 'RESOLVED' && data.source !== 'PATROL') {
      setShowRatingModal(true)
    }
  }

  const handleRatingSubmitted = () => {
    setShowRatingModal(false)
    setTicket(prev =>
      prev ? { ...prev, status: 'CLOSED', closedAt: new Date().toISOString() } : prev
    )
    prevStatusRef.current = 'CLOSED'
    setTimelineKey(k => k + 1)
    setRatingKey(k => k + 1)
    void refreshTicketSilent()
  }

  const handleSave = async () => {
    if (!ticket) return
    const updated = await updateTicket(ticket.id, editForm)
    if (updated) {
      setTicket(updated)
      setIsEditing(false)
    } else
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el ticket',
        variant: 'destructive',
      })
  }

  const handleDelete = async () => {
    if (!ticket) return
    stopPollingRef.current?.()
    setDeleting(true)
    const ok = await deleteTicket(ticket.id)
    if (ok) {
      toast({ title: 'Ticket eliminado' })
      setShowDeleteDialog(false)
      router.push('/client/tickets')
    } else {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el ticket',
        variant: 'destructive',
      })
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  // El skeleton SOLO debe verse en la carga inicial (aún no hay `ticket`) —
  // no en cada recarga en segundo plano con datos ya presentes, que antes
  // desmontaba todo el árbol (Tabs incluidos) y se sentía como que "la
  // pantalla se refresca sola".
  if (loading && !ticket) {
    return (
      <TicketDetailLayout
        title='Cargando ticket...'
        ticketCode=''
        status={{ label: '', color: '' }}
        priority={{ label: '', color: '' }}
        loading={true}
      >
        <div />
      </TicketDetailLayout>
    )
  }

  if (!ticket) {
    return (
      <TicketDetailLayout
        title='Ticket no encontrado'
        ticketCode=''
        status={{ label: '', color: '' }}
        priority={{ label: '', color: '' }}
      >
        <div className='text-center py-12'>
          <AlertCircle className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
          <p className='text-muted-foreground mb-4'>No se pudo cargar el ticket</p>
          <Button onClick={() => router.push('/client/tickets')}>Volver a Mis Tickets</Button>
        </div>
      </TicketDetailLayout>
    )
  }

  const canEdit = ticket.status === 'OPEN'
  const canDelete = ticket.status === 'OPEN' && !ticket.assignee

  return (
    <TicketDetailLayout
      title={ticket.title}
      ticketCode={getTicketDisplayCode(ticket)}
      status={getStatusConfig(ticket.status) ?? { label: ticket.status, color: '' }}
      priority={getPriorityConfig(ticket.priority) ?? { label: ticket.priority, color: '' }}
      headerActions={
        <div className='flex items-center gap-2'>
          {canEdit && !isEditing && (
            <Button variant='outline' size='sm' onClick={() => setIsEditing(true)}>
              <Edit className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Editar</span>
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setIsEditing(false)
                  setEditForm({ title: ticket.title, description: ticket.description })
                }}
              >
                <X className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Cancelar</span>
              </Button>
              <Button size='sm' onClick={handleSave}>
                <Save className='h-4 w-4 sm:mr-2' />
                <span className='hidden sm:inline'>Guardar</span>
              </Button>
            </>
          )}
          {canDelete && !isEditing && (
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
      }
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Columna principal */}
        <div className='lg:col-span-2 space-y-4'>
          {/* Descripción */}
          <Card>
            <CardContent className='pt-5 space-y-3'>
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor='title'>Título</Label>
                    <Input
                      id='title'
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      className='mt-1'
                    />
                  </div>
                  <div>
                    <Label htmlFor='desc'>Descripción</Label>
                    <Textarea
                      id='desc'
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      rows={5}
                      className='mt-1'
                    />
                  </div>
                  <p className='text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2'>
                    Solo puedes editar mientras el ticket no haya sido asignado.
                  </p>
                </>
              ) : (
                <>
                  <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                    {ticket.description}
                  </p>
                  {(ticket as any).location && (
                    <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2'>
                      <MapPin className='h-4 w-4 text-amber-600 mt-0.5 shrink-0' />
                      <div>
                        <p className='text-xs font-semibold text-amber-700'>
                          Ubicación del problema
                        </p>
                        <p className='text-sm text-amber-800'>{(ticket as any).location}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Banner: ticket resuelto */}
          {ticket.status === 'RESOLVED' && ticket.source !== 'PATROL' && (
            <Card className='border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700'>
              <CardContent className='pt-5 flex items-start gap-3'>
                <Star className='h-5 w-5 text-amber-600 shrink-0 mt-0.5' />
                <div>
                  <p className='font-semibold text-amber-900 dark:text-amber-100'>
                    Tu ticket ha sido resuelto
                  </p>
                  <p className='text-sm text-amber-800 dark:text-amber-200 mt-1'>
                    Por favor califica el servicio para cerrar el ticket.
                  </p>
                  <Button
                    size='sm'
                    className='mt-2 bg-amber-600 hover:bg-amber-700 text-white'
                    onClick={() => setShowRatingModal(true)}
                  >
                    <Star className='h-4 w-4 mr-2' />
                    Calificar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Banner informativo: ticket de rondas resuelto (agente no califica) */}
          {ticket.status === 'RESOLVED' && ticket.source === 'PATROL' && (
            <Card className='border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-700'>
              <CardContent className='pt-5 flex items-start gap-3'>
                <CheckCircle className='h-5 w-5 text-green-600 shrink-0 mt-0.5' />
                <div>
                  <p className='font-semibold text-green-900 dark:text-green-100'>
                    Novedad resuelta
                  </p>
                  <p className='text-sm text-green-800 dark:text-green-200 mt-1'>
                    La novedad que reportaste ha sido atendida y resuelta. El supervisor se
                    encargará de cerrar el seguimiento.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='timeline'>Historial</TabsTrigger>
              <TabsTrigger value='files'>Archivos</TabsTrigger>
            </TabsList>
            <TabsContent
              value='timeline'
              forceMount
              className='space-y-4 data-[state=inactive]:hidden'
            >
              <TicketTimeline
                ticketId={ticket.id}
                canAddComments={ticket.status !== 'CLOSED'}
                canViewInternal={false}
                refreshKey={timelineKey}
                onCommentAdded={() => setFileKey(k => k + 1)}
                onStopPolling={fn => {
                  stopPollingRef.current = fn
                }}
              />
            </TabsContent>
            <TabsContent value='files' className='space-y-4'>
              <CompactFileManager
                ticketId={ticket.id}
                onUploadComplete={loadTicket}
                disabled={ticket.status === 'CLOSED'}
                refreshKey={fileKey}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className='space-y-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>Detalles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 pt-0 text-sm'>
              <div className='flex items-start gap-2'>
                <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Asignado a</p>
                  <p>
                    {ticket.assignee?.name ?? (
                      <span className='text-muted-foreground'>Pendiente</span>
                    )}
                  </p>
                </div>
              </div>
              <Separator />
              <div className='flex items-start gap-2'>
                <Tag className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Categoría</p>
                  <div className='flex items-center gap-1.5 mt-0.5'>
                    <div
                      className='w-2.5 h-2.5 rounded-full shrink-0'
                      style={{ backgroundColor: ticket.category?.color || '#6B7280' }}
                    />
                    <span>{ticket.category?.name ?? 'Sin categoría'}</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className='flex items-start gap-2'>
                <Clock className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Fechas</p>
                  <p className='text-xs'>Creado: {formatDate(ticket.createdAt)}</p>
                  <p className='text-xs'>Actualizado: {formatDate(ticket.updatedAt)}</p>
                  {ticket.resolvedAt && (
                    <p className='text-xs text-green-600'>
                      Resuelto: {formatDate(ticket.resolvedAt)}
                    </p>
                  )}
                </div>
              </div>
              {ticket._count && (
                <>
                  <Separator />
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-muted-foreground flex items-center gap-1.5'>
                      <Paperclip className='h-3.5 w-3.5' />
                      Archivos
                    </span>
                    <Badge variant='outline' className='text-xs'>
                      {ticket._count.attachments || 0}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Calificación */}
          <TicketRatingSystem
            key={`sidebar-rating-${ratingKey}`}
            ticketId={ticket.id}
            technicianId={ticket.assignee?.id}
            canRate={
              ticket.source !== 'PATROL' &&
              (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')
            }
            showTechnicianStats={false}
            mode='client'
            refreshKey={ratingKey}
            onRatingSubmitted={handleRatingSubmitted}
          />
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ticket?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || !canDelete}
              className='bg-red-600 hover:bg-red-700'
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Calificación */}
      <AlertDialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <AlertDialogContent className='max-w-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <Star className='h-5 w-5 text-amber-600' />
              Califica el servicio
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tu opinión ayuda a mejorar la calidad de nuestro soporte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='max-h-[60vh] overflow-y-auto'>
            <TicketRatingSystem
              key={`modal-rating-${ratingKey}`}
              ticketId={ticket.id}
              technicianId={ticket.assignee?.id}
              canRate={
                ticket.source !== 'PATROL' &&
                (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')
              }
              showTechnicianStats={false}
              mode='client'
              refreshKey={ratingKey}
              onRatingSubmitted={handleRatingSubmitted}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TicketDetailLayout>
  )
}
