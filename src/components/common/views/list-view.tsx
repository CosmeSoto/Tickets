/**
 * Lista con hover states
 * Incluye onClick, empty state, loading skeleton, header y paginación
 * Fase 13.3 - Mejorado con estándares unificados
 */

'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ViewContainer } from './view-container'
import type { ViewHeader, PaginationConfig, EmptyState } from '@/types/views'

export interface ListViewProps<T> {
  // Datos
  data: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  
  // Header (NUEVO)
  header?: ViewHeader
  
  // Interacción
  onItemClick?: (item: T, index: number) => void
  
  // Estilos
  className?: string
  itemClassName?: string
  dividers?: boolean
  
  // Estados
  loading?: boolean
  loadingCount?: number
  emptyState?: EmptyState
  
  // Paginación (NUEVO)
  pagination?: PaginationConfig
  
  // Callbacks
  onRefresh?: () => void
}

export function ListView<T>({
  data,
  renderItem,
  header,
  onItemClick,
  className,
  itemClassName,
  emptyState,
  loading = false,
  loadingCount = 5,
  dividers = true,
  pagination,
  onRefresh
}: ListViewProps<T>) {
  
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
        <div className={cn(dividers && 'divide-y')}>
          {data.map((item, index) => (
            <div
              key={index}
              className={cn(
                'p-4',
                'transition-colors',
                onItemClick && 'cursor-pointer hover:bg-muted/50',
                itemClassName
              )}
              onClick={() => onItemClick?.(item, index)}
              onKeyDown={(e) => {
                if (onItemClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onItemClick(item, index)
                }
              }}
              role={onItemClick ? 'button' : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              aria-label={onItemClick ? `Ver detalles del item ${index + 1}` : undefined}
            >
              {renderItem(item, index)}
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
      <Card className={className}>
        <div className='divide-y'>
          {Array.from({ length: loadingCount }).map((_, i) => (
            <div key={i} className='p-4'>
              <div className='animate-pulse space-y-3'>
                <div className='h-4 bg-muted rounded w-3/4' />
                <div className='h-3 bg-muted rounded w-1/2' />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  // Empty state
  if (data.length === 0) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    
    return (
      <Card className={cn('p-12', className)}>
        <div className='text-center text-muted-foreground'>
          <p>No hay datos para mostrar</p>
        </div>
      </Card>
    )
  }

  // Lista de items
  return (
    <Card className={className}>
      <div className={cn(dividers && 'divide-y')}>
        {data.map((item, index) => (
          <div
            key={index}
            className={cn(
              'p-4',
              'transition-colors',
              onItemClick && 'cursor-pointer hover:bg-muted/50',
              itemClassName
            )}
            onClick={() => onItemClick?.(item, index)}
            onKeyDown={(e) => {
              if (onItemClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onItemClick(item, index)
              }
            }}
            role={onItemClick ? 'button' : undefined}
            tabIndex={onItemClick ? 0 : undefined}
            aria-label={onItemClick ? `Ver detalles del item ${index + 1}` : undefined}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </Card>
  )
}
