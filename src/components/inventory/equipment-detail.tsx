'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Package, 
  QrCode, 
  Edit, 
  Trash2, 
  UserPlus, 
  Wrench,
  Download,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
import { UserCombobox } from '@/components/ui/user-combobox'
import { useToast } from '@/hooks/use-toast'
import { EquipmentHistory } from '@/components/inventory/equipment-history'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { EquipmentDetailResponse } from '@/types/inventory/equipment'

interface EquipmentDetailProps {
  equipmentId: string
  userRole: string
  userId: string
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-green-500',
  ASSIGNED: 'bg-blue-500',
  MAINTENANCE: 'bg-yellow-500',
  DAMAGED: 'bg-red-500',
  RETIRED: 'bg-gray-500',
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

const TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  TABLET: 'Tablet',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Audífonos',
  WEBCAM: 'Webcam',
  DOCKING_STATION: 'Docking Station',
  UPS: 'UPS',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  OTHER: 'Otro',
}

const OWNERSHIP_LABELS: Record<string, string> = {
  FIXED_ASSET: 'Activo Fijo',
  RENTAL: 'Alquiler',
  LOAN: 'Préstamo',
}

export function EquipmentDetail({ equipmentId, userRole, userId }: EquipmentDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<EquipmentDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false)
  const [permanentDeleting, setPermanentDeleting] = useState(false)

  // Dialog de asignación
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignForm, setAssignForm] = useState({
    receiverId: '',
    assignmentType: 'PERMANENT' as 'PERMANENT' | 'TEMPORARY' | 'LOAN',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    observations: '',
  })

  // Dialog de devolución
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [returning, setReturning] = useState(false)
  const [returnForm, setReturnForm] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    observations: '',
    condition: '',
  })

  // Dialog de mantenimiento
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'PREVENTIVE' as 'PREVENTIVE' | 'CORRECTIVE',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    loadEquipmentDetail()
    loadQRCode()
  }, [equipmentId])

  const loadEquipmentDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inventory/equipment/${equipmentId}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar equipo')
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error cargando equipo:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar el equipo',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadQRCode = async () => {
    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}/qr`)
      
      if (response.ok) {
        const result = await response.json()
        setQrCode(result.qrCode)
      }
    } catch (error) {
      console.error('Error cargando QR:', error)
    }
  }

  const handleEdit = () => {
    router.push(`/inventory/equipment/${equipmentId}/edit`)
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 409) {
          // Tiene asignación activa — cerrar diálogo y mostrar mensaje claro
          setShowDeleteDialog(false)
          toast({
            title: 'No se puede retirar el equipo',
            description: 'El equipo tiene una asignación activa. Primero debes desasignarlo (generar acta de devolución) y luego retirarlo.',
            variant: 'destructive',
            duration: 8000,
          })
          return
        }
        throw new Error(error.error || 'Error al retirar equipo')
      }

      toast({
        title: 'Equipo retirado',
        description: 'El equipo ha sido marcado como retirado',
      })

      router.push('/inventory')
    } catch (error) {
      console.error('Error eliminando equipo:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo retirar el equipo',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handlePermanentDelete = async () => {
    setPermanentDeleting(true)
    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}/permanent`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar equipo')
      }

      toast({
        title: 'Equipo eliminado',
        description: 'El equipo ha sido eliminado permanentemente del sistema',
      })

      router.push('/inventory')
    } catch (error) {
      console.error('Error eliminando permanentemente:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el equipo',
        variant: 'destructive',
      })
    } finally {
      setPermanentDeleting(false)
      setShowPermanentDeleteDialog(false)
    }
  }

  const handleAssign = async () => {
    setShowAssignDialog(true)
  }

  const submitAssignment = async () => {
    if (!assignForm.receiverId) {
      toast({ title: 'Error', description: 'Selecciona un usuario', variant: 'destructive' })
      return
    }
    setAssigning(true)
    try {
      const payload = {
        equipmentId,
        receiverId: assignForm.receiverId,
        assignmentType: assignForm.assignmentType,
        startDate: assignForm.startDate,
        endDate: assignForm.endDate || undefined,
        observations: assignForm.observations || undefined,
        accessories: data?.equipment?.accessories || [],
      }

      const response = await fetch('/api/inventory/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al asignar equipo')
      }

      toast({
        title: 'Equipo asignado',
        description: 'El equipo ha sido asignado exitosamente. Se generó un acta de entrega.',
      })

      setShowAssignDialog(false)
      loadEquipmentDetail()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo asignar el equipo',
        variant: 'destructive',
      })
    } finally {
      setAssigning(false)
    }
  }

  const submitReturn = async () => {
    if (!currentAssignment) return
    setReturning(true)
    try {
      const response = await fetch(`/api/inventory/assignments/${currentAssignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnDate: returnForm.returnDate,
          observations: returnForm.observations || undefined,
          condition: returnForm.condition || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al devolver equipo')
      }

      toast({
        title: 'Equipo devuelto',
        description: 'El equipo ha sido devuelto al inventario y está disponible nuevamente.',
      })

      setShowReturnDialog(false)
      setReturnForm({ returnDate: new Date().toISOString().split('T')[0], observations: '', condition: '' })
      loadEquipmentDetail()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo devolver el equipo',
        variant: 'destructive',
      })
    } finally {
      setReturning(false)
    }
  }

  const handleMaintenance = () => {
    setShowMaintenanceDialog(true)
  }

  const submitMaintenance = async () => {
    if (!maintenanceForm.description.trim()) {
      toast({ title: 'Error', description: 'Describe el mantenimiento', variant: 'destructive' })
      return
    }
    setSubmittingMaintenance(true)
    try {
      const response = await fetch('/api/inventory/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          type: maintenanceForm.type,
          description: maintenanceForm.description,
          scheduledDate: maintenanceForm.scheduledDate,
          technicianId: userId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al registrar mantenimiento')
      }

      toast({
        title: 'Mantenimiento registrado',
        description: 'El equipo ha sido marcado en mantenimiento. El cliente asignado será notificado.',
      })

      setShowMaintenanceDialog(false)
      setMaintenanceForm({ type: 'PREVENTIVE', description: '', scheduledDate: new Date().toISOString().split('T')[0] })
      loadEquipmentDetail()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo registrar el mantenimiento',
        variant: 'destructive',
      })
    } finally {
      setSubmittingMaintenance(false)
    }
  }

  const handleReportProblem = () => {
    // Redirigir a crear ticket con información del equipo pre-llenada
    const equipmentInfo = `Equipo: ${equipment.code} - ${equipment.brand} ${equipment.model}\nNúmero de Serie: ${equipment.serialNumber}`
    const queryParams = new URLSearchParams({
      title: `Problema con equipo ${equipment.code}`,
      description: equipmentInfo,
      equipmentId: equipment.id,
    })
    router.push(`/client/tickets/create?${queryParams.toString()}`)
  }

  const downloadQR = () => {
    if (!qrCode) return

    const link = document.createElement('a')
    link.href = qrCode
    link.download = `qr-${data?.equipment.code}.png`
    link.click()
  }

  if (loading) {
    return <div>Cargando...</div>
  }

  if (!data) {
    return <div>Equipo no encontrado</div>
  }

  const { equipment, currentAssignment, history, maintenanceRecords } = data
  const isAdmin = userRole === 'ADMIN'
  const isRetired = equipment.status === 'RETIRED'
  const canEdit = (userRole === 'ADMIN' || userRole === 'TECHNICIAN') && !isRetired
  const canDelete = userRole === 'ADMIN'
  const canAssign = (userRole === 'ADMIN' || userRole === 'TECHNICIAN') && equipment.status === 'AVAILABLE'
  const canUnassign = (userRole === 'ADMIN' || userRole === 'TECHNICIAN') && !!currentAssignment
  const canReportProblem = userRole === 'CLIENT' && currentAssignment?.receiverId === userId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">{equipment.code}</h1>
            <p className="text-muted-foreground">
              {equipment.type?.name || 'Sin tipo'} - {equipment.brand} {equipment.model}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canReportProblem && (
            <Button onClick={handleReportProblem} variant="default">
              <AlertCircle className="mr-2 h-4 w-4" />
              Reportar Problema
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleEdit} variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          )}
          {canAssign && (
            <Button onClick={handleAssign}>
              <UserPlus className="mr-2 h-4 w-4" />
              Asignar
            </Button>
          )}
          {canUnassign && (
            <Button onClick={() => setShowReturnDialog(true)} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <UserPlus className="mr-2 h-4 w-4 rotate-180" />
              Devolver Equipo
            </Button>
          )}
          {canEdit && (
            <Button onClick={handleMaintenance} variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Mantenimiento
            </Button>
          )}
          {canDelete && !isRetired && equipment.status !== 'ASSIGNED' && (
            <Button onClick={() => setShowDeleteDialog(true)} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Retirar
            </Button>
          )}
          {isAdmin && isRetired && (
            <Button
              onClick={() => setShowPermanentDeleteDialog(true)}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Eliminar permanentemente"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span className="text-xs">Eliminar definitivamente</span>
            </Button>
          )}
        </div>
      </div>

      {/* Dialog de asignación */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Equipo</DialogTitle>
            <DialogDescription>
              Asigna el equipo <span className="font-semibold">{equipment.code}</span> a un usuario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <UserCombobox
                value={assignForm.receiverId}
                onValueChange={(v) => setAssignForm(prev => ({ ...prev, receiverId: v }))}
                placeholder="Buscar usuario por nombre o email..."
                emptyText="No se encontraron usuarios"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Asignación *</Label>
              <Select value={assignForm.assignmentType} onValueChange={(v) => setAssignForm(prev => ({ ...prev, assignmentType: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERMANENT">Permanente</SelectItem>
                  <SelectItem value="TEMPORARY">Temporal</SelectItem>
                  <SelectItem value="LOAN">Préstamo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Inicio *</Label>
              <Input type="date" value={assignForm.startDate} onChange={(e) => setAssignForm(prev => ({ ...prev, startDate: e.target.value }))} />
            </div>
            {(assignForm.assignmentType === 'TEMPORARY' || assignForm.assignmentType === 'LOAN') && (
              <div className="space-y-2">
                <Label>Fecha de Fin *</Label>
                <Input type="date" value={assignForm.endDate} onChange={(e) => setAssignForm(prev => ({ ...prev, endDate: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={assignForm.observations} onChange={(e) => setAssignForm(prev => ({ ...prev, observations: e.target.value }))} placeholder="Observaciones adicionales..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={assigning}>Cancelar</Button>
            <Button onClick={submitAssignment} disabled={assigning}>
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de devolución */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Equipo</DialogTitle>
            <DialogDescription>
              Registra la devolución del equipo <span className="font-semibold">{equipment.code}</span>.
              {currentAssignment && (
                <span className="block mt-1">
                  Actualmente asignado a: <span className="font-medium">{currentAssignment.receiver?.name}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Fecha de Devolución *</Label>
              <Input
                type="date"
                value={returnForm.returnDate}
                onChange={(e) => setReturnForm(prev => ({ ...prev, returnDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Condición al Devolver</Label>
              <Select
                value={returnForm.condition}
                onValueChange={(v) => setReturnForm(prev => ({ ...prev, condition: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin cambio de condición..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">Nuevo</SelectItem>
                  <SelectItem value="LIKE_NEW">Como Nuevo</SelectItem>
                  <SelectItem value="GOOD">Bueno</SelectItem>
                  <SelectItem value="FAIR">Regular</SelectItem>
                  <SelectItem value="POOR">Malo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={returnForm.observations}
                onChange={(e) => setReturnForm(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Estado del equipo al momento de la devolución..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReturnDialog(false)} disabled={returning}>Cancelar</Button>
            <Button onClick={submitReturn} disabled={returning}>
              {returning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de mantenimiento */}
      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Mantenimiento</DialogTitle>
            <DialogDescription>
              Registra un mantenimiento para el equipo <span className="font-semibold">{equipment.code}</span>.
              {currentAssignment && (
                <span className="block mt-1 text-yellow-600">
                  El cliente asignado ({currentAssignment.receiver?.name}) será notificado.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de Mantenimiento *</Label>
              <Select value={maintenanceForm.type} onValueChange={(v) => setMaintenanceForm(prev => ({ ...prev, type: v as any }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREVENTIVE">Preventivo</SelectItem>
                  <SelectItem value="CORRECTIVE">Correctivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea value={maintenanceForm.description} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Describe el mantenimiento a realizar..." />
            </div>
            <div className="space-y-2">
              <Label>Fecha Programada *</Label>
              <Input type="date" value={maintenanceForm.scheduledDate} onChange={(e) => setMaintenanceForm(prev => ({ ...prev, scheduledDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMaintenanceDialog(false)} disabled={submittingMaintenance}>Cancelar</Button>
            <Button onClick={submitMaintenance} disabled={submittingMaintenance}>
              {submittingMaintenance && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para retirar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar equipo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  ¿Estás seguro de que deseas retirar el equipo{' '}
                  <span className="font-semibold">{equipment.code}</span> ({equipment.brand} {equipment.model})?
                  El estado cambiará a &quot;Retirado&quot; y no podrá asignarse nuevamente.
                </p>
                {currentAssignment && (
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ Este equipo tiene una asignación activa con {currentAssignment.receiver?.name}. 
                    Debes desasignarlo primero antes de retirarlo.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || !!currentAssignment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Retirando...' : 'Sí, retirar equipo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmación para eliminación permanente */}
      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Eliminar equipo permanentemente</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta acción es <span className="font-semibold text-destructive">irreversible</span>. Se eliminará
                  el equipo <span className="font-semibold">{equipment.code}</span> y todos sus registros
                  asociados (mantenimientos, asignaciones) de forma permanente.
                </p>
                <p className="text-xs text-muted-foreground">
                  Esta acción quedará registrada en el historial de auditoría.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permanentDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              disabled={permanentDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {permanentDeleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Información Principal */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Información del Equipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Estado</label>
                <div className="mt-1">
                  <Badge className={STATUS_COLORS[equipment.status]}>
                    {STATUS_LABELS[equipment.status]}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Condición</label>
                <p className="mt-1">{CONDITION_LABELS[equipment.condition]}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Número de Serie</label>
                <p className="mt-1 font-mono">{equipment.serialNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tipo de Propiedad</label>
                <p className="mt-1">{OWNERSHIP_LABELS[equipment.ownershipType]}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              {equipment.purchaseDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Compra</label>
                    <p className="text-sm">{formatDate(equipment.purchaseDate)}</p>
                  </div>
                </div>
              )}
              {equipment.purchasePrice && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Precio de Compra</label>
                    <p className="text-sm">{formatCurrency(equipment.purchasePrice)}</p>
                  </div>
                </div>
              )}
              {equipment.warrantyExpiration && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vencimiento de Garantía</label>
                    <p className="text-sm">{formatDate(equipment.warrantyExpiration)}</p>
                  </div>
                </div>
              )}
              {equipment.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ubicación</label>
                    <p className="text-sm">{equipment.location}</p>
                  </div>
                </div>
              )}
            </div>

            {equipment.accessories && equipment.accessories.length > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Accesorios</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {equipment.accessories.map((accessory, index) => (
                      <Badge key={index} variant="outline">
                        {accessory}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {equipment.specifications && Object.keys(equipment.specifications).length > 0 && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Especificaciones Técnicas</label>
                  <div className="mt-2 space-y-2">
                    {Object.entries(equipment.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="font-medium">{key}:</span>
                        <span>{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {equipment.notes && (
              <>
                <Separator />
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notas</label>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{equipment.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* QR Code y Asignación Actual */}
        <div className="space-y-6">
          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Código QR
              </CardTitle>
              <CardDescription>
                Escanea para acceder rápidamente
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {qrCode ? (
                <>
                  <img src={qrCode} alt="QR Code" className="w-48 h-48" />
                  <Button onClick={downloadQR} variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Descargar QR
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">QR no disponible</p>
              )}
            </CardContent>
          </Card>

          {/* Asignación Actual */}
          {currentAssignment && (
            <Card>
              <CardHeader>
                <CardTitle>Asignación Actual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Asignado a</label>
                  <p className="text-sm">{currentAssignment.receiver?.name}</p>
                  <p className="text-xs text-muted-foreground">{currentAssignment.receiver?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fecha de Asignación</label>
                  <p className="text-sm">{formatDate(currentAssignment.startDate)}</p>
                </div>
                {currentAssignment.endDate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Fecha de Devolución</label>
                    <p className="text-sm">{formatDate(currentAssignment.endDate)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Historial */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial
          </CardTitle>
          <CardDescription>
            Registro completo de eventos del equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentHistory history={history} />
        </CardContent>
      </Card>

      {/* Mantenimientos */}
      {maintenanceRecords && maintenanceRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Mantenimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {maintenanceRecords.map((record: any) => (
                <div key={record.id} className="flex justify-between items-start border-b pb-4 last:border-0">
                  <div>
                    <p className="font-medium">{record.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'}</p>
                    <p className="text-sm text-muted-foreground">{record.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(record.date)} - {record.technician?.name}
                    </p>
                  </div>
                  {record.cost && (
                    <p className="text-sm font-medium">{formatCurrency(record.cost)}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
