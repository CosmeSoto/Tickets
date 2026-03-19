'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Wrench, Calendar, ArrowLeft, CalendarClock, CheckCircle, XCircle,
  Loader2, Package, UserCheck, Warehouse, Clock, ThumbsUp, User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface MaintenanceDetail {
  id: string
  type: string
  status: string
  description: string
  date: string
  cost: number | null
  partsReplaced: string[]
  notes: string | null
  acceptedAt: string | null
  completedAt: string | null
  createdAt: string
  equipment: {
    id: string
    code: string
    brand: string
    model: string
    status: string
    type: { name: string } | null
    assignments: { receiver: { id: string; name: string; email: string } }[]
  }
  technician: { id: string; name: string; email: string } | null
  requestedBy: { id: string; name: string; email: string } | null
  ticket: { id: string; title: string; status: string } | null
}

const TYPE_LABELS: Record<string, string> = { PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo' }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED:  { label: 'Solicitado',   color: 'bg-blue-100 text-blue-800',   icon: <Clock className="h-4 w-4" /> },
  SCHEDULED:  { label: 'Programado',   color: 'bg-yellow-100 text-yellow-800', icon: <Calendar className="h-4 w-4" /> },
  ACCEPTED:   { label: 'Aceptado',     color: 'bg-purple-100 text-purple-800', icon: <ThumbsUp className="h-4 w-4" /> },
  COMPLETED:  { label: 'Completado',   color: 'bg-green-100 text-green-800',  icon: <CheckCircle className="h-4 w-4" /> },
  CANCELLED:  { label: 'Cancelado',    color: 'bg-gray-100 text-gray-600',    icon: <XCircle className="h-4 w-4" /> },
}

// Pasos del flujo para mostrar progreso visual
const FLOW_STEPS = ['REQUESTED', 'SCHEDULED', 'ACCEPTED', 'COMPLETED']

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [maintenance, setMaintenance] = useState<MaintenanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [showApprove, setShowApprove] = useState(false)
  const [showReschedule, setShowReschedule] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const [approveDate, setApproveDate] = useState('')
  const [approveNotes, setApproveNotes] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [completeCost, setCompleteCost] = useState('')
  const [completeParts, setCompleteParts] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')
  const [returnTo, setReturnTo] = useState<'available' | 'previous_user'>('available')

  const role = session?.user?.role
  const isClient = role === 'CLIENT'
  const isAdminOrTech = role === 'ADMIN' || role === 'TECHNICIAN'

  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('No encontrado')
      const data = await res.json()
      setMaintenance(data)
      setNewDate(data.date?.split('T')[0] || '')
      setNewDescription(data.description || '')
      setApproveDate(data.date?.split('T')[0] || '')
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el mantenimiento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMaintenance() }, [id])

  const doAction = async (action: string, body: object) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      return await res.json()
    } finally {
      setActionLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!approveDate) return
    try {
      await doAction('approve', { scheduledDate: approveDate, notes: approveNotes || undefined })
      toast({ title: 'Solicitud aprobada', description: 'El mantenimiento ha sido programado y el equipo está en mantenimiento.' })
      setShowApprove(false)
      fetchMaintenance()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleAccept = async () => {
    try {
      await doAction('accept', {})
      toast({ title: 'Mantenimiento aceptado', description: 'Has confirmado el mantenimiento programado.' })
      fetchMaintenance()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleReschedule = async () => {
    if (!newDate) return
    try {
      await doAction('reschedule', { scheduledDate: newDate, description: newDescription || undefined })
      toast({ title: 'Reagendado', description: 'El mantenimiento ha sido reagendado.' })
      setShowReschedule(false)
      fetchMaintenance()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleComplete = async () => {
    try {
      const result = await doAction('complete', {
        cost: completeCost ? parseFloat(completeCost) : undefined,
        partsReplaced: completeParts ? completeParts.split(',').map(p => p.trim()).filter(Boolean) : undefined,
        returnTo,
        notes: completeNotes || undefined,
      })
      const destMsg = result.reAssigned ? 'El equipo fue reasignado al usuario anterior.' : 'El equipo está disponible en bodega.'
      toast({ title: 'Mantenimiento completado', description: destMsg })
      setShowComplete(false)
      router.push(`/inventory/equipment/${maintenance!.equipment.id}`)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast({ title: 'Cancelado', description: 'El mantenimiento fue cancelado.' })
      if (maintenance?.equipment?.id) router.push(`/inventory/equipment/${maintenance.equipment.id}`)
      else router.back()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  if (!maintenance) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Mantenimiento no encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
      </div>
    )
  }

  const status = maintenance.status
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED
  const scheduledDate = new Date(maintenance.date)
  const isPast = scheduledDate < new Date()
  const assignedUser = maintenance.equipment.assignments?.[0]?.receiver
  const isActive = ['REQUESTED', 'SCHEDULED', 'ACCEPTED'].includes(status)
  const currentStepIndex = FLOW_STEPS.indexOf(status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-5 w-5" /></Button>
          <Wrench className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Mantenimiento {TYPE_LABELS[maintenance.type] || maintenance.type}</h1>
            <p className="text-muted-foreground">{maintenance.equipment.code} — {maintenance.equipment.brand} {maintenance.equipment.model}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Aprobar solicitud: solo ADMIN/TECH cuando está REQUESTED */}
          {isAdminOrTech && status === 'REQUESTED' && (
            <Button onClick={() => setShowApprove(true)}>
              <CheckCircle className="mr-2 h-4 w-4" /> Aprobar y Programar
            </Button>
          )}
          {/* Aceptar: solo CLIENT cuando está SCHEDULED */}
          {isClient && status === 'SCHEDULED' && (
            <Button onClick={handleAccept} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ThumbsUp className="mr-2 h-4 w-4" /> Aceptar Mantenimiento
            </Button>
          )}
          {/* Completar: ADMIN/TECH cuando SCHEDULED o ACCEPTED; CLIENT cuando ACCEPTED */}
          {((isAdminOrTech && (status === 'SCHEDULED' || status === 'ACCEPTED')) ||
            (isClient && status === 'ACCEPTED')) && (
            <Button variant="default" onClick={() => setShowComplete(true)}>
              <CheckCircle className="mr-2 h-4 w-4" /> Completar
            </Button>
          )}
          {/* Reagendar: solo ADMIN/TECH cuando activo */}
          {isAdminOrTech && isActive && status !== 'REQUESTED' && (
            <Button variant="outline" onClick={() => setShowReschedule(true)}>
              <CalendarClock className="mr-2 h-4 w-4" /> Reagendar
            </Button>
          )}
          {/* Cancelar: solo ADMIN/TECH cuando activo */}
          {isAdminOrTech && isActive && (
            <Button variant="ghost" onClick={() => setShowCancel(true)} className="text-destructive hover:bg-destructive/10">
              <XCircle className="mr-2 h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Progreso visual del flujo */}
      {status !== 'CANCELLED' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {FLOW_STEPS.map((step, i) => {
                const cfg = STATUS_CONFIG[step]
                const done = currentStepIndex > i || status === 'COMPLETED'
                const current = currentStepIndex === i && status !== 'COMPLETED'
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        done ? 'bg-green-500 border-green-500 text-white' :
                        current ? 'bg-primary border-primary text-white' :
                        'bg-muted border-border text-muted-foreground'
                      }`}>
                        {done ? <CheckCircle className="h-4 w-4" /> : i + 1}
                      </div>
                      <span className={`text-xs text-center ${current ? 'font-semibold text-primary' : done ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {i < FLOW_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${done ? 'bg-green-500' : 'bg-border'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner de estado contextual */}
      {status === 'REQUESTED' && (
        <Alert className="border-blue-300 bg-blue-50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            {isClient
              ? 'Tu solicitud de mantenimiento está pendiente de aprobación por el equipo técnico.'
              : 'Hay una solicitud de mantenimiento pendiente de aprobación. Revisa los detalles y aprueba para programar el mantenimiento.'}
          </AlertDescription>
        </Alert>
      )}
      {status === 'SCHEDULED' && (
        <Alert className="border-yellow-400 bg-yellow-50">
          <Wrench className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {isClient
              ? `Mantenimiento programado para el ${scheduledDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}. Puedes aceptarlo para confirmar tu disponibilidad.`
              : `Mantenimiento programado. ${isPast ? 'La fecha ya pasó — marca como completado cuando esté listo.' : `Fecha: ${scheduledDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.`}`}
          </AlertDescription>
        </Alert>
      )}
      {status === 'ACCEPTED' && (
        <Alert className="border-purple-300 bg-purple-50">
          <ThumbsUp className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-800">
            {isClient
              ? 'Has aceptado el mantenimiento. Cuando el técnico lo complete, recibirás una notificación.'
              : 'El cliente aceptó el mantenimiento. Puedes marcarlo como completado cuando finalice.'}
          </AlertDescription>
        </Alert>
      )}
      {status === 'COMPLETED' && (
        <Alert className="border-green-400 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Mantenimiento completado el {maintenance.completedAt ? new Date(maintenance.completedAt).toLocaleDateString('es-ES') : '—'}.
          </AlertDescription>
        </Alert>
      )}
      {status === 'CANCELLED' && (
        <Alert className="border-gray-300 bg-gray-50">
          <XCircle className="h-4 w-4 text-gray-500" />
          <AlertDescription className="text-gray-700">Este mantenimiento fue cancelado.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Detalle del mantenimiento */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Detalle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Estado</span>
              <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Tipo</span>
              <Badge variant={maintenance.type === 'CORRECTIVE' ? 'destructive' : 'default'}>
                {TYPE_LABELS[maintenance.type] || maintenance.type}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Fecha programada</span>
              <span className={`text-sm font-medium ${isPast && isActive ? 'text-orange-600' : ''}`}>
                {scheduledDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                {isPast && isActive && ' ⚠️'}
              </span>
            </div>
            {maintenance.acceptedAt && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Aceptado el</span>
                <span className="text-sm">{new Date(maintenance.acceptedAt).toLocaleDateString('es-ES')}</span>
              </div>
            )}
            {maintenance.completedAt && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Completado el</span>
                <span className="text-sm">{new Date(maintenance.completedAt).toLocaleDateString('es-ES')}</span>
              </div>
            )}
            {maintenance.cost != null && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Costo</span>
                <span className="text-sm font-medium">${maintenance.cost.toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div>
              <span className="text-muted-foreground text-sm">Descripción</span>
              <p className="mt-1 text-sm">{maintenance.description}</p>
            </div>
            {maintenance.notes && (
              <div>
                <span className="text-muted-foreground text-sm">Notas</span>
                <p className="mt-1 text-sm">{maintenance.notes}</p>
              </div>
            )}
            {maintenance.partsReplaced?.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Partes reemplazadas</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {maintenance.partsReplaced.map((p, i) => <Badge key={i} variant="outline">{p}</Badge>)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info del equipo y personas */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Equipo y Personas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Equipo</span>
              <Button variant="link" className="p-0 h-auto text-sm" onClick={() => router.push(`/inventory/equipment/${maintenance.equipment.id}`)}>
                {maintenance.equipment.code}
              </Button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Tipo</span>
              <span className="text-sm">{maintenance.equipment.type?.name || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Marca / Modelo</span>
              <span className="text-sm">{maintenance.equipment.brand} {maintenance.equipment.model}</span>
            </div>
            <Separator />
            {maintenance.requestedBy && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm flex items-center gap-1"><User className="h-3 w-3" /> Solicitado por</span>
                <span className="text-sm">{maintenance.requestedBy.name}</span>
              </div>
            )}
            {maintenance.technician && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm flex items-center gap-1"><Wrench className="h-3 w-3" /> Técnico</span>
                <span className="text-sm">{maintenance.technician.name}</span>
              </div>
            )}
            {assignedUser && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Usuario asignado</span>
                <span className="text-sm">{assignedUser.name}</span>
              </div>
            )}
            {maintenance.ticket && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Ticket relacionado</span>
                <span className="text-sm">{maintenance.ticket.title}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Registrado</span>
              <span className="text-xs">{new Date(maintenance.createdAt).toLocaleString('es-ES')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Aprobar solicitud */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar y Programar Mantenimiento</DialogTitle>
            <DialogDescription>Confirma la fecha y asigna el técnico. El equipo pasará a estado Mantenimiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Fecha programada *</Label><Input type="date" value={approveDate} onChange={e => setApproveDate(e.target.value)} /></div>
            <div><Label>Notas para el cliente (opcional)</Label><Textarea value={approveNotes} onChange={e => setApproveNotes(e.target.value)} rows={2} placeholder="Ej: El técnico se presentará a las 9am..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprove(false)}>Cancelar</Button>
            <Button onClick={handleApprove} disabled={actionLoading || !approveDate}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Aprobar y Programar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reagendar */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reagendar Mantenimiento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nueva fecha *</Label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
            <div><Label>Descripción (opcional)</Label><Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Cancelar</Button>
            <Button onClick={handleReschedule} disabled={actionLoading || !newDate}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Completar */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Completar Mantenimiento</DialogTitle>
            <DialogDescription>Indica qué debe pasar con el equipo al finalizar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">¿A dónde va el equipo? *</Label>
              <div className="grid gap-2">
                <button type="button" onClick={() => setReturnTo('available')}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${returnTo === 'available' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}>
                  <Warehouse className={`h-5 w-5 flex-shrink-0 ${returnTo === 'available' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Enviar a bodega</p>
                    <p className="text-xs text-muted-foreground">El equipo queda disponible para asignación</p>
                  </div>
                </button>
                {assignedUser && (
                  <button type="button" onClick={() => setReturnTo('previous_user')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${returnTo === 'previous_user' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'}`}>
                    <UserCheck className={`h-5 w-5 flex-shrink-0 ${returnTo === 'previous_user' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium text-sm">Reasignar a {assignedUser.name}</p>
                      <p className="text-xs text-muted-foreground">El equipo vuelve al usuario que lo tenía</p>
                    </div>
                  </button>
                )}
              </div>
            </div>
            {isAdminOrTech && (
              <>
                <div><Label>Costo (opcional)</Label><Input type="number" min="0" step="0.01" placeholder="0.00" value={completeCost} onChange={e => setCompleteCost(e.target.value)} /></div>
                <div><Label>Partes reemplazadas (separadas por coma)</Label><Input placeholder="Ej: Disco SSD, Batería" value={completeParts} onChange={e => setCompleteParts(e.target.value)} /></div>
              </>
            )}
            <div><Label>Notas finales (opcional)</Label><Textarea value={completeNotes} onChange={e => setCompleteNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancelar</Button>
            <Button onClick={handleComplete} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar y Completar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Cancelar */}
      <AlertDialog open={showCancel} onOpenChange={setShowCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar mantenimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              {status === 'REQUESTED'
                ? 'Se rechazará la solicitud de mantenimiento. El equipo no cambiará de estado.'
                : 'Se cancelará el mantenimiento y el equipo volverá a estar disponible en bodega.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
