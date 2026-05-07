'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Package, Tag, MessageCircle } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { buildWhatsAppContactUrl } from '@/lib/whatsapp'

/**
 * Interfaz que representa un equipo en la vitrina pública.
 * Incluye solo los campos públicos expuestos por la API /api/public/assets-for-sale
 */
export interface PublicEquipmentItem {
  id: string
  code: string
  brand: string
  model: string
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR'
  photoUrl: string | null
  specifications: Record<string, string> | null
  accessories: string[] | null
  notes: string | null
  saleListingPrice: number | null
  updatedAt: string
  type: {
    id: string
    name: string
    family: {
      id: string
      name: string
      icon: string | null
      color: string | null
    }
  }
  contactWhatsapp: string | null
}

interface PublicEquipmentCardProps {
  item: PublicEquipmentItem
  onViewDetails?: () => void
}

/**
 * Mapa de colores y etiquetas para las condiciones de equipos
 */
const CONDITION_BADGE: Record<string, { label: string; className: string }> = {
  NEW: {
    label: 'Nuevo',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  LIKE_NEW: {
    label: 'Como Nuevo',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  },
  GOOD: {
    label: 'Bueno',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30',
  },
  FAIR: {
    label: 'Regular',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  POOR: {
    label: 'Malo',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
}

/**
 * Tarjeta visual que representa un equipo en la vitrina pública.
 *
 * Muestra:
 * - Foto (o placeholder si no hay)
 * - Marca + modelo
 * - Tipo de equipo y familia
 * - Condición con badge de color
 * - Precio de venta o "Consultar precio"
 * - Badge "En venta"
 * - Botón "Ver detalles" que abre el Sheet lateral con la ficha completa
 *
 * El botón de contacto:
 * - Si `contactWhatsapp` está definido: abre WhatsApp con mensaje pre-formateado
 * - Si es null: redirige a /login
 */
export function PublicEquipmentCard({ item, onViewDetails }: PublicEquipmentCardProps) {
  const [imageError, setImageError] = useState(false)

  const conditionBadge = CONDITION_BADGE[item.condition] ?? {
    label: item.condition,
    className: 'bg-muted text-muted-foreground border-border',
  }

  const hasDetails =
    (item.specifications && Object.keys(item.specifications).length > 0) ||
    (item.accessories && item.accessories.length > 0) ||
    (item.notes && item.notes.trim().length > 0)

  return (
    <Card className='overflow-hidden hover:shadow-md transition-shadow'>
      {/* Imagen del equipo */}
      <div className='relative aspect-video bg-muted'>
        {item.photoUrl && !imageError ? (
          <Image
            src={item.photoUrl}
            alt={`${item.brand} ${item.model}`}
            fill
            className='object-cover'
            onError={() => setImageError(true)}
          />
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Package className='h-16 w-16 text-muted-foreground/30' />
          </div>
        )}

        {/* Badge "En venta" en la esquina superior derecha */}
        <div className='absolute top-2 right-2'>
          <Badge className='bg-amber-500/90 text-white border-amber-600 shadow-sm'>
            <Tag className='h-3 w-3 mr-1' />
            En venta
          </Badge>
        </div>
      </div>

      <CardContent className='p-4 space-y-3'>
        {/* Marca y modelo */}
        <div>
          <h3 className='font-semibold text-lg leading-tight'>
            {item.brand} {item.model}
          </h3>
          <p className='text-sm text-muted-foreground mt-0.5'>{item.type.name}</p>
        </div>

        {/* Familia y condición */}
        <div className='flex items-center gap-2 flex-wrap'>
          <Badge variant='outline' className='text-xs'>
            {item.type.family.name}
          </Badge>
          <Badge className={`text-xs border ${conditionBadge.className}`}>
            {conditionBadge.label}
          </Badge>
        </div>

        {/* Precio */}
        <div className='pt-2 border-t border-border'>
          <p className='text-sm text-muted-foreground'>Precio</p>
          <p className='text-xl font-bold text-foreground'>
            {item.saleListingPrice ? formatCurrency(item.saleListingPrice) : 'Consultar precio'}
          </p>
        </div>

        {/* Botón Ver detalles */}
        {hasDetails && onViewDetails && (
          <Button variant='outline' size='sm' onClick={onViewDetails} className='w-full gap-2 mt-2'>
            Ver detalles
          </Button>
        )}
      </CardContent>

      <CardFooter className='p-4 pt-0'>
        {/* Botón de contacto */}
        {item.contactWhatsapp ? (
          <a
            href={buildWhatsAppContactUrl(item.contactWhatsapp, {
              brand: item.brand,
              model: item.model,
              type: item.type.name,
              family: item.type.family.name,
              condition: item.condition,
              code: item.code,
              saleListingPrice: item.saleListingPrice,
            })}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition-colors'
          >
            <MessageCircle className='h-4 w-4' />
            Contactar por WhatsApp
          </a>
        ) : (
          <Button asChild variant='default' className='w-full gap-2'>
            <Link href='/login'>
              <MessageCircle className='h-4 w-4' />
              Contactar
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
