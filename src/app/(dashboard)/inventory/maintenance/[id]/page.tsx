'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Wrench, Calendar, ArrowLeft, CalendarClock,
  CheckCircle, Trash2, Loader2, Package, UserCheck, Warehouse, Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

interface MaintenanceDetail {
  id: string
  type: string
  description: string
  date: string
  cost: number | null
  partsReplaced: string[]
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
  ticket: { id: string; title: string; status: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
}

export default function MaintenanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [maintenance, setMaintenance] = useState<MaintenanceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [showReschedule, setShowReschedule] = useState(false)
  const [showComplete, setShowComplete] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  const [newDate, setNewDate] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [completeCost, setCompleteCost] = useState('')
  const [completeParts, setCompleteParts] = useState('')
  // 'available' = enviar a bodega | 'previous_user' = reasignar al último usuario
  const [returnTo, setReturnTo] = useState<'available' | 'previous_user'>('available')

  const isClient = session?.user?.role === 'CLIENT'
  const isActive = maintenance?.equipment?.status === 'MAINTENANCE'

  const fetchMaintenance = async () => {
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('No encontrado')
      const data = await res.json()
      setMaintenance(data)
      setNewDate(data.date?.split('T')[0] || '')
      setNewDescription(data.description || '')
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el mantenimiento', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMaintenance() }, [id])

  const handleReschedule = async () => {
    if (!newDate) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reschedule', scheduledDate: newDate, description: newDescription || undefined }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast({ title: 'Reagendado', description: 'El mantenimiento ha sido reagendado.' })
      setShowReschedule(false)
      fetchMaintenance()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' })
    } finally { setActionLoading(false) }
  }

  const handleComplete = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          cost: completeCost ? parseFloat(completeCost) : undefined,
          partsReplaced: completeParts ? completeParts.split(',').map(p => p.trim()).filter(Boolean) : undefined,
          returnTo,
        }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }

      const result = await res.json()
      const destMsg = result.reAssigned
        ? 'El equipo ha sido reasignado al usuario anterior.'
        : 'El equipo ha vuelto a bodega (disponible).'

      toast({ title: '✅ Mantenimiento completado', description: destMsg })
      setShowComplete(false)
      // Redirigir al equipo para ver el nuevo estado
      router.push(`/inventory/equipment/${maintenance!.equipment.id}`)
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' })
    } finally { setActionLoading(false) }
  }

  const handleCancel = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${id}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      toast({ title: 'Cancelado', description: 'El mantenimiento fue cancelado. El equipo está disponible.' })
      if (maintenance?.equipment?.id) {
        router.push(`/inventory/equipment/${maintenance.equipment.id}`)
      } else {
        router.back()
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' })
    } finally { setActionLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!maintenance) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Mantenimiento no encontrado</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    )
  }

  const scheduledDate = new Date(maintenance.date)
  const isPast = scheduledDate < new Date()
  const assignedUser = maintenance.equipment.assignments?.[0]?.receiver

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Wrench className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">
              Mantenimiento {TYPE_LABELS[maintenance.type] || maintenance.type}
            </h1>
            <p className="text-muted-foreground">
              {maintenance.equipment.code} — {maintenance.equipment.brand} {maintenance.equipment.model}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Completar: ADMIN, TECHNICIAN y CLIENT pueden marcar como terminado */}
          {isActive && (
            <Button variant="default" onClick={() => setShowComplete(true)}>
              <CheckCircle className="mr-2 h-4 w-4" /> Completar Mantenimiento
            </Button>
          )}
          {!isClient && isActive && (
            <>
              <Button variant="outline" onClick={() => setShowReschedule(true)}>
                <CalendarClock className="mr-2 h-4 w-4" /> Reagendar
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowCancel(true)} title="Cancelar mantenimiento" className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Banner de estado */}
      {isActive && (
        <Alert className="border-yellow-400 bg-yellow-50">
          <Wrench className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <span className="font-medium">Equipo en mantenimiento.</span>{' '}
            {isPast
              ? 'La fecha programada ya pasó. Marca el mantenimiento como completado cuando el equipo esté listo.'
              : `Mantenimiento programado para el ${scheduledDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.`}
            {isClient && ' Cuando el equipo esté listo, puedes marcarlo como completado desde el botón de arriba.'}
          </AlertDescription>
        </Alert>
      )}

      {!isActive && (
        <Alert className="border-green-400 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <span className="font-medium">Mantenimiento completado.</span>{' '}
            El equipo ya no está en mantenimiento.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Info del mantenimiento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" /> Detalle del Mantenimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <Badge variant={maintenance.type === 'CORRECTIVE' ? 'destructive' : 'default'}>
                {TYPE_LABELS[maintenance.type] || maintenance.type}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha programada</span>
              <span className={`font-medium ${isPast && isActive ? 'text-orange-600' : ''}`}>
                {scheduledDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {isPast && isActive && ' ⚠️'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado del equipo</span>
              <Badge variant={isActive ? 'secondary' : 'outline'} className={isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>
                {isActive ? 'En mantenimiento' : 'Completado'}
              </Badge>
            </div>
            {maintenance.cost != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo</span>
                <span className="font-medium">${maintenance.cost.toFixed(2)}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground text-sm">Descripción</span>
              <p className="mt-1">{maintenance.description}</p>
            </div>
            {maintenance.partsReplaced?.length > 0 && (
              <div>
                <span className="text-muted-foreground text-sm">Partes reemplazadas</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {maintenance.partsReplaced.map((part, i) => (
                    <Badge key={i} variant="outline">{part}</Badge>
                  ))}
                </div>
              </div>
            )}
            {maintenance.technician && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Técnico</span>
                <span>{maintenance.technician.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registrado</span>
              <span className="text-sm">{new Date(maintenance.createdAt).toLocaleString('es-ES')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Info del equipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Equipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Código</span>
              <Button variant="link" className="p-0 h-auto" onClick={() => router.push(`/inventory/equipment/${maintenance.equipment.id}`)}>
                {maintenance.equipment.code}
              </Button>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo</span>
              <span>{maintenance.equipment.type?.name || 'Sin tipo'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Marca / Modelo</span>
              <span>{maintenance.equipment.brand} {maintenance.equipment.model}</span>
            </div>
            {assignedUser && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último usuario asignado</span>
                <span>{assignedUser.name}</span>
              </div>
            )}
            {maintenance.ticket && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket relacionado</span>
                <span className="text-sm">{maintenance.ticket.title}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Reagendar */}
      <Dialog open={showReschedule} onOpenChange={setShowReschedule}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar Mantenimiento</DialogTitle>
            <DialogDescription>Cambia la fecha y opcionalmente la descripción.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nueva fecha *</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReschedule(false)}>Cancelar</Button>
            <Button onClick={handleReschedule} disabled={actionLoading || !newDate}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Completar */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Completar Mantenimiento</DialogTitle>
            <DialogDescription>
              El mantenimiento ha finalizado. Indica qué debe pasar con el equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {/* Destino del equipo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">¿A dónde va el equipo? *</Label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnTo('available')}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                    returnTo === 'available'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Warehouse className={`h-5 w-5 flex-shrink-0 ${returnTo === 'available' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Enviar a bodega</p>
                    <p className="text-xs text-muted-foreground">El equipo queda disponible para ser asignado a cualquier usuario</p>
                  </div>
                </button>
                {assignedUser && (
                  <button
                    type="button"
                    onClick={() => setReturnTo('previous_user')}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      returnTo === 'previous_user'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <UserCheck className={`h-5 w-5 flex-shrink-0 ${returnTo === 'previous_user' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="font-medium text-sm">Reasignar a {assignedUser.name}</p>
                      <p className="text-xs text-muted-foreground">El equipo vuelve directamente al usuario que lo tenía antes</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Campos opcionales — solo para ADMIN/TECHNICIAN */}
            {!isClient && (
              <>
                <div>
                  <Label>Costo del mantenimiento (opcional)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={completeCost} onChange={e => setCompleteCost(e.target.value)} />
                </div>
                <div>
                  <Label>Partes reemplazadas (separadas por coma, opcional)</Label>
                  <Input placeholder="Ej: Disco SSD, Batería" value={completeParts} onChange={e => setCompleteParts(e.target.value)} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancelar</Button>
            <Button onClick={handleComplete} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar y Completar
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
              Se eliminará el registro de mantenimiento y el equipo volverá a estar disponible en bodega. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, cancelar mantenimiento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
