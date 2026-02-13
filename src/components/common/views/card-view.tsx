/**
 * CardView - Grid responsive de tarjetas con paginación
 * Unifica TicketStatsCard, TechnicianStatsCard y otros componentes de tarjetas
 * Fase 13.3 - Sistema Unificado de Vistas
 */

'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ViewContainer } from './view-container'
import type { ViewHeader, PaginationConfig, EmptyState, GridConfig } from '@/types/views'

export interface CardViewProps<T> {
  // Datos
  data: T[]
  renderCard: (item: T, index: number) => React.ReactNode
  
  // Header
  header?: ViewHeader
  
  // Grid
  columns?: GridConfig['columns']
  gap?: GridConfig['gap']
  
  // Interacción
  onCardClick?: (item: T, index: number) => void
  
  // Estilos
  className?: string
  cardClassName?: string
  
  // Estados
  loading?: boolean
  loadingCount?: number
  emptyState?: EmptyState
  
  // Paginación
  pagination?: PaginationConfig
  
  // Callbacks
  onRefresh?: () => void
}

export function CardView<T>({
  data,
  renderCard,
  header,
  columns = 3,
  gap = 4,
  onCardClick,
  className,
  cardClassName,
  loading = false,
  loadingCount = 6,
  emptyState,
  pagination,
  onRefresh
}: CardViewProps<T>) {
  
  // Clases de grid según configuración
  const gridClasses = cn(
    'grid',
    // Columnas
    columns === 1 && 'grid-cols-1',
    columns === 2 && 'grid-cols-1 md:grid-cols-2',
    columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    columns === 5 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
    columns === 6 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6',
    // Gap
    gap === 2 && 'gap-2',
    gap === 3 && 'gap-3',
    gap === 4 && 'gap-4',
    gap === 6 && 'gap-6',
    gap === 8 && 'gap-8'
  )
  
  // Si hay header o paginación, usar ViewContainer
  if (header || pagination) {
    return (
      <ViewContainer
        header={header}
        loading={loading}
        isEmpty={data.length === 0}
        emptyState={emptyState}
        pagination={pagination}
        onRefresh={onRefresh}
        className={className}
      >
        <div className={gridClasses}>
          {data.map((item, index) => (
            <div
              key={index}
              className={cn(
                onCardClick && 'cursor-pointer',
                cardClassName
              )}
              onClick={() => onCardClick?.(item, index)}
              onKeyDown={(e) => {
                if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onCardClick(item, index)
                }
              }}
              role={onCardClick ? 'button' : undefined}
              tabIndex={onCardClick ? 0 : undefined}
              aria-label={onCardClick ? `Ver detalles de la tarjeta ${index + 1}` : undefined}
            >
              {renderCard(item, index)}
            </div>
          ))}
        </div>
      </ViewContainer>
    )
  }
  
  // Versión legacy sin ViewContainer (para compatibilidad)
  // Loading skeleton
  if (loading) {
    return (
      <div className={cn(gridClasses, className)}>
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
    <div className={cn(gridClasses, className)}>
      {data.map((item, index) => (
        <div
          key={index}
          className={cn(
            onCardClick && 'cursor-pointer',
            cardClassName
          )}
          onClick={() => onCardClick?.(item, index)}
          onKeyDown={(e) => {
            if (onCardClick && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onCardClick(item, index)
            }
          }}
          role={onCardClick ? 'button' : undefined}
          tabIndex={onCardClick ? 0 : undefined}
          aria-label={onCardClick ? `Ver detalles de la tarjeta ${index + 1}` : undefined}
        >
          {renderCard(item, index)}
        </div>
      ))}
    </div>
  )
}
