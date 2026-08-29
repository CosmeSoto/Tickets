/**
 * EquipmentInfoCard — Tarjeta principal de información del equipo.
 *
 * Muestra todos los datos relevantes del activo organizados en secciones:
 * 1. Identificación (estado, condición, serie, tipo)
 * 2. Ubicación (física, bodega)
 * 3. Accesorios
 * 4. Especificaciones técnicas
 * 5. Observaciones
 */

import { MapPin, Package2, Wrench, StickyNote, Tag, Warehouse, Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  CONDITION_LABELS,
  OWNERSHIP_LABELS,
} from './utils/equipment-constants'
import type { Equipment } from './utils/equipment-types'
import { withAttributeLabels, type AttributeCatalogEntry } from '@/lib/inventory/attribute-labels'

interface EquipmentInfoCardProps {
  equipment: Equipment
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <div className='mt-0.5 text-sm font-medium'>{value}</div>
    </div>
  )
}

export function EquipmentInfoCard({ equipment }: EquipmentInfoCardProps) {
  const physicalLocation = (equipment as any).physicalLocation as string | undefined
  const warehouse = (equipment as any).warehouse as { id: string; name: string } | undefined
  const customValues = (equipment as any).customValues as
    | Array<{ fieldName: string; fieldValue: string }>
    | undefined
  const typeAttributes = (equipment as any).type?.attributes as AttributeCatalogEntry[] | undefined

  // Etiqueta y orden vienen del catálogo de atributos del tipo de equipo (ver
  // AttributeManagerDialog / TypeAttributesInput) — misma fuente que usan
  // licencias y suministros.
  const sortedCustomValues = withAttributeLabels(customValues, typeAttributes)

  const hasLocation =
    physicalLocation ||
    equipment.location ||
    (warehouse && !['ASSIGNED', 'SOLD'].includes(equipment.status))
  const hasAccessories = equipment.accessories && equipment.accessories.length > 0
  const hasSpecs = equipment.specifications && Object.keys(equipment.specifications).length > 0
  const hasCustomAttributes = sortedCustomValues && sortedCustomValues.length > 0
  const hasNotes = !!equipment.notes

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Package2 className='h-4 w-4' />
          Información del Equipo
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-5'>
        {/* ── 1. Identificación ── */}
        <div className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'>
          <div>
            <p className='text-xs text-muted-foreground'>Estado</p>
            <div className='mt-0.5'>
              <Badge className={STATUS_COLORS[equipment.status]}>
                {STATUS_LABELS[equipment.status]}
              </Badge>
            </div>
          </div>
          <InfoRow label='Condición' value={CONDITION_LABELS[equipment.condition]} />
          <InfoRow
            label='N° de Serie'
            value={<span className='font-mono text-xs'>{equipment.serialNumber}</span>}
          />
          <InfoRow label='Tipo de propiedad' value={OWNERSHIP_LABELS[equipment.ownershipType]} />
          {equipment.type?.name && <InfoRow label='Tipo de equipo' value={equipment.type.name} />}
          <InfoRow label='Marca' value={equipment.model?.brand?.name || equipment.brand} />
          <InfoRow label='Modelo' value={equipment.model?.model || equipment.modelDeprecated} />
          {(equipment as any).warrantyExpiration && (
            <InfoRow
              label='Garantía hasta'
              value={new Date((equipment as any).warrantyExpiration).toLocaleDateString('es-EC', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            />
          )}
        </div>

        {/* ── Renta / arrendamiento ── */}
        {equipment.ownershipType === 'RENTAL' && (
          <>
            <Separator />
            <div className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'>
              {equipment.rentalContractNumber && (
                <InfoRow label='N° contrato' value={equipment.rentalContractNumber} />
              )}
              {equipment.rentalDeliveryDate && (
                <InfoRow
                  label='Fecha de entrega'
                  value={new Date(equipment.rentalDeliveryDate).toLocaleDateString('es-EC', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
              )}
              {equipment.rentalEndDate && (
                <InfoRow
                  label='Fecha de retiro / fin'
                  value={new Date(equipment.rentalEndDate).toLocaleDateString('es-EC', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                />
              )}
              {equipment.rentalMonthlyCost != null && (
                <InfoRow
                  label='Costo mensual'
                  value={`$${Number(equipment.rentalMonthlyCost).toFixed(2)}`}
                />
              )}
              {equipment.rentalBuyoutValue != null && (
                <InfoRow
                  label='Valor opción de compra'
                  value={`$${Number(equipment.rentalBuyoutValue).toFixed(2)}`}
                />
              )}
              <InfoRow
                label='Respuesta del cliente'
                value={
                  (
                    {
                      NOT_NOTIFIED: 'No se ha notificado al cliente',
                      PENDING_DECISION: 'Pendiente de decisión',
                      PURCHASE_CONFIRMED: 'Compra del equipo confirmada',
                      RETURN_REQUESTED: 'Devolución solicitada',
                      RENEWAL_REQUESTED: 'Renovación solicitada',
                    } as Record<string, string>
                  )[equipment.rentalClientResponse || 'NOT_NOTIFIED']
                }
              />
            </div>
          </>
        )}

        {/* ── 1.5 Atributos Personalizados ── */}
        {hasCustomAttributes && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <Settings2 className='h-3.5 w-3.5' />
                Atributos
              </p>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                {sortedCustomValues!.map((item, i) => (
                  <InfoRow
                    key={i}
                    label={(item as any).fieldLabel ?? item.fieldName}
                    value={item.fieldValue}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 2. Ubicación ── */}
        {hasLocation && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <MapPin className='h-3.5 w-3.5' />
                Ubicación
              </p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                {warehouse && !['ASSIGNED', 'SOLD'].includes(equipment.status) && (
                  <InfoRow
                    label='Bodega'
                    value={
                      <span className='flex items-center gap-1.5'>
                        <Warehouse className='h-3.5 w-3.5 text-muted-foreground' />
                        {warehouse.name}
                      </span>
                    }
                  />
                )}
                {physicalLocation && <InfoRow label='Ubicación física' value={physicalLocation} />}
                {equipment.location && (
                  <InfoRow label='Ubicación adicional' value={equipment.location} />
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 4. Accesorios ── */}
        {hasAccessories && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <Tag className='h-3.5 w-3.5' />
                Accesorios
              </p>
              <div className='flex flex-wrap gap-1.5'>
                {equipment.accessories!.map((acc, i) => (
                  <Badge key={i} variant='secondary' className='text-xs font-normal'>
                    {acc}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── 5. Especificaciones técnicas ── */}
        {hasSpecs && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <Wrench className='h-3.5 w-3.5' />
                Especificaciones técnicas
              </p>
              <div className='rounded-md border border-border divide-y divide-border text-sm'>
                {Object.entries(equipment.specifications!)
                  .reverse()
                  .map(([key, value]) => (
                    <div key={key} className='flex items-center justify-between px-3 py-1.5'>
                      <span className='text-muted-foreground text-xs'>{key}</span>
                      <span className='font-medium text-xs text-right max-w-[60%] truncate'>
                        {String(value)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {/* ── 6. Observaciones ── */}
        {hasNotes && (
          <>
            <Separator />
            <div className='space-y-1.5'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <StickyNote className='h-3.5 w-3.5' />
                Observaciones
              </p>
              <p className='text-sm text-foreground whitespace-pre-wrap leading-relaxed'>
                {equipment.notes}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
