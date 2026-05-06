/**
 * Custom hook for Equipment Detail module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { extractCatchError } from '@/lib/utils/api-error'
import type {
  EquipmentDetailResponse,
  AssignmentForm,
  ReturnForm,
  MaintenanceForm,
} from '@/components/inventory/equipment/utils/equipment-types'

interface UseEquipmentDetailProps {
  equipmentId: string
  userRole: string
  userId: string
  isSuperAdmin?: boolean
}

export function useEquipmentDetail({ equipmentId, userRole, userId, isSuperAdmin = false }: UseEquipmentDetailProps) {
  const router = useRouter()
  const { toast } = useToast()

  // ── Data State ──
  const [data, setData] = useState<EquipmentDetailResponse | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Dialog States ──
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false)
  const [showDecommissionForm, setShowDecommissionForm] = useState(false)
  const [showConvertToPurchaseDialog, setShowConvertToPurchaseDialog] = useState(false)

  // ── Loading States ──
  const [assigning, setAssigning] = useState(false)
  const [returning, setReturning] = useState(false)
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [permanentDeleting, setPermanentDeleting] = useState(false)

  // ── Form States ──
  const [assignForm, setAssignForm] = useState<AssignmentForm>({
    receiverId: '',
    assignmentType: 'PERMANENT',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    observations: '',
  })

  const [returnForm, setReturnForm] = useState<ReturnForm>({
    returnDate: new Date().toISOString().split('T')[0],
    observations: '',
    condition: '',
  })

  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>({
    type: 'PREVENTIVE',
    description: '',
    scheduledDate: new Date().toISOString().split('T')[0],
  })

  // ── Load Equipment Detail ──
  const loadEquipmentDetail = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/inventory/equipment/${equipmentId}`)

      if (!response.ok) {
        throw new Error('Error al cargar equipo')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      toast({
        title: 'Error',
        description: extractCatchError(err, 'No se pudo cargar el equipo'),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [equipmentId, toast])

  // ── Load QR Code ──
  const loadQRCode = useCallback(async () => {
    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}/qr`)

      if (response.ok) {
        const result = await response.json()
        setQrCode(result.qrCode)
      }
    } catch (error) {
      console.error('Error cargando QR:', error)
    }
  }, [equipmentId])

  // ── Initial Load ──
  useEffect(() => {
    loadEquipmentDetail()
    loadQRCode()
  }, [loadEquipmentDetail, loadQRCode])

  // ── Actions ──
  const handleEdit = useCallback(() => {
    router.push(`/inventory/equipment/${equipmentId}/edit`)
  }, [router, equipmentId])

  const handleDelete = useCallback(async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 409) {
          setShowDeleteDialog(false)
          toast({
            title: 'No se puede retirar el equipo',
            description:
              'El equipo tiene una asignación activa. Primero debes desasignarlo (generar acta de devolución) y luego retirarlo.',
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
  }, [equipmentId, router, toast])

  const handlePermanentDelete = useCallback(async () => {
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
  }, [equipmentId, router, toast])

  const submitAssignment = useCallback(async () => {
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
  }, [assignForm, equipmentId, data, toast, loadEquipmentDetail])

  const submitReturn = useCallback(async () => {
    const activeAssignment = data?.currentAssignment
    if (!activeAssignment) {
      toast({
        title: 'Error',
        description: 'No hay asignación activa para devolver',
        variant: 'destructive',
      })
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

      setShowReturnDialog(false)
      setReturnForm({
        returnDate: new Date().toISOString().split('T')[0],
        observations: '',
        condition: '',
      })
      setData(prev =>
        prev
          ? {
              ...prev,
              currentAssignment: undefined,
              equipment: { ...prev.equipment, status: 'AVAILABLE' as any },
            }
          : prev
      )
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
  }, [data, returnForm, toast, loadEquipmentDetail])

  const submitMaintenance = useCallback(async () => {
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
        description:
          userRole === 'CLIENT'
            ? 'Tu solicitud de mantenimiento fue enviada. El equipo técnico la revisará pronto.'
            : 'El equipo ha sido marcado en mantenimiento. El cliente asignado será notificado.',
      })

      setShowMaintenanceDialog(false)
      setMaintenanceForm({
        type: 'PREVENTIVE',
        description: '',
        scheduledDate: new Date().toISOString().split('T')[0],
      })
      loadEquipmentDetail()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'No se pudo registrar el mantenimiento',
        variant: 'destructive',
      })
    } finally {
      setSubmittingMaintenance(false)
    }
  }, [maintenanceForm, equipmentId, userRole, userId, toast, loadEquipmentDetail])

  const handleReportProblem = useCallback(() => {
    if (!data?.equipment) return
    const equipment = data.equipment
    const equipmentInfo = `Equipo: ${equipment.code} - ${equipment.brand} ${equipment.model}\nNúmero de Serie: ${equipment.serialNumber}`
    const queryParams = new URLSearchParams({
      title: `Problema con equipo ${equipment.code}`,
      description: equipmentInfo,
      equipmentId: equipment.id,
    })
    router.push(`/client/tickets/create?${queryParams.toString()}`)
  }, [data, router])

  const downloadQR = useCallback(() => {
    if (!qrCode || !data?.equipment) return

    const link = document.createElement('a')
    link.href = qrCode
    link.download = `qr-${data.equipment.code}.png`
    link.click()
  }, [qrCode, data])

  // ── Computed Values ──
  const equipment = data?.equipment
  const currentAssignment = data?.currentAssignment
  const history = data?.history || []
  const maintenanceRecords = data?.maintenanceRecords || []

  const isAdmin = userRole === 'ADMIN'
  const isRetired = equipment?.status === 'RETIRED'
  const isAssigned = equipment?.status === 'ASSIGNED' || !!currentAssignment
  const isInMaintenance = equipment?.status === 'MAINTENANCE'

  const canManage = userRole === 'ADMIN' || userRole === 'TECHNICIAN' || data?.canManageInventory
  const canEdit = canManage && !isRetired
  const canAssign = canManage && equipment?.status === 'AVAILABLE'
  const canReturn = canManage && isAssigned
  const canMaintenance = canManage && !isRetired && !isInMaintenance

  const hasActiveMaintenance =
    isInMaintenance ||
    maintenanceRecords.some(r => ['REQUESTED', 'SCHEDULED', 'ACCEPTED'].includes(r.status || ''))
  const canRequestMaintenance =
    userRole === 'CLIENT' && currentAssignment?.receiverId === userId && !hasActiveMaintenance

  const canRetire = canManage && !isRetired && !isAssigned
  // SuperAdmin puede eliminar permanentemente cualquier equipo no asignado (sin importar estado)
  // Admin normal solo puede eliminar equipos RETIRED
  const canPermanentDelete = isAdmin && (isRetired || (isSuperAdmin && !isAssigned))
  const canReportProblem = userRole === 'CLIENT' && currentAssignment?.receiverId === userId
  // Conversión a activo propio: solo para RENTAL/LOAN, no retirados, con permisos de gestión
  const canConvertToPurchase =
    canManage &&
    !isRetired &&
    (equipment?.ownershipType === 'RENTAL' || equipment?.ownershipType === 'LOAN')

  return {
    // Data
    data,
    equipment,
    currentAssignment,
    history,
    maintenanceRecords,
    qrCode,

    // State
    loading,

    // Dialog States
    showAssignDialog,
    setShowAssignDialog,
    showReturnDialog,
    setShowReturnDialog,
    showMaintenanceDialog,
    setShowMaintenanceDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    showPermanentDeleteDialog,
    setShowPermanentDeleteDialog,
    showDecommissionForm,
    setShowDecommissionForm,
    showConvertToPurchaseDialog,
    setShowConvertToPurchaseDialog,

    // Loading States
    assigning,
    returning,
    submittingMaintenance,
    deleting,
    permanentDeleting,

    // Form States
    assignForm,
    setAssignForm,
    returnForm,
    setReturnForm,
    maintenanceForm,
    setMaintenanceForm,

    // Computed
    isAdmin,
    isRetired,
    isAssigned,
    isInMaintenance,
    canEdit,
    canAssign,
    canReturn,
    canMaintenance,
    canRequestMaintenance,
    canRetire,
    canPermanentDelete,
    canReportProblem,
    hasActiveMaintenance,
    canConvertToPurchase,

    // Actions
    loadEquipmentDetail,
    handleEdit,
    handleDelete,
    handlePermanentDelete,
    submitAssignment,
    submitReturn,
    submitMaintenance,
    handleReportProblem,
    downloadQR,
  }
}
