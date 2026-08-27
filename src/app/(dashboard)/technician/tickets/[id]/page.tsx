'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Clock,
  User,
  Tag,
  AlertCircle,
  BookOpen,
  Lightbulb,
  Star,
  CheckCircle,
  MapPin,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

import { TicketDetailLayout } from '@/components/tickets/ticket-detail-layout'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useTicketSSE } from '@/hooks/use-ticket-sse'
import {
  useTicketData,
  type Ticket,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  formatDate,
  getTicketDisplayCode,
} from '@/hooks/use-ticket-data'

// Colores y etiquetas por estado
const STATUS_CONFIG: Record<string, { label: string; dot: string; card: string; btn: string }> = {
  OPEN: {
    label: 'Abierto',
    dot: 'bg-orange-500',
    card: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950',
    btn: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  IN_PROGRESS: {
    label: 'En Progreso',
    dot: 'bg-yellow-500',
    card: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    btn: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  RESOLVED: {
    label: 'Resuelto',
    dot: 'bg-green-500',
    card: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    btn: 'bg-green-600 hover:bg-green-700 text-white',
  },
  ON_HOLD: {
    label: 'En Espera',
    dot: 'bg-purple-500',
    card: 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950',
    btn: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
  CLOSED: {
    label: 'Cerrado',
    dot: 'bg-gray-500',
    card: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950',
    btn: 'bg-gray-500 hover:bg-gray-600 text-white',
  },
}

// Transiciones permitidas para técnico asignado
const TECH_TRANSITIONS: Record<
  string,
  { value: Ticket['status']; label: string; primary?: boolean }[]
> = {
  OPEN: [{ value: 'IN_PROGRESS', label: 'Tomar ticket', primary: true }],
  IN_PROGRESS: [
    { value: 'RESOLVED', label: 'Marcar resuelto', primary: true },
    { value: 'ON_HOLD', label: 'Poner en espera' },
  ],
  ON_HOLD: [{ value: 'IN_PROGRESS', label: 'Reanudar', primary: true }],
  RESOLVED: [{ value: 'IN_PROGRESS', label: 'Reabrir', primary: false }],
  CLOSED: [],
}

export default function TechnicianTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const { getTicket } = useTicketData()
  const { toast } = useToast()

  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null) // guarda el status que se está aplicando
  const [timelineKey, setTimelineKey] = useState(0)
  const [fileKey, setFileKey] = useState(0)
  const [ratingKey, setRatingKey] = useState(0)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const initialRatingPromptDone = useRef(false)
  // Evita recargar el ticket (y mostrar el skeleton "Cargando...") cada vez que
  // `session` recibe una referencia nueva por el refetch periódico de NextAuth
  // (~5 min, foco de ventana, o el sync de actividad de SessionTimeoutMonitor
  // cada ~60s) — mismo patrón que admin/settings y admin/backups.
  const ticketLoadedRef = useRef<string | null>(null)
  // Pestaña activa (Historial/Plan/Archivos), persistida por ticket. Los Tabs de
  // Radix son "no controlados" con defaultValue='timeline': si por cualquier
  // motivo el árbol bajo <TicketDetailLayout> llega a remontarse (p. ej. una
  // recarga silenciosa que deje `loading` en true un instante), pierden su
  // estado interno y vuelven siempre a "Historial" — sacando al técnico de la
  // pestaña "Plan" en medio de la edición. Controlar el valor y guardarlo en
  // sessionStorage hace que la posición sobreviva a cualquier remount.
  const [activeTab, setActiveTab] = useState('timeline')

  const isAssignedResolver = ticket?.assignee?.id === session?.user?.id
  const isUnassigned = !ticket?.assignee
  const canAct = isAssignedResolver || isUnassigned // puede actuar si es el asignado o si no hay asignado
  const canCreateArticle =
    isAssignedResolver && (ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED')
  const hasArticle = !!ticket?.knowledgeArticleId
  const isRequester = ticket?.client?.id === session?.user?.id
  const ratingUserId =
    ticket?.source === 'PATROL' && ticket?.createdById ? ticket.createdById : ticket?.client?.id
  const ratingUserLabel = ticket?.source === 'PATROL' ? 'supervisor' : 'cliente'
  // Para tickets escalados desde rondas, el que califica es el createdById (admin que escaló),
  // no el agente (clientId). El agente solo ve que fue resuelta.
  const canRate =
    ticket?.source === 'PATROL' && ticket?.createdById
      ? session?.user?.id === ticket.createdById &&
        (ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED')
      : isRequester && (ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED')

  useEffect(() => {
    if (authStatus === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'TECHNICIAN') {
      router.push('/login')
      return
    }
    if (ticketId && ticketLoadedRef.current !== ticketId) {
      ticketLoadedRef.current = ticketId
      loadTicket()
    }
  }, [authStatus, session?.user?.id, session?.user?.role, ticketId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restaurar la pestaña activa guardada para este ticket (ver comentario junto
  // a activeTab más arriba).
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

  const refreshTicketSilent = useCallback(async () => {
    if (!ticketId) return
    try {
      const res = await fetch(`/api/tickets/${ticketId}?_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { success, data } = await res.json()
      if (!success || !data) return
      const prevStatus = prevStatusRef.current
      prevStatusRef.current = data.status
      setTicket(data)
      if (prevStatus && (prevStatus !== data.status || data.status === 'CLOSED')) {
        setTimelineKey(k => k + 1)
        setRatingKey(k => k + 1)
      }
      const raterId =
        data.source === 'PATROL' && data.createdById ? data.createdById : data.client?.id
      if (
        prevStatus &&
        prevStatus !== 'RESOLVED' &&
        data.status === 'RESOLVED' &&
        session?.user?.id === raterId
      ) {
        setShowRatingModal(true)
      }
    } catch {
      /* ignore */
    }
  }, [ticketId, session?.user?.id])

  useTicketSSE(ticketId, refreshTicketSilent)

  useEffect(() => {
    if (!ticketId || loading) return
    const interval = setInterval(() => {
      void refreshTicketSilent()
    }, 30_000)
    return () => clearInterval(interval)
  }, [ticketId, loading, refreshTicketSilent])

  const loadTicket = async () => {
    setLoading(true)
    const data = await getTicket(ticketId)
    if (data) {
      prevStatusRef.current = data.status
      setTicket(data)
      const raterId =
        data.source === 'PATROL' && data.createdById ? data.createdById : data.client?.id
      if (
        !initialRatingPromptDone.current &&
        data.status === 'RESOLVED' &&
        session?.user?.id === raterId
      ) {
        initialRatingPromptDone.current = true
        setShowRatingModal(true)
      }
    }
    setLoading(false)
  }

  const handleStatusChange = async (newStatus: Ticket['status']) => {
    if (!ticket) return
    setUpdating(newStatus)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)
      const prevStatus = ticket.status
      // Recargar para obtener el estado actualizado (incluyendo posible auto-asignación)
      await loadTicket()
      setTimelineKey(k => k + 1)
      setRatingKey(k => k + 1)
      const raterId =
        ticket.source === 'PATROL' && ticket.createdById ? ticket.createdById : ticket.client?.id
      if (prevStatus !== 'RESOLVED' && newStatus === 'RESOLVED' && session?.user?.id === raterId) {
        setShowRatingModal(true)
      }
      const cfg = STATUS_CONFIG[newStatus]
      toast({ title: 'Estado actualizado', description: `Ahora: ${cfg?.label ?? newStatus}` })
    } catch (err) {
      toast({
        title: 'Error al actualizar estado',
        description: err instanceof Error ? err.message : 'Intenta nuevamente',
        variant: 'destructive',
      })
    } finally {
      setUpdating(null)
    }
  }

  const getStatusConfig = (s: string) =>
    TICKET_STATUSES.find(x => x.value === s) ?? TICKET_STATUSES[0]
  const getPriorityConfig = (p: string) =>
    TICKET_PRIORITIES.find(x => x.value === p) ?? TICKET_PRIORITIES[0]

  if (authStatus === 'loading' || loading) {
    return (
      <TicketDetailLayout
        title='Cargando...'
        ticketCode=''
        status={{ label: '', color: '' }}
        priority={{ label: '', color: '' }}
        loading
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
          <Button asChild>
            <Link href='/technician/tickets'>Volver a Mis Tickets</Link>
          </Button>
        </div>
      </TicketDetailLayout>
    )
  }

  const statusConfig = getStatusConfig(ticket.status)
  const priorityConfig = getPriorityConfig(ticket.priority)
  const currentStatusCfg = STATUS_CONFIG[ticket.status]
  const transitions =
    canAct && ticket.status !== 'CLOSED' ? (TECH_TRANSITIONS[ticket.status] ?? []) : []

  return (
    <TicketDetailLayout
      title={ticket.title}
      ticketCode={getTicketDisplayCode(ticket)}
      status={statusConfig}
      priority={priorityConfig}
      headerActions={
        canCreateArticle ? (
          hasArticle ? (
            <Button
              variant='outline'
              size='sm'
              onClick={() => router.push(`/technician/knowledge/${ticket.knowledgeArticleId}`)}
            >
              <BookOpen className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Ver Artículo</span>
            </Button>
          ) : (
            <Button
              size='sm'
              className={
                ticket.status === 'CLOSED'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }
              onClick={() => router.push(`/technician/knowledge/new?fromTicket=${ticket.id}`)}
            >
              <Lightbulb className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Crear Artículo</span>
            </Button>
          )
        ) : undefined
      }
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* ── Columna principal ── */}
        <div className='lg:col-span-2 space-y-4'>
          {/* Descripción */}
          <Card>
            <CardContent className='pt-5 space-y-3'>
              <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                {ticket.description}
              </p>
              {(ticket as any).location && (
                <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2'>
                  <MapPin className='h-4 w-4 text-amber-600 mt-0.5 shrink-0' />
                  <div>
                    <p className='text-xs font-semibold text-amber-700'>Ubicación del problema</p>
                    <p className='text-sm text-amber-800'>{(ticket as any).location}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Banner: resuelto esperando calificación */}
          {ticket.status === 'RESOLVED' && session?.user?.id !== ratingUserId && (
            <Card className='border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'>
              <CardContent className='pt-5 flex items-start gap-3'>
                <Star className='h-5 w-5 text-amber-600 shrink-0 mt-0.5' />
                <div>
                  <p className='font-medium text-amber-900 dark:text-amber-100'>
                    Esperando calificación del {ratingUserLabel}
                  </p>
                  <p className='text-sm text-amber-800 dark:text-amber-200 mt-1'>
                    El ticket se cerrará automáticamente cuando el {ratingUserLabel} califique.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Banner: cerrado */}
          {ticket.status === 'CLOSED' && (
            <Card className='border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'>
              <CardContent className='pt-5 flex items-start gap-3'>
                <CheckCircle className='h-5 w-5 text-green-600 shrink-0 mt-0.5' />
                <div>
                  <p className='font-medium text-green-900 dark:text-green-100'>Ticket cerrado</p>
                  <p className='text-sm text-green-700 dark:text-green-300 mt-0.5'>
                    Este ticket ha sido cerrado exitosamente.
                    {canCreateArticle && !hasArticle && (
                      <> Puedes crear un artículo de conocimiento con el botón superior.</>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Calificación cuando el técnico es el solicitante/}

          {/* Tabs — sin el tab de Estado */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='timeline'>Historial</TabsTrigger>
              <TabsTrigger value='resolution'>Plan</TabsTrigger>
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
                canViewInternal
                ticketStatus={ticket.status}
                requireInProgress
                refreshKey={timelineKey}
                onCommentAdded={() => setFileKey(k => k + 1)}
              />
            </TabsContent>

            <TabsContent
              value='resolution'
              forceMount
              className='space-y-4 data-[state=inactive]:hidden'
            >
              <TicketResolutionTracker
                ticketId={ticket.id}
                ticketStatus={ticket.status}
                canEdit={ticket.assignee?.id === session?.user?.id}
                mode='technician'
                onPlanChange={() => setTimelineKey(k => k + 1)}
              />
            </TabsContent>

            <TabsContent value='files' className='space-y-4'>
              <CompactFileManager
                ticketId={ticket.id}
                onAttachmentsChange={loadTicket}
                canUpload={ticket.status !== 'CLOSED'}
                canDelete={ticket.status !== 'CLOSED'}
                refreshKey={fileKey}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Sidebar ── */}
        <div className='space-y-4'>
          {/* ── CONTROL DE ESTADO — siempre visible ── */}
          {ticket.status !== 'CLOSED' && !isRequester && (
            <Card className={`border-2 ${currentStatusCfg?.card ?? ''}`}>
              <CardHeader className='pb-2 pt-4 px-4'>
                <CardTitle className='text-sm font-semibold flex items-center gap-2'>
                  <span
                    className={`inline-block w-2.5 h-2.5 rounded-full ${currentStatusCfg?.dot}`}
                  />
                  Estado actual: {currentStatusCfg?.label ?? ticket.status}
                </CardTitle>
              </CardHeader>
              <CardContent className='px-4 pb-4 space-y-2'>
                {transitions.length > 0 ? (
                  transitions.map(t => (
                    <button
                      key={t.value}
                      onClick={() => handleStatusChange(t.value)}
                      disabled={!!updating}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed
                        ${
                          t.primary
                            ? (STATUS_CONFIG[t.value]?.btn ??
                              'bg-primary text-primary-foreground hover:bg-primary/90')
                            : 'border border-border bg-background hover:bg-muted text-foreground'
                        }`}
                    >
                      <span className='flex items-center gap-2'>
                        {updating === t.value ? (
                          <Loader2 className='h-3.5 w-3.5 animate-spin' />
                        ) : (
                          <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[t.value]?.dot}`} />
                        )}
                        {t.label}
                      </span>
                      <ChevronRight className='h-3.5 w-3.5 opacity-50' />
                    </button>
                  ))
                ) : (
                  <p className='text-xs text-muted-foreground text-center py-1'>
                    {isRequester
                      ? 'Eres el solicitante de este ticket.'
                      : 'No hay acciones disponibles.'}
                  </p>
                )}
                {!canAct && !isRequester && (
                  <p className='text-xs text-muted-foreground bg-muted rounded p-2 text-center'>
                    Solo el técnico asignado puede cambiar el estado.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detalles */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-sm font-semibold'>Detalles</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3 pt-0 text-sm'>
              {/* Cliente */}
              <div className='flex items-center gap-3'>
                <Avatar className='h-8 w-8 shrink-0'>
                  <AvatarImage src={(ticket.client as any)?.avatar} />
                  <AvatarFallback>{ticket.client?.name?.charAt(0) ?? 'C'}</AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                  <p className='text-xs text-muted-foreground'>Cliente</p>
                  <p className='font-medium truncate'>{ticket.client?.name}</p>
                  <p className='text-xs text-muted-foreground truncate'>{ticket.client?.email}</p>
                </div>
              </div>
              <Separator />
              <div className='flex items-start gap-2'>
                <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Asignado a</p>
                  <p>
                    {ticket.assignee?.name ?? (
                      <span className='text-muted-foreground'>Sin asignar</span>
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
            </CardContent>
          </Card>

          {/* Calificación */}
          <TicketRatingSystem
            key={`tech-rating-${ratingKey}`}
            ticketId={ticket.id}
            technicianId={ticket.assignee?.id}
            canRate={canRate}
            mode={isRequester ? 'client' : 'admin'}
            refreshKey={ratingKey}
            onRatingSubmitted={() => {
              setShowRatingModal(false)
              setRatingKey(k => k + 1)
              void loadTicket()
            }}
          />

          {ticket.status === 'RESOLVED' && canRate && !showRatingModal && (
            <Button
              type='button'
              className='w-full bg-amber-600 hover:bg-amber-700 text-white'
              onClick={() => setShowRatingModal(true)}
            >
              <Star className='h-4 w-4 mr-2' />
              Calificar y cerrar ticket
            </Button>
          )}
        </div>
      </div>

      <AlertDialog
        open={showRatingModal}
        onOpenChange={open => {
          setShowRatingModal(open)
          if (!open) initialRatingPromptDone.current = true
        }}
      >
        <AlertDialogContent className='max-w-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <Star className='h-5 w-5 text-amber-600' />
              Califica el servicio
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ticket.source === 'PATROL'
                ? 'Como supervisor que escaló la novedad, califica la resolución para cerrar el ticket.'
                : 'Tu opinión ayuda a mejorar la calidad del soporte. Al calificar se cerrará el ticket.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='max-h-[60vh] overflow-y-auto'>
            <TicketRatingSystem
              key={`tech-modal-rating-${ratingKey}`}
              ticketId={ticket.id}
              technicianId={ticket.assignee?.id}
              canRate={canRate}
              showTechnicianStats={false}
              mode={isRequester ? 'client' : 'admin'}
              refreshKey={ratingKey}
              onRatingSubmitted={() => {
                setShowRatingModal(false)
                setRatingKey(k => k + 1)
                void loadTicket()
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Más tarde</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TicketDetailLayout>
  )
}
