'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Clock, User, Tag, Edit, Save, X, AlertCircle, BookOpen, Lightbulb, Loader2, UserX, MapPin } from 'lucide-react'

import { TicketDetailLayout } from '@/components/tickets/ticket-detail-layout'
import { AutoAssignment } from '@/components/tickets/auto-assignment'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { TicketCollaborators } from '@/components/tickets/ticket-collaborators'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  useTicketData, useUserData, type Ticket, TICKET_STATUSES, TICKET_PRIORITIES,
  formatDate, getStatusConfig, getPriorityConfig, getTicketDisplayCode,
} from '@/hooks/use-ticket-data'

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { getTechnicians } = useUserData()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [technicians, setTechnicians] = useState<any[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false)
  const [timelineKey, setTimelineKey] = useState(0)
  const [fileKey, setFileKey] = useState(0)
  const [editForm, setEditForm] = useState({
    title: '', description: '',
    status: '' as Ticket['status'],
    priority: '' as Ticket['priority'],
    assigneeId: '',
  })

  const ticketId = params.id as string

  useEffect(() => {
    if (ticketId && ticketId !== 'create') {
      loadTicket()
      getTechnicians().then(setTechnicians)
    }
  }, [ticketId])

  // Polling
  useEffect(() => {
    if (!ticketId || ticketId === 'create') return
    let stopped = false
    const interval = setInterval(async () => {
      if (stopped || unassigning || assignmentDialogOpen) return
      try {
        const res = await fetch(`/api/tickets/${ticketId}`, { cache: 'no-store' })
        if (res.status === 404) { stopped = true; router.push('/admin/tickets'); return }
        if (!res.ok) return
        const { success, data } = await res.json()
        if (!success || !data) return
        setTicket(prev => {
          if (!prev || (prev.status === data.status && prev.updatedAt === data.updatedAt && prev.assignee?.id === data.assignee?.id)) return prev
          setEditForm({ title: data.title, description: data.description, status: data.status, priority: data.priority, assigneeId: data.assignee?.id || '' })
          return data
        })
      } catch {}
    }, 10000)
    return () => { stopped = true; clearInterval(interval) }
  }, [ticketId, unassigning, assignmentDialogOpen, router])

  const loadTicket = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tickets/${ticketId}?_t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { success, data } = await res.json()
      if (success && data) {
        setTicket(data)
        setEditForm({ title: data.title, description: data.description, status: data.status, priority: data.priority, assigneeId: data.assignee?.id || '' })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!ticket) return
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, assigneeId: editForm.assigneeId || null }),
    })
    const { success, data } = await res.json()
    if (res.ok && success && data) {
      setTicket(data)
      setEditForm({ title: data.title, description: data.description, status: data.status, priority: data.priority, assigneeId: data.assignee?.id || '' })
      setIsEditing(false)
      setTimelineKey(k => k + 1)
    }
  }

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
        setTicket(prev => prev ? { ...prev, assignee: undefined, status: 'OPEN' } : prev)
        setTimelineKey(k => k + 1)
        await loadTicket()
      }
    } finally {
      setUnassigning(false)
    }
  }

  const cancelEdit = () => {
    if (!ticket) return
    setEditForm({ title: ticket.title, description: ticket.description, status: ticket.status, priority: ticket.priority, assigneeId: ticket.assignee?.id || '' })
    setIsEditing(false)
  }

  if (loading && !ticket) {
    return (
      <TicketDetailLayout title="Cargando..." ticketCode="" status={{ label: '', color: '' }} priority={{ label: '', color: '' }} loading>
        <div />
      </TicketDetailLayout>
    )
  }

  if (!ticket) {
    return (
      <TicketDetailLayout title="Ticket no encontrado" ticketCode="" status={{ label: '', color: '' }} priority={{ label: '', color: '' }}>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No se pudo cargar el ticket</p>
          <Button onClick={() => router.push('/admin/tickets')}>Volver a Tickets</Button>
        </div>
      </TicketDetailLayout>
    )
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Artículo de conocimiento */}
      {(ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
        ticket.knowledgeArticleId ? (
          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/knowledge/${ticket.knowledgeArticleId}`)}>
            <BookOpen className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Ver Artículo</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => router.push(`/admin/knowledge/new?fromTicket=${ticket.id}`)}>
            <Lightbulb className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Crear Artículo</span>
          </Button>
        )
      )}
      {/* Asignación */}
      {ticket.assignee ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={unassigning}>
              {unassigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Desasignar</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desasignar técnico?</AlertDialogTitle>
              <AlertDialogDescription>Se removerá a <strong>{ticket.assignee.name}</strong> y el estado volverá a "Abierto".</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnassign}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <AutoAssignment ticketId={ticket.id} currentAssignee={ticket.assignee} onAssignmentComplete={async () => { await loadTicket(); setTimelineKey(k => k + 1) }} onOpenChange={setAssignmentDialogOpen} />
      )}
      {/* Editar */}
      {!isEditing ? (
        <Button size="sm" onClick={() => setIsEditing(true)}>
          <Edit className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Editar</span>
        </Button>
      ) : (
        <>
          <Button variant="outline" size="sm" onClick={cancelEdit}>
            <X className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Cancelar</span>
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Guardar</span>
          </Button>
        </>
      )}
    </div>
  )

  return (
    <TicketDetailLayout
      title={ticket.title}
      ticketCode={getTicketDisplayCode(ticket)}
      status={getStatusConfig(ticket.status)}
      priority={getPriorityConfig(ticket.priority)}
      headerActions={headerActions}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Descripción */}
          <Card>
            <CardContent className="pt-5 space-y-3">
              {isEditing ? (
                <>
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input id="title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="desc">Descripción</Label>
                    <Textarea id="desc" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} className="mt-1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Estado</Label>
                      <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v as Ticket['status'] }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{TICKET_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Prioridad</Label>
                      <Select value={editForm.priority} onValueChange={v => setEditForm(f => ({ ...f, priority: v as Ticket['priority'] }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>{TICKET_PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
                  {(ticket as any).location && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
                      <MapPin className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">Ubicación del problema</p>
                        <p className="text-sm text-amber-800">{(ticket as any).location}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="timeline">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="timeline">Historial</TabsTrigger>
              <TabsTrigger value="resolution">Plan</TabsTrigger>
              <TabsTrigger value="rating">Calificación</TabsTrigger>
              <TabsTrigger value="files">Archivos</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline ticketId={ticket.id} canAddComments={ticket.status !== 'CLOSED'} canViewInternal refreshKey={timelineKey} onCommentAdded={() => setFileKey(k => k + 1)} />
            </TabsContent>

            <TabsContent value="resolution" className="space-y-4">
              <TicketResolutionTracker ticketId={ticket.id} canEdit mode="admin" onPlanChange={() => setTimelineKey(k => k + 1)} />
            </TabsContent>

            <TabsContent value="rating" className="space-y-4">
              <TicketRatingSystem ticketId={ticket.id} technicianId={ticket.assignee?.id} canRate={session?.user?.id === ticket.client.id && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED')} showTechnicianStats mode="admin" onRatingSubmitted={loadTicket} />
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <CompactFileManager ticketId={ticket.id} onUploadComplete={loadTicket} disabled={ticket.status === 'CLOSED'} maxFileSize={10} refreshKey={fileKey} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              {/* Cliente */}
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{ticket.client.name}</p>
                  <p className="text-xs text-muted-foreground">{ticket.client.email}</p>
                  {ticket.client.department && (
                    <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: (ticket.client.department as any)?.color || '#6B7280', color: (ticket.client.department as any)?.color || '#6B7280' }}>
                      {typeof ticket.client.department === 'string' ? ticket.client.department : (ticket.client.department as any)?.name}
                    </Badge>
                  )}
                </div>
              </div>
              <Separator />
              {/* Asignado */}
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Asignado a</p>
                  {isEditing ? (
                    <Select value={editForm.assigneeId || 'unassigned'} onValueChange={v => setEditForm(f => ({ ...f, assigneeId: v === 'unassigned' ? '' : v }))}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <p>{ticket.assignee?.name ?? <span className="text-muted-foreground">Sin asignar</span>}</p>
                      {ticket.assignee && <p className="text-xs text-muted-foreground">{ticket.assignee.email}</p>}
                    </>
                  )}
                </div>
              </div>
              <Separator />
              {/* Colaboradores */}
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <TicketCollaborators ticketId={ticket.id} familyId={(ticket as any).familyId} assigneeId={ticket.assignee?.id} canManage />
              </div>
              <Separator />
              {/* Categoría */}
              <div className="flex items-start gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Categoría</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ticket.category.color }} />
                    <span>{ticket.category.name}</span>
                  </div>
                </div>
              </div>
              <Separator />
              {/* Fechas */}
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Fechas</p>
                  <p className="text-xs">Creado: {formatDate(ticket.createdAt)}</p>
                  <p className="text-xs">Actualizado: {formatDate(ticket.updatedAt)}</p>
                  {ticket.resolvedAt && <p className="text-xs text-green-600">Resuelto: {formatDate(ticket.resolvedAt)}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TicketDetailLayout>
  )
}
