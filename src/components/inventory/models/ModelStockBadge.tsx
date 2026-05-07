/**
 * ModelStockBadge Component
 * Badge que muestra el stock disponible de un modelo con colores según disponibilidad
 */

'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StockInfo {
  total: number
  available: number
  assigned: number
  maintenance: number
  forSale: number
  sold: number
  retired: number
}

interface ModelStockBadgeProps {
  modelId: string
  showDetails?: boolean
  className?: string
}

export function ModelStockBadge({ modelId, showDetails = false, className }: ModelStockBadgeProps) {
  const [stock, setStock] = useState<StockInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchStock = async () => {
      try {
        setLoading(true)
        setError(false)

        const response = await fetch(`/api/inventory/models/${modelId}/stock`)
        if (!response.ok) throw new Error('Error al obtener stock')

        const data = await response.json()
        setStock(data.stock)
      } catch (err) {
        console.error('Error fetching stock:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    if (modelId) {
      fetchStock()
    }
  }, [modelId])

  if (loading) {
    return (
      <Badge variant='secondary' className={cn('gap-1', className)}>
        <Loader2 className='h-3 w-3 animate-spin' />
        <span className='text-xs'>Cargando...</span>
      </Badge>
    )
  }

  if (error || !stock) {
    return (
      <Badge variant='destructive' className={className}>
        Error
      </Badge>
    )
  }

  // Determinar color según disponibilidad
  const getVariant = (available: number) => {
    if (available === 0) return 'destructive'
    if (available <= 5) return 'warning'
    return 'success'
  }

  const variant = getVariant(stock.available)

  if (showDetails) {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        <Badge variant={variant}>
          {stock.available} disponible{stock.available !== 1 ? 's' : ''}
        </Badge>
        {stock.assigned > 0 && (
          <Badge variant='secondary'>
            {stock.assigned} asignado{stock.assigned !== 1 ? 's' : ''}
          </Badge>
        )}
        {stock.maintenance > 0 && (
          <Badge variant='secondary'>{stock.maintenance} en mantenimiento</Badge>
        )}
        {stock.forSale > 0 && <Badge variant='secondary'>{stock.forSale} en venta</Badge>}
        {stock.sold > 0 && (
          <Badge variant='outline'>
            {stock.sold} vendido{stock.sold !== 1 ? 's' : ''}
          </Badge>
        )}
        {stock.retired > 0 && (
          <Badge variant='outline'>
            {stock.retired} retirado{stock.retired !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Badge variant={variant} className={className}>
      {stock.available} disponible{stock.available !== 1 ? 's' : ''}
    </Badge>
  )
}

// Variante simple para mostrar solo el número
export function ModelStockCount({ modelId }: { modelId: string }) {
  const [available, setAvailable] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const response = await fetch(`/api/inventory/models/${modelId}/stock`)
        if (!response.ok) throw new Error('Error al obtener stock')

        const data = await response.json()
        setAvailable(data.stock.available)
      } catch (err) {
        console.error('Error fetching stock:', err)
      } finally {
        setLoading(false)
      }
    }

    if (modelId) {
      fetchStock()
    }
  }, [modelId])

  if (loading) return <span className='text-muted-foreground'>...</span>
  if (available === null) return <span className='text-destructive'>Error</span>

  return (
    <span
      className={cn(
        'font-medium',
        available === 0 && 'text-destructive',
        available > 0 && available <= 5 && 'text-yellow-600',
        available > 5 && 'text-green-600'
      )}
    >
      {available}
    </span>
  )
}
