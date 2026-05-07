/**
 * GroupedEquipmentCard
 *
 * Tarjeta para mostrar un grupo de equipos idénticos en la vitrina pública
 * - Muestra badge "X unidades disponibles" cuando hay múltiples unidades
 * - Botón "Ver unidades disponibles" para mostrar lista detallada
 * - Botón "Contactar" que genera mensaje de WhatsApp genérico del modelo
 * - Si solo hay 1 unidad, se muestra como tarjeta individual sin agrupación
 */

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageCircle, Package } from 'lucide-react'
import type { EquipmentGroup } from '@/types/equipment-grouping'
import { generateGroupContactMessage, generateWhatsAppUrl } from '@/lib/utils/whatsapp-messages'

export interface GroupedEquipmentCardProps {
  group: EquipmentGroup
  onViewDetails: (group: EquipmentGroup) => void
  onContactGeneral: (group: EquipmentGroup) => void
}

/**
 * Formatea el precio en formato de moneda
 */
function formatPrice(price: number | null): string {
  if (price === null) return 'Precio no disponible'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(price)
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

export function GroupedEquipmentCard({
  group,
  onViewDetails,
  onContactGeneral,
}: GroupedEquipmentCardProps) {
  const [isLoadingContact, setIsLoadingContact] = useState(false)

  const isGrouped = group.availableUnits > 1

  const handleContact = () => {
    setIsLoadingContact(true)
    try {
      const message = generateGroupContactMessage(group)
      const whatsappUrl = generateWhatsAppUrl(message)
      window.open(whatsappUrl, '_blank')
      onContactGeneral(group)
    } finally {
      setIsLoadingContact(false)
    }
  }

  const handleViewDetails = () => {
    onViewDetails(group)
  }

  return (
    <Card className='overflow-hidden hover:shadow-lg transition-shadow'>
      <CardHeader className='p-0'>
        {/* Imagen del equipo */}
        <div className='relative w-full h-48 bg-gray-100'>
          {group.photoUrl ? (
            <Image
              src={group.photoUrl}
              alt={`${group.brand} ${group.model}`}
              fill
              className='object-cover'
              sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
            />
          ) : (
            <div className='flex items-center justify-center h-full'>
              <Package className='h-16 w-16 text-gray-400' />
            </div>
          )}

          {/* Badge de unidades disponibles (solo si hay múltiples) */}
          {isGrouped && (
            <div className='absolute top-2 right-2'>
              <Badge variant='default' className='bg-blue-600 hover:bg-blue-700'>
                {group.availableUnits} unidades disponibles
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className='p-4 space-y-3'>
        {/* Marca y Modelo */}
        <div>
          <h3 className='text-lg font-semibold text-gray-900'>
            {group.brand} {group.model}
          </h3>
          <p className='text-sm text-gray-600'>
            {group.type.name}
            {group.type.family && (
              <span className='text-gray-400'> • {group.type.family.name}</span>
            )}
          </p>
        </div>

        {/* Condición */}
        <div>
          <Badge variant={getConditionColor(group.condition)}>
            {translateCondition(group.condition)}
          </Badge>
        </div>

        {/* Precio */}
        <div>
          <p className='text-2xl font-bold text-green-600'>{formatPrice(group.saleListingPrice)}</p>
          {isGrouped && <p className='text-xs text-gray-500'>Precio por unidad</p>}
        </div>

        {/* Especificaciones (si existen) */}
        {group.specifications && Object.keys(group.specifications).length > 0 && (
          <div className='pt-2 border-t'>
            <p className='text-xs font-medium text-gray-700 mb-1'>Especificaciones:</p>
            <div className='space-y-1'>
              {Object.entries(group.specifications)
                .slice(0, 3)
                .map(([key, value]) => (
                  <p key={key} className='text-xs text-gray-600'>
                    <span className='font-medium'>{key}:</span> {String(value)}
                  </p>
                ))}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className='p-4 pt-0 flex flex-col gap-2'>
        {/* Botón "Ver unidades disponibles" (solo si hay múltiples) */}
        {isGrouped && (
          <Button variant='outline' className='w-full' onClick={handleViewDetails}>
            <Package className='mr-2 h-4 w-4' />
            Ver unidades disponibles
          </Button>
        )}

        {/* Botón "Contactar" */}
        <Button
          variant='default'
          className='w-full bg-green-600 hover:bg-green-700'
          onClick={handleContact}
          disabled={isLoadingContact}
        >
          <MessageCircle className='mr-2 h-4 w-4' />
          {isLoadingContact ? 'Abriendo WhatsApp...' : 'Contactar'}
        </Button>
      </CardFooter>
    </Card>
  )
}
