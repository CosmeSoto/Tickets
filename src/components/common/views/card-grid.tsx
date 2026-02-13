/**
 * Grid responsive de tarjetas
 * Configurable con columnas, gap y empty state
 */

'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface CardGridProps<T> {
  data: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  columns?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 2 | 3 | 4 | 6 | 8
  className?: string
  emptyState?: React.ReactNode
  loading?: boolean
  loadingCount?: number
}

export function CardGrid<T>({
  data,
  renderCard,
  columns = 3,
  gap = 4,
  className,
  emptyState,
  loading = false,
  loadingCount = 6
}: CardGridProps<T>) {
  // Loading skeleton
  if (loading) {
    return (
      <div className={cn(
        'grid',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 md:grid-cols-2',
        columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        columns === 5 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        columns === 6 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
        gap === 2 && 'gap-2',
        gap === 3 && 'gap-3',
        gap === 4 && 'gap-4',
        gap === 6 && 'gap-6',
        gap === 8 && 'gap-8',
        className
      )}>
        {Array.from({ length: loadingCount }).map((_, i) => (
          <Card key={i} className='p-6'>
            <div className='animate-pulse space-y-4'>
              <div className='h-4 bg-muted rounded w-3/4' />
              <div className='h-4 bg-muted rounded w-1/2' />
              <div className='h-4 bg-muted rounded w-5/6' />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // Empty state
  if (data.length === 0) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    
    return (
      <Card className='p-12'>
        <div className='text-center text-muted-foreground'>
          <p>No hay datos para mostrar</p>
        </div>
      </Card>
    )
  }

  // Grid de tarjetas
  return (
    <div className={cn(
      'grid',
      columns === 1 && 'grid-cols-1',
      columns === 2 && 'grid-cols-1 md:grid-cols-2',
      columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
      columns === 5 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
      columns === 6 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
      gap === 2 && 'gap-2',
      gap === 3 && 'gap-3',
      gap === 4 && 'gap-4',
      gap === 6 && 'gap-6',
      gap === 8 && 'gap-8',
      className
    )}>
      {data.map((item, index) => (
        <div key={index}>
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  )
}
