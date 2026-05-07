/**
 * StockIndicatorBadge
 *
 * Badge que muestra información de stock para un modelo específico
 * - Muestra "Stock actual: X unidades (Y disponibles)"
 * - Color según disponibilidad: verde (>5), amarillo (1-5), rojo (0)
 * - Clickeable para abrir popover con desglose por estado
 * - Actualización en tiempo real al cambiar marca/modelo/tipo
 * - Mensaje especial para modelos nuevos
 */

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Info, Loader2 } from 'lucide-react'
import type { StockInfo } from '@/types/equipment-grouping'
import { getStockIndicatorColor } from '@/types/equipment-grouping'

export interface StockIndicatorBadgeProps {
  brand: string
  model: string
  typeId: string
}

/**
 * Obtiene la variante del badge según el color
 */
function getBadgeVariant(
  color: 'green' | 'yellow' | 'red'
): 'default' | 'secondary' | 'destructive' {
  switch (color) {
    case 'green':
      return 'default'
    case 'yellow':
      return 'secondary'
    case 'red':
      return 'destructive'
  }
}

export function StockIndicatorBadge({ brand, model, typeId }: StockIndicatorBadgeProps) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar información de stock
  useEffect(() => {
    const fetchStockInfo = async () => {
      // Validar que todos los parámetros estén presentes
      if (!brand || !model || !typeId) {
        setStockInfo(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          brand,
          model,
          typeId,
        })

        const response = await fetch(`/api/inventory/equipment/stock?${params}`)

        if (!response.ok) {
          throw new Error('Error al obtener información de stock')
        }

        const data = await response.json()
        setStockInfo(data)
      } catch (err: any) {
        setError(err.message || 'Error desconocido')
        setStockInfo(null)
      } finally {
        setLoading(false)
      }
    }

    fetchStockInfo()
  }, [brand, model, typeId])

  // Si no hay datos suficientes, no mostrar nada
  if (!brand || !model || !typeId) {
    return null
  }

  // Estado de carga
  if (loading) {
    return (
      <Badge variant='outline' className='gap-2'>
        <Loader2 className='h-3 w-3 animate-spin' />
        Consultando stock...
      </Badge>
    )
  }

  // Estado de error
  if (error) {
    return (
      <Badge variant='destructive' className='gap-2'>
        <Info className='h-3 w-3' />
        Error al consultar stock
      </Badge>
    )
  }

  // Sin información de stock
  if (!stockInfo) {
    return null
  }

  // Modelo nuevo (sin unidades existentes)
  if (stockInfo.isNewModel) {
    return (
      <Badge variant='outline' className='gap-2'>
        <Info className='h-3 w-3' />
        Nuevo modelo - será el primero
      </Badge>
    )
  }

  // Determinar color del badge
  const color = getStockIndicatorColor(stockInfo.available)
  const variant = getBadgeVariant(color)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant={variant}
          className='cursor-pointer hover:opacity-80 transition-opacity gap-2'
        >
          <Info className='h-3 w-3' />
          Stock actual: {stockInfo.total} unidades ({stockInfo.available} disponibles)
        </Badge>
      </PopoverTrigger>
      <PopoverContent className='w-80'>
        <div className='space-y-3'>
          <div>
            <h4 className='font-semibold text-sm mb-1'>Desglose de Stock</h4>
            <p className='text-xs text-muted-foreground'>
              {brand} {model}
            </p>
          </div>

          <div className='space-y-2'>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-muted-foreground'>Total:</span>
              <span className='font-semibold'>{stockInfo.total}</span>
            </div>

            <div className='border-t pt-2 space-y-1'>
              <div className='flex justify-between items-center'>
                <span className='text-sm'>Disponibles:</span>
                <Badge variant='default'>{stockInfo.available}</Badge>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>Asignadas:</span>
                <Badge variant='secondary'>{stockInfo.assigned}</Badge>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>En mantenimiento:</span>
                <Badge variant='outline'>{stockInfo.maintenance}</Badge>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>En venta:</span>
                <Badge variant='default'>{stockInfo.forSale}</Badge>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>Vendidas:</span>
                <Badge variant='destructive'>{stockInfo.sold}</Badge>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm'>Retiradas:</span>
                <Badge variant='destructive'>{stockInfo.retired}</Badge>
              </div>
            </div>
          </div>

          <div className='border-t pt-2'>
            <p className='text-xs text-muted-foreground'>
              Última actualización:{' '}
              {new Date(stockInfo.lastUpdated).toLocaleString('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
