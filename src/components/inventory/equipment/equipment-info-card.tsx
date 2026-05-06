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

import { MapPin, Package2, Wrench, StickyNote, Tag, Warehouse } from 'lucide-react'
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

  const hasLocation = physicalLocation || equipment.location || warehouse
  const hasAccessories = equipment.accessories && equipment.accessories.length > 0
  const hasSpecs = equipment.specifications && Object.keys(equipment.specifications).length > 0
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
        <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
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
                {warehouse && (
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

        {/* ── 3. Accesorios ── */}
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

        {/* ── 4. Especificaciones técnicas ── */}
        {hasSpecs && (
          <>
            <Separator />
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                <Wrench className='h-3.5 w-3.5' />
                Especificaciones técnicas
              </p>
              <div className='rounded-md border border-border divide-y divide-border text-sm'>
                {Object.entries(equipment.specifications!).reverse().map(([key, value]) => (
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

        {/* ── 5. Observaciones ── */}
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
