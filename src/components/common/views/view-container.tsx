/**
 * ViewContainer - Contenedor unificado para todas las vistas
 * Proporciona estructura automática con header, paginación y estados
 * Fase 13.3 - Sistema Unificado de Vistas
 */

'use client'

import { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ViewHeader, PaginationConfig, EmptyState } from '@/types/views'

interface ViewContainerProps {
  // Header
  header?: ViewHeader
  
  // Contenido
  children: ReactNode
  
  // Estados
  loading?: boolean
  error?: string | null
  isEmpty?: boolean
  
  // Empty state
  emptyState?: EmptyState
  
  // Paginación
  pagination?: PaginationConfig
  renderPagination?: (config: PaginationConfig) => ReactNode
  
  // Callbacks
  onRefresh?: () => void
  
  // Estilos
  className?: string
  contentClassName?: string
}

export function ViewContainer({
  header,
  children,
  loading = false,
  error = null,
  isEmpty = false,
  emptyState,
  pagination,
  renderPagination,
  onRefresh,
  className,
  contentClassName
}: ViewContainerProps) {
  
  // Renderizar paginación por defecto
  const defaultPaginationRenderer = (config: PaginationConfig) => {
    const totalPages = Math.ceil(config.total / config.limit)
    const startItem = (config.page - 1) * config.limit + 1
    const endItem = Math.min(config.page * config.limit, config.total)
    
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            Mostrando {startItem} a {endItem} de {config.total} elementos
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={config.limit}
            onChange={(e) => config.onLimitChange(Number(e.target.value))}
            className="px-3 py-1 border border-border rounded text-sm bg-background"
          >
            {(config.options || [10, 20, 50, 100]).map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => config.onPageChange(config.page - 1)}
            disabled={config.page <= 1}
            className={cn(
              "px-3 py-1 border border-border rounded text-sm transition-colors",
              config.page <= 1
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-background hover:bg-muted"
            )}
          >
            Anterior
          </button>
          
          <span className="text-sm">
            Página {config.page} de {totalPages}
          </span>
          
          <button
            onClick={() => config.onPageChange(config.page + 1)}
            disabled={config.page >= totalPages}
            className={cn(
              "px-3 py-1 border border-border rounded text-sm transition-colors",
              config.page >= totalPages
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-background hover:bg-muted"
            )}
          >
            Siguiente
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <Card className={className}>
      {/* Header descriptivo */}
      {header && (
        <CardHeader>
          <div className="border-b pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 mb-1">
                {header.icon && (
                  <div className="text-muted-foreground">{header.icon}</div>
                )}
                <h3 className="text-sm font-medium text-foreground">
                  {header.title}
                </h3>
              </div>
              
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Actualizar"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </button>
              )}
            </div>
            
            {header.description && (
              <p className="text-xs text-muted-foreground">
                {header.description}
              </p>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent className={cn("space-y-4", contentClassName)}>
        {/* Estado de error */}
        {error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-2">Error al cargar datos</div>
            <div className="text-muted-foreground text-sm">{error}</div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Reintentar
              </button>
            )}
          </div>
        ) : loading ? (
          /* Estado de carga */
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Cargando...</span>
          </div>
        ) : isEmpty && emptyState ? (
          /* Estado vacío */
          <div className="text-center py-12">
            {emptyState.icon}
            <h3 className="text-lg font-medium text-foreground mb-2">
              {emptyState.title}
            </h3>
            <p className="text-muted-foreground mb-4">
              {emptyState.description}
            </p>
            {emptyState.action}
          </div>
        ) : (
          /* Contenido */
          <>
            <div>{children}</div>
            
            {/* Paginación integrada */}
            {pagination && pagination.total > pagination.limit && (
              <div className="border-t pt-4">
                {renderPagination 
                  ? renderPagination(pagination)
                  : defaultPaginationRenderer(pagination)
                }
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
