'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Package, Tag, MessageCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/utils'
import { buildWhatsAppContactUrl } from '@/lib/whatsapp'
import { PublicEquipmentItem } from './PublicEquipmentCard'

interface EquipmentDetailSheetProps {
  item: PublicEquipmentItem
  onClose: () => void
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
 * Componente que muestra la ficha completa de un equipo en el Sheet lateral.
 *
 * Muestra:
 * - Imagen del equipo
 * - Marca, modelo, tipo y familia
 * - Condición con badge
 * - Precio de venta
 * - Especificaciones técnicas como tabla clave-valor
 * - Accesorios incluidos como chips
 * - Notas/observaciones
 * - Botón de contacto (WhatsApp o login)
 *
 * Requisitos: 8.5 (expansión), 9.7
 */
export function EquipmentDetailSheet({ item }: EquipmentDetailSheetProps) {
  const conditionBadge = CONDITION_BADGE[item.condition] ?? {
    label: item.condition,
    className: 'bg-muted text-muted-foreground border-border',
  }

  const hasSpecifications = item.specifications && Object.keys(item.specifications).length > 0
  const hasAccessories = item.accessories && item.accessories.length > 0
  const hasNotes = item.notes && item.notes.trim().length > 0

  return (
    <div className='space-y-6'>
      {/* Header */}
      <SheetHeader>
        <SheetTitle className='text-2xl'>
          {item.brand} {item.model}
        </SheetTitle>
        <SheetDescription>
          {item.type.name} · {item.type.family.name}
        </SheetDescription>
      </SheetHeader>

      {/* Imagen del equipo */}
      <div className='relative aspect-video bg-muted rounded-lg overflow-hidden'>
        {item.photoUrl ? (
          <Image
            src={item.photoUrl}
            alt={`${item.brand} ${item.model}`}
            fill
            className='object-cover'
          />
        ) : (
          <div className='flex items-center justify-center h-full'>
            <Package className='h-20 w-20 text-muted-foreground/30' />
          </div>
        )}

        {/* Badge "En venta" */}
        <div className='absolute top-3 right-3'>
          <Badge className='bg-amber-500/90 text-white border-amber-600 shadow-sm'>
            <Tag className='h-3.5 w-3.5 mr-1.5' />
            En venta
          </Badge>
        </div>
      </div>

      {/* Información básica */}
      <div className='space-y-4'>
        {/* Condición */}
        <div>
          <p className='text-sm font-medium text-muted-foreground mb-2'>Condición</p>
          <Badge className={`text-sm border ${conditionBadge.className}`}>
            {conditionBadge.label}
          </Badge>
        </div>

        {/* Precio */}
        <div className='p-4 rounded-lg bg-muted/50 border border-border'>
          <p className='text-sm font-medium text-muted-foreground mb-1'>Precio de venta</p>
          <p className='text-2xl font-bold text-foreground'>
            {item.saleListingPrice ? formatCurrency(item.saleListingPrice) : 'Consultar precio'}
          </p>
        </div>

        {/* Código del equipo */}
        <div>
          <p className='text-sm font-medium text-muted-foreground mb-1'>Código</p>
          <p className='text-sm font-mono text-foreground'>{item.code}</p>
        </div>
      </div>

      {/* Especificaciones técnicas */}
      {hasSpecifications && (
        <div className='space-y-3'>
          <h3 className='text-lg font-semibold'>Especificaciones Técnicas</h3>
          <div className='rounded-lg border border-border overflow-hidden'>
            <table className='w-full'>
              <tbody className='divide-y divide-border'>
                {Object.entries(item.specifications!).map(([key, value], idx) => (
                  <tr key={key} className={idx % 2 === 0 ? 'bg-muted/30' : 'bg-background'}>
                    <td className='px-4 py-3 text-sm font-medium text-muted-foreground w-2/5'>
                      {key}
                    </td>
                    <td className='px-4 py-3 text-sm text-foreground'>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accesorios incluidos */}
      {hasAccessories && (
        <div className='space-y-3'>
          <h3 className='text-lg font-semibold'>Accesorios Incluidos</h3>
          <div className='flex flex-wrap gap-2'>
            {item.accessories!.map((accessory, idx) => (
              <Badge key={idx} variant='secondary' className='text-sm px-3 py-1'>
                {accessory}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notas/Observaciones */}
      {hasNotes && (
        <div className='space-y-3'>
          <h3 className='text-lg font-semibold'>Observaciones</h3>
          <div className='p-4 rounded-lg bg-muted/50 border border-border'>
            <p className='text-sm text-muted-foreground whitespace-pre-wrap'>{item.notes}</p>
          </div>
        </div>
      )}

      {/* Botón de contacto */}
      <div className='pt-4 border-t border-border sticky bottom-0 bg-background'>
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
            className='inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium transition-colors'
          >
            <MessageCircle className='h-5 w-5' />
            Contactar por WhatsApp
          </a>
        ) : (
          <Button asChild variant='default' className='w-full gap-2' size='lg'>
            <Link href='/login'>
              <MessageCircle className='h-5 w-5' />
              Contactar
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
