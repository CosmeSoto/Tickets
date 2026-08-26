'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertCircle, Star } from 'lucide-react'
import { TicketDetailLayout } from '@/components/tickets/ticket-detail-layout'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useTicketData,
  useUserData,
  type Ticket,
  getStatusConfig,
  getPriorityConfig,
  getTicketDisplayCode,
} from '@/hooks/use-ticket-data'
import { useToast } from '@/hooks/use-toast'
import { useTicketSSE } from '@/hooks/use-ticket-sse'
import {
  HeaderActions,
  DescriptionCard,
  StatusControlCard,
  SidebarDetailsCard,
} from '@/components/tickets/admin-detail'

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { getResolvers } = useUserData()
  const { toast } = useToast()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const initialRatingPromptDone = useRef(false)
  const [resolvers, setResolvers] = useState<any[]>([])
  const [filteredResolvers, setFilteredResolvers] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [unassigning, setUnassigning] = useState(false)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [timelineKey, setTimelineKey] = useState(0)
  const [fileKey, setFileKey] = useState(0)
  const [ratingKey, setRatingKey] = useState(0)
  const [newStatus, setNewStatus] = useState<Ticket['status']>('OPEN')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const prevStatusRef = useRef<string | null>(null)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '' as Ticket['status'],
    priority: '' as Ticket['priority'],
    assigneeId: '',
  })

  const ticketId = params.id as string

  useEffect(() => {
    if (ticketId && ticketId !== 'create') {
      loadTicket()
      getResolvers().then(setResolvers)
    }
  }, [ticketId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtrar resolvers por familia del ticket cuando ambos estén disponibles
  useEffect(() => {
    if (!ticket || resolvers.length === 0) {
      setFilteredResolvers(resolvers)
      return
    }
    const familyId = (ticket as any).familyId
    if (!familyId) {
      // Sin familia: mostrar todos
      setFilteredResolvers(resolvers)
      return
    }
    // Cargar técnicos válidos para esta familia desde la API (misma semántica
    // de elegibilidad que "Agregar resolutor" en Categorías: departamento
    // nativo, o acceso concedido vía user_family_access, módulo 'tickets')
    fetch(
      `/api/users?roles=TECHNICIAN&isActive=true&familyId=${familyId}&purpose=categoryResolvers`
    )
      .then(r => r.json())
      .then(data => {
        const validTechIds = new Set<string>((data.data ?? []).map((u: any) => u.id))
        // Admins siempre son elegibles; técnicos solo si tienen asignación activa a la familia
        const filtered = resolvers.filter(r => r.role === 'ADMIN' || validTechIds.has(r.id))
        // Defensivo: el técnico/admin ya asignado al ticket nunca debe
        // desaparecer del selector, aunque el fetch de elegibilidad no lo
        // incluya (p. ej. cambió de departamento/grant después de asignarse).
        const currentAssigneeId = (ticket as any)?.assignee?.id
        if (currentAssigneeId && !filtered.some(r => r.id === currentAssigneeId)) {
          const current = resolvers.find(r => r.id === currentAssigneeId)
          if (current) filtered.push(current)
        }
        setFilteredResolvers(filtered)
      })
      .catch(() => setFilteredResolvers(resolvers))
  }, [ticket, resolvers])

  const getRaterId = useCallback((data: Ticket) => {
    return data.source === 'PATROL' && data.createdById ? data.createdById : data.client?.id
  }, [])

  const refreshTicketSilent = useCallback(async () => {
    if (!ticketId || ticketId === 'create' || unassigning || assignmentDialogOpen) return
    try {
      const res = await fetch(`/api/tickets/${ticketId}?_t=${Date.now()}`, { cache: 'no-store' })
      if (res.status === 404) {
        router.push('/admin/tickets')
        return
      }
      if (!res.ok) return
      const { success, data } = await res.json()
      if (!success || !data) return
      const prevStatus = prevStatusRef.current
      prevStatusRef.current = data.status
      setTicket(data)
      setNewStatus(data.status)
      setEditForm({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assignee?.id || '',
      })
      if (prevStatus && (prevStatus !== data.status || data.status === 'CLOSED')) {
        setTimelineKey(k => k + 1)
        setRatingKey(k => k + 1)
      }
      // Al pasar a RESOLVED, abrir modal si este admin es quien debe calificar
      if (
        prevStatus &&
        prevStatus !== 'RESOLVED' &&
        data.status === 'RESOLVED' &&
        session?.user?.id &&
        session.user.id === getRaterId(data)
      ) {
        setShowRatingModal(true)
      }
    } catch {
      /* ignore */
    }
  }, [ticketId, unassigning, assignmentDialogOpen, router, session?.user?.id, getRaterId])

  useTicketSSE(ticketId, refreshTicketSilent)

  // Fallback si se pierde SSE
  useEffect(() => {
    if (!ticketId || ticketId === 'create') return
    const interval = setInterval(() => {
      void refreshTicketSilent()
    }, 30_000)
    return () => clearInterval(interval)
  }, [ticketId, refreshTicketSilent])

  const loadTicket = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/tickets/${ticketId}?_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setTicket(null)
        setLoadError({
          status: res.status,
          message:
            typeof body?.message === 'string'
              ? body.message
              : res.status === 403
                ? 'No tienes permisos para ver este ticket'
                : 'No se pudo cargar el ticket',
        })
        return
      }
      const { success, data } = await res.json()
      if (success && data) {
        prevStatusRef.current = data.status
        setTicket(data)
        setNewStatus(data.status)
        setEditForm({
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assigneeId: data.assignee?.id || '',
        })
        // Primera carga: si ya está resuelto y este usuario debe calificar, abrir modal
        if (
          !initialRatingPromptDone.current &&
          data.status === 'RESOLVED' &&
          session?.user?.id &&
          session.user.id ===
            (data.source === 'PATROL' && data.createdById ? data.createdById : data.client?.id)
        ) {
          initialRatingPromptDone.current = true
          setShowRatingModal(true)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForceClose = async () => {
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' }),
    })
    if (res.ok) {
      await loadTicket()
      setTimelineKey(k => k + 1)
      setRatingKey(k => k + 1)
    }
  }

  const handleStatusUpdate = async (targetStatus?: Ticket['status']) => {
    if (!ticket) return
    const statusToApply = targetStatus ?? newStatus
    if (statusToApply === ticket.status) return
    setUpdatingStatus(true)
    setNewStatus(statusToApply)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusToApply }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const prevStatus = ticket.status
        await loadTicket()
        setTimelineKey(k => k + 1)
        setRatingKey(k => k + 1)
        // Quien debe calificar (PATROL → quien escaló; WEB → solicitante) ve el modal al instante
        const raterId =
          ticket.source === 'PATROL' && ticket.createdById ? ticket.createdById : ticket.client?.id
        if (
          prevStatus !== 'RESOLVED' &&
          statusToApply === 'RESOLVED' &&
          session?.user?.id === raterId
        ) {
          setShowRatingModal(true)
        }
      } else {
        toast({
          title: 'Error al actualizar estado',
          description: data.message || 'Intenta nuevamente',
          variant: 'destructive',
        })
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSave = async () => {
    if (!ticket) return
    setSaveError(null)
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, assigneeId: editForm.assigneeId || null }),
    })
    const json = await res.json()
    if (res.ok && json.success && json.data) {
      setTicket(json.data)
      setEditForm({
        title: json.data.title,
        description: json.data.description,
        status: json.data.status,
        priority: json.data.priority,
        assigneeId: json.data.assignee?.id || '',
      })
      setIsEditing(false)
      setTimelineKey(k => k + 1)
    } else {
      const msg = json.message || 'Error al guardar el ticket'
      setSaveError(msg)
    }
  }

  const handleUnassign = async () => {
    if (!ticket) return
    setUnassigning(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: null,
          comment: 'Técnico desasignado por administrador',
        }),
      })
      if (res.ok) {
        setTicket(prev => (prev ? { ...prev, assignee: undefined, status: 'OPEN' } : prev))
        setTimelineKey(k => k + 1)
        await loadTicket()
      }
    } finally {
      setUnassigning(false)
    }
  }

  const cancelEdit = () => {
    if (!ticket) return
    setSaveError(null)
    setEditForm({
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assigneeId: ticket.assignee?.id || '',
    })
    setIsEditing(false)
  }

  const handleEditFormChange = (field: any, value: string) => {
    setEditForm(f => ({ ...f, [field]: value }))
  }

  if (loading && !ticket) {
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
    const isForbidden = loadError?.status === 403
    return (
      <TicketDetailLayout
        title={isForbidden ? 'Sin permiso' : 'Ticket no encontrado'}
        ticketCode=''
        status={{ label: '', color: '' }}
        priority={{ label: '', color: '' }}
      >
        <div className='text-center py-12'>
          <AlertCircle className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
          <p className='text-muted-foreground mb-4'>
            {loadError?.message ??
              (isForbidden
                ? 'No tienes permisos para ver este ticket en tu área'
                : 'No se pudo cargar el ticket')}
          </p>
          <Button onClick={() => router.push('/admin/tickets')}>Volver a Tickets</Button>
        </div>
      </TicketDetailLayout>
    )
  }

  const isSuperAdmin = (session as any)?.user?.isSuperAdmin === true
  const isRequester = ticket.client?.id === session?.user?.id
  const ratingUserId =
    ticket.source === 'PATROL' && ticket.createdById ? ticket.createdById : ticket.client?.id
  const ratingUserName =
    ticket.source === 'PATROL' && ticket.createdBy?.name
      ? ticket.createdBy.name
      : ticket.client?.name
  const canRateTicket =
    !!session?.user?.id &&
    session.user.id === ratingUserId &&
    (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')

  return (
    <TicketDetailLayout
      title={ticket.title}
      ticketCode={getTicketDisplayCode(ticket)}
      status={getStatusConfig(ticket.status) ?? { label: ticket.status, color: '' }}
      priority={getPriorityConfig(ticket.priority) ?? { label: ticket.priority, color: '' }}
      headerActions={
        <HeaderActions
          ticket={ticket}
          isEditing={isEditing}
          unassigning={unassigning}
          assignmentDialogOpen={assignmentDialogOpen}
          sessionUser={session?.user as any}
          onEdit={() => setIsEditing(true)}
          onCancelEdit={cancelEdit}
          onSave={handleSave}
          onUnassign={handleUnassign}
          onAssignmentComplete={async () => {
            await loadTicket()
            setTimelineKey(k => k + 1)
          }}
          onAssignmentOpenChange={setAssignmentDialogOpen}
        />
      }
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-2 space-y-4'>
          <DescriptionCard
            ticket={ticket}
            isEditing={isEditing}
            saveError={saveError}
            editForm={editForm}
            onEditFormChange={handleEditFormChange}
          />

          {ticket.status === 'RESOLVED' && session?.user?.id !== ratingUserId && (
            <Card className='border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'>
              <CardContent className='pt-4 pb-4 flex items-start gap-3'>
                <AlertCircle className='h-5 w-5 text-amber-600 shrink-0 mt-0.5' />
                <div>
                  <p className='font-medium text-amber-900 dark:text-amber-100 text-sm'>
                    Esperando calificación del solicitante
                  </p>
                  <p className='text-xs text-amber-800 dark:text-amber-200 mt-0.5'>
                    El ticket se cerrará automáticamente cuando <strong>{ratingUserName}</strong>{' '}
                    envíe su calificación.
                    {ticket.source === 'PATROL' && (
                      <> (supervisor que escaló la novedad desde rondas)</>
                    )}
                    {isSuperAdmin &&
                      ' Como Super Admin puedes cerrarlo directamente desde el botón en el encabezado.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue='timeline'>
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
                canEdit
                mode='admin'
                onPlanChange={() => setTimelineKey(k => k + 1)}
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

        <div className='space-y-4'>
          <StatusControlCard
            ticket={ticket}
            isRequester={isRequester}
            isSuperAdmin={isSuperAdmin}
            updatingStatus={updatingStatus}
            newStatus={newStatus}
            onStatusUpdate={handleStatusUpdate}
            onForceClose={handleForceClose}
          />

          <SidebarDetailsCard
            ticket={ticket}
            isEditing={isEditing}
            editForm={editForm}
            filteredResolvers={filteredResolvers}
            onEditFormChange={handleEditFormChange}
          />

          {/* Calificación */}
          <TicketRatingSystem
            key={`admin-rating-${ratingKey}`}
            ticketId={ticket.id}
            technicianId={ticket.assignee?.id}
            canRate={canRateTicket}
            showTechnicianStats
            mode='admin'
            refreshKey={ratingKey}
            onRatingSubmitted={() => {
              setShowRatingModal(false)
              setRatingKey(k => k + 1)
              void loadTicket()
            }}
          />

          {ticket.status === 'RESOLVED' && canRateTicket && !showRatingModal && (
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
              key={`admin-modal-rating-${ratingKey}`}
              ticketId={ticket.id}
              technicianId={ticket.assignee?.id}
              canRate={canRateTicket}
              showTechnicianStats={false}
              mode='admin'
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
