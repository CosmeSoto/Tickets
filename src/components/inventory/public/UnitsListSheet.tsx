/**
 * UnitsListSheet
 *
 * Sheet que muestra la lista de unidades individuales de un grupo
 * - Muestra tabla con código, número de serie, fecha de ingreso
 * - Botón "Contactar por esta unidad" para cada unidad
 * - Genera mensaje de WhatsApp con código específico de la unidad
 */

'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageCircle } from 'lucide-react'
import type { EquipmentGroup, PublicEquipmentItem } from '@/types/equipment-grouping'
import { generateUnitContactMessage, generateWhatsAppUrl } from '@/lib/utils/whatsapp-messages'

export interface UnitsListSheetProps {
  group: EquipmentGroup
  open: boolean
  onClose: () => void
  onContactUnit: (unit: PublicEquipmentItem) => void
}

/**
 * Formatea la fecha en formato corto
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

/**
 * Traduce la condición al español
 */
function translateCondition(condition: string): string {
  const translations: Record<string, string> = {
    NEW: 'Nuevo',
    GOOD: 'Bueno',
    FAIR: 'Regular',
    POOR: 'Malo',
  }
  return translations[condition] || condition
}

/**
 * Obtiene el color del badge según la condición
 */
function getConditionColor(condition: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (condition) {
    case 'NEW':
      return 'default'
    case 'GOOD':
      return 'secondary'
    case 'FAIR':
      return 'outline'
    case 'POOR':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function UnitsListSheet({ group, open, onClose, onContactUnit }: UnitsListSheetProps) {
  const [loadingUnitId, setLoadingUnitId] = useState<string | null>(null)

  const handleContactUnit = (unit: PublicEquipmentItem) => {
    setLoadingUnitId(unit.id)
    try {
      const message = generateUnitContactMessage(unit)
      const whatsappUrl = generateWhatsAppUrl(message)
      window.open(whatsappUrl, '_blank')
      onContactUnit(unit)
    } finally {
      setLoadingUnitId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side='right' className='w-full sm:max-w-2xl overflow-y-auto'>
        <SheetHeader>
          <SheetTitle>
            {group.brand} {group.model}
          </SheetTitle>
          <SheetDescription>
            {group.availableUnits} unidades disponibles • {group.type.name}
            {group.type.family && ` • ${group.type.family.name}`}
          </SheetDescription>
        </SheetHeader>

        <div className='mt-6'>
          {/* Información del grupo */}
          <div className='mb-6 p-4 bg-gray-50 rounded-lg space-y-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-gray-700'>Condición:</span>
              <Badge variant={getConditionColor(group.condition)}>
                {translateCondition(group.condition)}
              </Badge>
            </div>
            {group.saleListingPrice && (
              <div className='flex items-center justify-between'>
                <span className='text-sm font-medium text-gray-700'>Precio por unidad:</span>
                <span className='text-lg font-bold text-green-600'>
                  {new Intl.NumberFormat('es-MX', {
                    style: 'currency',
                    currency: 'MXN',
                  }).format(group.saleListingPrice)}
                </span>
              </div>
            )}
          </div>

          {/* Tabla de unidades */}
          <div className='border rounded-lg'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Número de Serie</TableHead>
                  <TableHead>Características</TableHead>
                  <TableHead>Fecha de Ingreso</TableHead>
                  <TableHead className='text-right'>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.units.map(unit => (
                  <TableRow key={unit.id}>
                    <TableCell className='font-mono text-sm'>{unit.code}</TableCell>
                    <TableCell className='font-mono text-sm text-gray-600'>
                      {unit.serialNumber || '—'}
                    </TableCell>
                    <TableCell>
                      {unit.customAttributes && Object.keys(unit.customAttributes).length > 0 ? (
                        <div className='flex flex-wrap gap-1'>
                          {Object.entries(unit.customAttributes)
                            .slice(0, 3)
                            .map(([key, attr]) => (
                              <Badge key={key} variant='secondary' className='text-xs'>
                                {attr.label}: {attr.value}
                              </Badge>
                            ))}
                          {Object.keys(unit.customAttributes).length > 3 && (
                            <Badge variant='outline' className='text-xs'>
                              +{Object.keys(unit.customAttributes).length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className='text-sm text-gray-400'>—</span>
                      )}
                    </TableCell>
                    <TableCell className='text-sm text-gray-600'>
                      {formatDate(unit.createdAt)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant='outline'
                        className='text-green-600 hover:text-green-700 hover:bg-green-50'
                        onClick={() => handleContactUnit(unit)}
                        disabled={loadingUnitId === unit.id}
                      >
                        <MessageCircle className='mr-2 h-4 w-4' />
                        {loadingUnitId === unit.id ? 'Abriendo...' : 'Contactar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Especificaciones (si existen) */}
          {group.specifications && Object.keys(group.specifications).length > 0 && (
            <div className='mt-6 p-4 bg-gray-50 rounded-lg'>
              <h4 className='text-sm font-semibold text-gray-900 mb-3'>
                Especificaciones Técnicas
              </h4>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {Object.entries(group.specifications).map(([key, value]) => (
                  <div key={key} className='flex justify-between'>
                    <span className='text-sm font-medium text-gray-700'>{key}:</span>
                    <span className='text-sm text-gray-600'>{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota informativa */}
          <div className='mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg'>
            <p className='text-sm text-blue-800'>
              <strong>Nota:</strong> Al contactar por una unidad específica, el mensaje de WhatsApp
              incluirá el código del equipo para que puedas hacer referencia exacta a la unidad que
              te interesa.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
