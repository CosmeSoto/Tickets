'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Package, User, Calendar, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface ActDetailsDisplayProps {
  act: DeliveryAct
  showStatus?: boolean
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pendiente', variant: 'secondary' as const, icon: AlertCircle },
  ACCEPTED: { label: 'Aceptada', variant: 'default' as const, icon: CheckCircle },
  REJECTED: { label: 'Rechazada', variant: 'destructive' as const, icon: AlertCircle },
  EXPIRED: { label: 'Expirada', variant: 'secondary' as const, icon: AlertCircle },
}

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
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

const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export function ActDetailsDisplay({ act, showStatus = true }: ActDetailsDisplayProps) {
  const statusConfig = STATUS_CONFIG[act.status as keyof typeof STATUS_CONFIG]
  const StatusIcon = statusConfig.icon

  const formatDate = (date: Date | string) => {
    return format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: es })
  }

  const formatDateTime = (date: Date | string) => {
    return format(new Date(date), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })
  }

  return (
    <div className="space-y-6">
      {/* Header con Folio y Estado */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Acta de Entrega</CardTitle>
              <CardDescription className="text-lg font-mono mt-1">
                {act.folio}
              </CardDescription>
            </div>
            {showStatus && (
              <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusConfig.label}
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Información del Equipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Información del Equipo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Código</p>
              <p className="font-medium">{act.equipmentSnapshot.code}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Número de Serie</p>
              <p className="font-medium">{act.equipmentSnapshot.serialNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Marca</p>
              <p className="font-medium">{act.equipmentSnapshot.brand}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Modelo</p>
              <p className="font-medium">{act.equipmentSnapshot.model}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tipo</p>
              <p className="font-medium">
                {EQUIPMENT_TYPE_LABELS[act.equipmentSnapshot.type] || act.equipmentSnapshot.type}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Condición</p>
              <p className="font-medium">
                {EQUIPMENT_CONDITION_LABELS[act.equipmentSnapshot.condition] || act.equipmentSnapshot.condition}
              </p>
            </div>
          </div>

          {act.equipmentSnapshot.specifications && Object.keys(act.equipmentSnapshot.specifications).length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Especificaciones Técnicas</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(act.equipmentSnapshot.specifications).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground">{key}:</span>{' '}
                      <span className="font-medium">{value as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Accesorios */}
      {act.accessories && act.accessories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Accesorios Incluidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {act.accessories.map((accessory, index) => (
                <li key={index} className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{accessory}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Información de Entrega */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información de Entrega
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Entregado por</p>
              <div className="space-y-1">
                <p className="font-medium">{act.delivererInfo.name}</p>
                <p className="text-sm text-muted-foreground">{act.delivererInfo.email}</p>
                {act.delivererInfo.department && (
                  <p className="text-sm text-muted-foreground">{act.delivererInfo.department}</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Recibido por</p>
              <div className="space-y-1">
                <p className="font-medium">{act.receiverInfo.name}</p>
                <p className="text-sm text-muted-foreground">{act.receiverInfo.email}</p>
                {act.receiverInfo.department && (
                  <p className="text-sm text-muted-foreground">{act.receiverInfo.department}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Fechas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Fecha de Creación</p>
            <p className="font-medium">{formatDateTime(act.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fecha de Expiración</p>
            <p className="font-medium">{formatDate(act.expirationDate)}</p>
          </div>
          {act.acceptedAt && (
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Aceptación</p>
              <p className="font-medium">{formatDateTime(act.acceptedAt)}</p>
            </div>
          )}
          {act.rejectedAt && (
            <div>
              <p className="text-sm text-muted-foreground">Fecha de Rechazo</p>
              <p className="font-medium">{formatDateTime(act.rejectedAt)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      {act.observations && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{act.observations}</p>
          </CardContent>
        </Card>
      )}

      {/* Razón de Rechazo */}
      {act.status === 'REJECTED' && act.rejectionReason && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Razón de Rechazo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{act.rejectionReason}</p>
          </CardContent>
        </Card>
      )}

      {/* Firma Digital (si está aceptada) */}
      {act.status === 'ACCEPTED' && act.verificationHash && (
        <Card>
          <CardHeader>
            <CardTitle>Firma Digital</CardTitle>
            <CardDescription>
              Esta acta ha sido firmada digitalmente y puede ser verificada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Hash de Verificación</p>
              <p className="font-mono text-xs break-all">{act.verificationHash}</p>
            </div>
            {act.signatureTimestamp && (
              <div>
                <p className="text-sm text-muted-foreground">Fecha y Hora de Firma</p>
                <p className="font-medium">{formatDateTime(act.signatureTimestamp)}</p>
              </div>
            )}
            {act.signatureIp && (
              <div>
                <p className="text-sm text-muted-foreground">Dirección IP</p>
                <p className="font-mono text-sm">{act.signatureIp}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
