'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  PublicEquipmentCard,
  PublicEquipmentItem,
} from '@/components/inventory/public/PublicEquipmentCard'

interface ForSaleSectionProps {
  items: PublicEquipmentItem[]
}

/**
 * Sección de equipos en venta para la landing page.
 *
 * Características:
 * - Agrupa equipos por familia cuando hay múltiples familias
 * - Muestra tarjetas PublicEquipmentCard para cada equipo
 * - Cada tarjeta recibe contactWhatsapp desde el item (resuelto por la API)
 * - Incluye enlace "Ver todos" que redirige a /verify/equipment/for-sale
 *
 * Requisitos: 7.3, 7.4, 7.5, 7.6
 */
export function ForSaleSection({ items }: ForSaleSectionProps) {
  if (items.length === 0) {
    return null
  }

  // Agrupar equipos por familia
  const familyGroups = new Map<
    string,
    {
      familyId: string
      familyName: string
      items: PublicEquipmentItem[]
    }
  >()

  for (const item of items) {
    const familyId = item.type.family.id
    const familyName = item.type.family.name

    if (!familyGroups.has(familyId)) {
      familyGroups.set(familyId, {
        familyId,
        familyName,
        items: [],
      })
    }

    familyGroups.get(familyId)!.items.push(item)
  }

  const families = Array.from(familyGroups.values())
  const hasMultipleFamilies = families.length > 1

  return (
    <section id='equipos-en-venta' className='py-20 bg-muted/30 relative overflow-hidden'>
      <div className='relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        {/* Header de la sección */}
        <div className='text-center mb-14'>
          <div className='flex items-center justify-center gap-3 mb-4'>
            <div className='h-px w-12 bg-primary/40' />
            <span className='text-primary text-sm font-semibold uppercase tracking-widest'>
              Equipos en Venta
            </span>
            <div className='h-px w-12 bg-primary/40' />
          </div>
          <h2 className='text-3xl sm:text-4xl font-bold text-foreground mb-3'>
            Activos Disponibles
          </h2>
          <p className='text-muted-foreground text-lg max-w-2xl mx-auto'>
            Equipos de calidad disponibles para la venta
          </p>
        </div>

        {/* Grid de equipos agrupados por familia */}
        <div className='space-y-12 mb-8'>
          {families.map(family => (
            <div key={family.familyId}>
              {/* Mostrar encabezado de familia solo si hay múltiples familias */}
              {hasMultipleFamilies && (
                <h3 className='text-2xl font-semibold text-foreground mb-6 flex items-center gap-2'>
                  <span className='h-1 w-8 bg-primary rounded-full' />
                  {family.familyName}
                </h3>
              )}

              {/* Grid de tarjetas de equipos */}
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
                {family.items.map(item => (
                  <PublicEquipmentCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Enlace "Ver todos" */}
        <div className='text-center'>
          <Button asChild variant='outline' size='lg'>
            <Link href='/verify/equipment/for-sale'>Ver todos los equipos →</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
