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
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { DepreciationCard } from '@/components/inventory/equipment/DepreciationCard'
import { FinancialInfoSection } from '@/components/inventory/shared/FinancialInfoSection'
import { DecommissionRequestForm } from '@/components/inventory/decommission/DecommissionRequestForm'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { extractCatchError } from '@/lib/utils/api-error'
import { EquipmentHistory } from '@/components/inventory/equipment-history'
import { EquipmentAttachments } from '@/components/inventory/equipment-attachments'
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
  RETIRED: 'bg-muted-foreground',
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
  const [showDecommissionForm, setShowDecommissionForm] = useState(false)

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
    } catch (err) {
      toast({ title: 'Error', description: extractCatchError(err, 'No se pudo cargar el equipo'), variant: 'destructive' })
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
        title: 'Equipo dado de baja',
        description: 'El equipo ha sido marcado como retirado del inventario activo.',
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
    // Usar el currentAssignment del estado actual del data, no del closure
    const activeAssignment = data?.currentAssignment
    if (!activeAssignment) {
      toast({ title: 'Error', description: 'No hay asignación activa para devolver', variant: 'destructive' })
      setShowReturnDialog(false)
      return
    }
    setReturning(true)
    try {
      const response = await fetch(`/api/inventory/assignments/${activeAssignment.id}`, {
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

      // Cerrar dialog y limpiar form ANTES de recargar para evitar doble submit
      setShowReturnDialog(false)
      setReturnForm({ returnDate: new Date().toISOString().split('T')[0], observations: '', condition: '' })
      // Limpiar datos locales inmediatamente para que los botones se actualicen
      setData(prev => prev ? {
        ...prev,
        currentAssignment: undefined,
        equipment: { ...prev.equipment, status: 'AVAILABLE' as any }
      } : prev)
      // Recargar datos frescos del servidor
      await loadEquipmentDetail()
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
      const isClient = userRole === 'CLIENT'
      const response = await fetch('/api/inventory/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          type: maintenanceForm.type,
          description: maintenanceForm.description,
          scheduledDate: maintenanceForm.scheduledDate,
          ...(isClient ? {} : { technicianId: userId }),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al registrar mantenimiento')
      }

      toast({
        title: userRole === 'CLIENT' ? 'Solicitud enviada' : 'Mantenimiento registrado',
        description: userRole === 'CLIENT'
          ? 'Tu solicitud de mantenimiento fue enviada. El equipo técnico la revisará pronto.'
          : 'El equipo ha sido marcado en mantenimiento. El cliente asignado será notificado.',
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
  const isAssigned = equipment.status === 'ASSIGNED' || !!currentAssignment
  const isInMaintenance = equipment.status === 'MAINTENANCE'

  // Permisos basados en rol + canManageInventory (el backend valida el alcance por familia)
  const canManage = userRole === 'ADMIN' || userRole === 'TECHNICIAN' || (data as any)?.canManageInventory
  // Editar: gestores, admins y técnicos, mientras no esté retirado
  const canEdit = canManage && !isRetired
  // Asignar: solo si está disponible en bodega
  const canAssign = canManage && equipment.status === 'AVAILABLE'
  // Devolver a bodega: solo si tiene asignación activa
  const canReturn = canManage && isAssigned
  // Mantenimiento (admin/tech/gestor): si no está retirado ni ya en mantenimiento
  const canMaintenance = canManage && !isRetired && !isInMaintenance
  // Solicitar mantenimiento (cliente): si tiene el equipo asignado y no hay solicitud/mantenimiento activo
  const hasActiveMaintenance = isInMaintenance || (maintenanceRecords && maintenanceRecords.some((r: any) => ['REQUESTED', 'SCHEDULED', 'ACCEPTED'].includes(r.status)))
  const canRequestMaintenance = userRole === 'CLIENT' && currentAssignment?.receiverId === userId && !hasActiveMaintenance
  // Dar de baja: gestores y admins, no retirado, sin asignación activa
  const canRetire = canManage && !isRetired && !isAssigned
  // Eliminar definitivamente: solo ADMIN y solo si ya está retirado
  const canPermanentDelete = isAdmin && isRetired
  // Cliente reportar problema: solo si el equipo le está asignado
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
        </div>        <div className="flex gap-2">
          {canReportProblem && (
            <Button onClick={handleReportProblem} variant="default">
              <AlertCircle className="mr-2 h-4 w-4" />
              Reportar Problema
            </Button>
          )}
          {canRequestMaintenance && !isInMaintenance && (
            <Button onClick={handleMaintenance} variant="outline" className="border-yellow-300 text-yellow-700 hover:bg-yellow-50">
              <Wrench className="mr-2 h-4 w-4" />
              Solicitar Mantenimiento
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
          {canReturn && (
            <Button onClick={() => setShowReturnDialog(true)} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <UserPlus className="mr-2 h-4 w-4 rotate-180" />
              Devolver a Bodega
            </Button>
          )}
          {canMaintenance && (
            <Button onClick={handleMaintenance} variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Mantenimiento
            </Button>
          )}
          {canRetire && (
            <Button onClick={() => setShowDecommissionForm(true)} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Solicitar Baja
            </Button>
          )}
          {canPermanentDelete && (
            <Button
              onClick={() => setShowPermanentDeleteDialog(true)}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Eliminar permanentemente del sistema"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span className="text-xs">Eliminar definitivamente</span>
            </Button>
          )}
        </div>
      </div>

      {/* Banner contextual de estado */}
      {isInMaintenance && maintenanceRecords && maintenanceRecords.length > 0 && (
        <Alert className="border-yellow-400 bg-yellow-50">
          <Wrench className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800 flex items-center justify-between">
            <span>
              <span className="font-medium">Equipo en mantenimiento.</span>{' '}
              {userRole === 'CLIENT'
                ? 'El equipo está siendo atendido por el equipo técnico. Recibirás una notificación cuando esté listo.'
                : 'Completa el mantenimiento para devolver el equipo a bodega o reasignarlo.'}
            </span>
            <a
              href={`/inventory/maintenance/${maintenanceRecords[0].id}`}
              className="ml-4 flex items-center gap-1 text-sm font-medium text-yellow-700 underline underline-offset-2 hover:text-yellow-900 flex-shrink-0"
            >
              Ver mantenimiento <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      )}
      {/* Banner de solicitud pendiente para cliente */}
      {!isInMaintenance && maintenanceRecords && maintenanceRecords.some((r: any) => r.status === 'REQUESTED') && (
        <Alert className="border-blue-300 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 flex items-center justify-between">
            <span>
              <span className="font-medium">Solicitud de mantenimiento pendiente.</span>{' '}
              {userRole === 'CLIENT'
                ? 'Tu solicitud está siendo revisada por el equipo técnico.'
                : 'Hay una solicitud de mantenimiento pendiente de aprobación.'}
            </span>
            {maintenanceRecords.find((r: any) => r.status === 'REQUESTED') && (
              <a
                href={`/inventory/maintenance/${maintenanceRecords.find((r: any) => r.status === 'REQUESTED').id}`}
                className="ml-4 flex items-center gap-1 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900 flex-shrink-0"
              >
                Ver solicitud <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}
      {isAssigned && currentAssignment && (
        <Alert className="border-blue-300 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <span className="font-medium">Equipo asignado</span> a{' '}
            <span className="font-medium">{currentAssignment.receiver?.name}</span> desde el{' '}
            {new Date(currentAssignment.startDate).toLocaleDateString('es-ES')}.
            {(userRole === 'ADMIN' || userRole === 'TECHNICIAN') && ' Para reasignarlo, primero devuélvelo a bodega.'}
          </AlertDescription>
        </Alert>
      )}
      {isRetired && (
        <Alert className="border-border bg-muted">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-muted-foreground">
            <span className="font-medium">Equipo dado de baja.</span>{' '}
            Ya no está activo en el inventario.
            {canPermanentDelete && ' Puedes eliminarlo definitivamente del sistema.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Dialog de asignación */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent aria-describedby={undefined}>
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
        <DialogContent aria-describedby={undefined}>
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
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {userRole === 'CLIENT' ? 'Solicitar Mantenimiento' : 'Registrar Mantenimiento'}
            </DialogTitle>
            <DialogDescription>
              {userRole === 'CLIENT'
                ? `Solicita mantenimiento para el equipo ${equipment.code}. El equipo técnico revisará tu solicitud.`
                : `Registra un mantenimiento para el equipo ${equipment.code}.`}
              {(equipment.type as any)?.family?.name && (
                <span className="block mt-1 text-xs text-muted-foreground">
                  Familia: <span className="font-medium">{(equipment.type as any).family.name}</span>
                  {equipment.type?.name ? ` · Tipo: ${equipment.type.name}` : ''}
                </span>
              )}
              {userRole !== 'CLIENT' && currentAssignment && (
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

      {/* Dialog de confirmación para dar de baja */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja el equipo</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  ¿Confirmas que el equipo{' '}
                  <span className="font-semibold">{equipment.code}</span> ({equipment.brand} {equipment.model}){' '}
                  ya no está en uso y debe darse de baja?
                </p>
                <p className="text-sm text-muted-foreground">
                  El estado cambiará a <span className="font-medium">Retirado</span>. El equipo dejará de aparecer como activo en el inventario.
                  Podrás eliminarlo definitivamente después si lo necesitas.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Procesando...' : 'Sí, dar de baja'}
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

        {/* Depreciación e Información Financiera */}
        {((equipment as any).usefulLifeYears || (equipment as any).supplierId || (equipment as any).purchasePrice || (equipment as any).invoiceNumber) && (
          <div className="space-y-4">
            <DepreciationCard
              purchasePrice={(equipment as any).purchasePrice}
              purchaseDate={(equipment as any).purchaseDate}
              usefulLifeYears={(equipment as any).usefulLifeYears}
              residualValue={(equipment as any).residualValue}
              depreciation={(equipment as any).depreciation}
            />
            <FinancialInfoSection
              supplierId={(equipment as any).supplierId}
              invoiceNumber={(equipment as any).invoiceNumber}
              purchaseOrderNumber={(equipment as any).purchaseOrderNumber}
              purchasePrice={(equipment as any).purchasePrice}
              purchaseDate={(equipment as any).purchaseDate}
              readOnly
            />
          </div>
        )}

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
            <div className="space-y-3">
              {maintenanceRecords.map((record: any) => {
                const isActive = equipment.status === 'MAINTENANCE' && record === maintenanceRecords[0]
                const statusBadge: Record<string, string> = {
                  REQUESTED: 'bg-blue-100 text-blue-800',
                  SCHEDULED: 'bg-yellow-100 text-yellow-800',
                  ACCEPTED: 'bg-purple-100 text-purple-800',
                  COMPLETED: 'bg-green-100 text-green-800',
                  CANCELLED: 'bg-muted text-muted-foreground',
                }
                const statusLabel: Record<string, string> = {
                  REQUESTED: 'Solicitado',
                  SCHEDULED: 'Programado',
                  ACCEPTED: 'Aceptado',
                  COMPLETED: 'Completado',
                  CANCELLED: 'Cancelado',
                }
                return (
                  <a
                    key={record.id}
                    href={`/inventory/maintenance/${record.id}`}
                    className={`flex justify-between items-start p-3 rounded-lg border transition-colors hover:bg-muted/50 cursor-pointer ${
                      isActive ? 'border-yellow-300 bg-yellow-50' : 'border-border'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {record.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'}
                        </span>
                        {record.status && (
                          <Badge className={`text-xs ${statusBadge[record.status] || 'bg-muted text-muted-foreground'}`}>
                            {statusLabel[record.status] || record.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{record.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(record.date)}{record.technician?.name ? ` — ${record.technician.name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {record.cost && (
                        <span className="text-sm font-medium">{formatCurrency(record.cost)}</span>
                      )}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Archivos Adjuntos */}
      <EquipmentAttachments
        equipmentId={equipmentId}
        canManage={userRole === 'ADMIN' || userRole === 'TECHNICIAN'}
      />

      {/* Dialog solicitud de baja */}
      <Dialog open={showDecommissionForm} onOpenChange={setShowDecommissionForm}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Solicitar Baja de Equipo</DialogTitle>
            <DialogDescription>
              Esta solicitud será revisada por el administrador antes de proceder.
            </DialogDescription>
          </DialogHeader>
          <DecommissionRequestForm
            assetType="EQUIPMENT"
            assetId={equipmentId}
            assetName={`${equipment.code} — ${equipment.brand} ${equipment.model}`}
            onSuccess={() => { setShowDecommissionForm(false); loadEquipmentDetail() }}
            onCancel={() => setShowDecommissionForm(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

