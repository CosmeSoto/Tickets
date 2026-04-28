/**
 * Equipment Info Card Component
 * Displays main equipment information
 */

import { Calendar, DollarSign, MapPin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatCurrency } from '@/lib/utils'
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

export function EquipmentInfoCard({ equipment }: EquipmentInfoCardProps) {
  return (
    <Card className='md:col-span-2'>
      <CardHeader>
        <CardTitle>Información del Equipo</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div>
            <label className='text-sm font-medium text-muted-foreground'>Estado</label>
            <div className='mt-1'>
              <Badge className={STATUS_COLORS[equipment.status]}>
                {STATUS_LABELS[equipment.status]}
              </Badge>
            </div>
          </div>
          <div>
            <label className='text-sm font-medium text-muted-foreground'>Condición</label>
            <p className='mt-1'>{CONDITION_LABELS[equipment.condition]}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-muted-foreground'>Número de Serie</label>
            <p className='mt-1 font-mono'>{equipment.serialNumber}</p>
          </div>
          <div>
            <label className='text-sm font-medium text-muted-foreground'>Tipo de Propiedad</label>
            <p className='mt-1'>{OWNERSHIP_LABELS[equipment.ownershipType]}</p>
          </div>
        </div>

        <Separator />

        <div className='grid gap-4 md:grid-cols-2'>
          {equipment.purchaseDate && (
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-muted-foreground' />
              <div>
                <label className='text-sm font-medium text-muted-foreground'>Fecha de Compra</label>
                <p className='text-sm'>{formatDate(equipment.purchaseDate)}</p>
              </div>
            </div>
          )}
          {equipment.purchasePrice && (
            <div className='flex items-center gap-2'>
              <DollarSign className='h-4 w-4 text-muted-foreground' />
              <div>
                <label className='text-sm font-medium text-muted-foreground'>
                  Precio de Compra
                </label>
                <p className='text-sm'>{formatCurrency(equipment.purchasePrice)}</p>
              </div>
            </div>
          )}
          {equipment.warrantyExpiration && (
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-muted-foreground' />
              <div>
                <label className='text-sm font-medium text-muted-foreground'>
                  Vencimiento de Garantía
                </label>
                <p className='text-sm'>{formatDate(equipment.warrantyExpiration)}</p>
              </div>
            </div>
          )}
          {equipment.location && (
            <div className='flex items-center gap-2'>
              <MapPin className='h-4 w-4 text-muted-foreground' />
              <div>
                <label className='text-sm font-medium text-muted-foreground'>Ubicación</label>
                <p className='text-sm'>{equipment.location}</p>
              </div>
            </div>
          )}
        </div>

        {equipment.accessories && equipment.accessories.length > 0 && (
          <>
            <Separator />
            <div>
              <label className='text-sm font-medium text-muted-foreground'>Accesorios</label>
              <div className='mt-2 flex flex-wrap gap-2'>
                {equipment.accessories.map((accessory, index) => (
                  <Badge key={index} variant='outline'>
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
              <label className='text-sm font-medium text-muted-foreground'>
                Especificaciones Técnicas
              </label>
              <div className='mt-2 space-y-2'>
                {Object.entries(equipment.specifications).map(([key, value]) => (
                  <div key={key} className='flex justify-between text-sm'>
                    <span className='font-medium'>{key}:</span>
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
              <label className='text-sm font-medium text-muted-foreground'>Notas</label>
              <p className='mt-2 text-sm whitespace-pre-wrap'>{equipment.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
