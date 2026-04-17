'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Clock, User, Tag, AlertCircle, Save, BookOpen, Lightbulb, Star, CheckCircle, MapPin } from 'lucide-react'
import Link from 'next/link'

import { TicketDetailLayout } from '@/components/tickets/ticket-detail-layout'
import { TicketTimeline } from '@/components/ui/ticket-timeline'
import { TicketRatingSystem } from '@/components/ui/ticket-rating-system'
import { TicketResolutionTracker } from '@/components/ui/ticket-resolution-tracker'
import { CompactFileManager } from '@/components/tickets/compact-file-manager'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  useTicketData, type Ticket, TICKET_STATUSES, TICKET_PRIORITIES,
  formatDate, getTicketDisplayCode,
} from '@/hooks/use-ticket-data'

export default function TechnicianTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()
  const { getTicket } = useTicketData()
  const { toast } = useToast()

  const ticketId = params.id as string

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState<Ticket['status']>('OPEN')
  const [timelineKey, setTimelineKey] = useState(0)
  const [fileKey, setFileKey] = useState(0)

  const canCreateArticle = (ticket?.status === 'RESOLVED' || ticket?.status === 'CLOSED')
  const hasArticle = !!ticket?.knowledgeArticleId

  useEffect(() => {
    if (authStatus === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'TECHNICIAN') { router.push('/login'); return }
    if (ticketId) loadTicket()
  }, [session, authStatus, ticketId])

  // Polling para detectar cambios (cliente calificó → CLOSED)
  useEffect(() => {
    if (!ticketId || loading) return
    // Polling cada 30s — el SSE notifica cambios en tiempo real
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tickets/${ticketId}`)
        if (!res.ok) return
        const { success, data } = await res.json()
        if (!success || !data) return
        setTicket(prev => {
          if (!prev || (prev.status === data.status && prev.updatedAt === data.updatedAt)) return prev
          setNewStatus(data.status)
          return data
        })
      } catch {}
    }, 30_000)
    return () => clearInterval(interval)
  }, [ticketId, loading])

  const loadTicket = async () => {
    setLoading(true)
    const data = await getTicket(ticketId)
    if (data) { setTicket(data); setNewStatus(data.status) }
    setLoading(false)
  }

  const handleStatusUpdate = async () => {
    if (!ticket || newStatus === ticket.status) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message)
      setTicket(prev => prev ? { ...prev, status: newStatus, updatedAt: data.data.updatedAt, resolvedAt: data.data.resolvedAt ?? prev.resolvedAt } : prev)
      setTimelineKey(k => k + 1)
      toast({ title: 'Estado actualizado', description: `Ahora: ${getStatusLabel(newStatus)}` })
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Intenta nuevamente', variant: 'destructive' })
    } finally {
      setUpdating(false)
    }
  }

  const getStatusLabel = (s: string) => TICKET_STATUSES.find(x => x.value === s)?.label ?? s
  const getStatusConfig = (s: string) => TICKET_STATUSES.find(x => x.value === s) ?? TICKET_STATUSES[0]
  const getPriorityConfig = (p: string) => TICKET_PRIORITIES.find(x => x.value === p) ?? TICKET_PRIORITIES[0]

  const availableStatuses = (): Ticket['status'][] => {
    if (!ticket) return []
    const map: Record<string, Ticket['status'][]> = {
      OPEN: ['OPEN', 'IN_PROGRESS'],
      IN_PROGRESS: ['IN_PROGRESS', 'RESOLVED', 'ON_HOLD'],
      ON_HOLD: ['ON_HOLD', 'IN_PROGRESS'],
      RESOLVED: ['RESOLVED', 'IN_PROGRESS'],
      CLOSED: ['CLOSED'],
    }
    return map[ticket.status] ?? [ticket.status]
  }

  if (authStatus === 'loading' || loading) {
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
          <Button asChild><Link href="/technician/tickets">Volver a Mis Tickets</Link></Button>
        </div>
      </TicketDetailLayout>
    )
  }

  const statusConfig = getStatusConfig(ticket.status)
  const priorityConfig = getPriorityConfig(ticket.priority)

  return (
    <TicketDetailLayout
      title={ticket.title}
      ticketCode={getTicketDisplayCode(ticket)}
      status={statusConfig}
      priority={priorityConfig}
      headerActions={
        canCreateArticle ? (
          hasArticle ? (
            <Button variant="outline" size="sm" onClick={() => router.push(`/technician/knowledge/${ticket.knowledgeArticleId}`)}>
              <BookOpen className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Ver Artículo</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => router.push(`/technician/knowledge/new?fromTicket=${ticket.id}`)}>
              <Lightbulb className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Crear Artículo</span>
            </Button>
          )
        ) : undefined
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-4">
          {/* Descripción */}
          <Card>
            <CardContent className="pt-5 space-y-3">
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
            </CardContent>
          </Card>

          {/* Banners de estado */}
          {ticket.status === 'RESOLVED' && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <CardContent className="pt-5 flex items-start gap-3">
                <Star className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Esperando calificación del cliente</p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">El ticket se cerrará automáticamente cuando el cliente califique.</p>
                </div>
              </CardContent>
            </Card>
          )}
          {ticket.status === 'CLOSED' && (
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardContent className="pt-5 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Ticket cerrado y calificado</p>
                  {!hasArticle && (
                    <Button variant="outline" size="sm" className="mt-2 border-green-300 text-green-800 hover:bg-green-100"
                      onClick={() => router.push(`/technician/knowledge/new?fromTicket=${ticket.id}`)}>
                      <BookOpen className="h-4 w-4 mr-2" />Promover a Artículo
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <Tabs defaultValue="timeline">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="timeline">Historial</TabsTrigger>
              <TabsTrigger value="status">Estado</TabsTrigger>
              <TabsTrigger value="resolution">Plan</TabsTrigger>
              <TabsTrigger value="files">Archivos</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="space-y-4">
              <TicketTimeline ticketId={ticket.id} canAddComments={ticket.status !== 'CLOSED'} canViewInternal refreshKey={timelineKey} onCommentAdded={() => setFileKey(k => k + 1)} />
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              {ticket.status !== 'CLOSED' ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />Actualizar Estado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-3">
                      <Select value={newStatus} onValueChange={v => setNewStatus(v as Ticket['status'])}>
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStatuses().map(s => (
                            <SelectItem key={s} value={s}>
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${
                                  s === 'OPEN' ? 'bg-orange-500' : s === 'IN_PROGRESS' ? 'bg-yellow-500' :
                                  s === 'RESOLVED' ? 'bg-green-500' : s === 'ON_HOLD' ? 'bg-purple-500' : 'bg-gray-500'
                                }`} />
                                {getStatusLabel(s)}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleStatusUpdate} disabled={updating || newStatus === ticket.status}>
                        <Save className="h-4 w-4 mr-2" />{updating ? 'Guardando...' : 'Actualizar'}
                      </Button>
                    </div>
                    {newStatus !== ticket.status && (
                      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
                        Cambiará de <strong>{statusConfig.label}</strong> a <strong>{getStatusLabel(newStatus)}</strong>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">El ticket está cerrado y no puede cambiar de estado.</p>
              )}
            </TabsContent>

            <TabsContent value="resolution" className="space-y-4">
              <TicketResolutionTracker ticketId={ticket.id} canEdit={ticket.assignee?.id === session?.user?.id} mode="technician" onPlanChange={() => setTimelineKey(k => k + 1)} />
            </TabsContent>

            <TabsContent value="files" className="space-y-4">
              <CompactFileManager ticketId={ticket.id} onAttachmentsChange={loadTicket} canUpload={ticket.status !== 'CLOSED'} canDelete={ticket.status !== 'CLOSED'} refreshKey={fileKey} />
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
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={(ticket.client as any)?.avatar} />
                  <AvatarFallback>{ticket.client?.name?.charAt(0) ?? 'C'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium truncate">{ticket.client?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{ticket.client?.email}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Asignado a</p>
                  <p>{ticket.assignee?.name ?? <span className="text-muted-foreground">Sin asignar</span>}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-start gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Categoría</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ticket.category?.color || '#6B7280' }} />
                    <span>{ticket.category?.name ?? 'Sin categoría'}</span>
                  </div>
                </div>
              </div>
              <Separator />
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
