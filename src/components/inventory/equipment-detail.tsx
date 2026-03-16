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
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
    if (!confirm('¿Estás seguro de que deseas retirar este equipo?')) {
      return
    }

    try {
      const response = await fetch(`/api/inventory/equipment/${equipmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al eliminar equipo')
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
        description: error instanceof Error ? error.message : 'No se pudo eliminar el equipo',
        variant: 'destructive',
      })
    }
  }

  const handleAssign = () => {
    router.push(`/inventory/equipment/${equipmentId}/assign`)
  }

  const handleMaintenance = () => {
    router.push(`/inventory/equipment/${equipmentId}/maintenance`)
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
  const canEdit = userRole === 'ADMIN' || userRole === 'TECHNICIAN'
  const canDelete = userRole === 'ADMIN'
  const canAssign = (userRole === 'ADMIN' || userRole === 'TECHNICIAN') && equipment.status === 'AVAILABLE'
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
              {TYPE_LABELS[equipment.type]} - {equipment.brand} {equipment.model}
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
          {canEdit && (
            <Button onClick={handleMaintenance} variant="outline">
              <Wrench className="mr-2 h-4 w-4" />
              Mantenimiento
            </Button>
          )}
          {canDelete && equipment.status !== 'ASSIGNED' && (
            <Button onClick={handleDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Retirar
            </Button>
          )}
        </div>
      </div>

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
