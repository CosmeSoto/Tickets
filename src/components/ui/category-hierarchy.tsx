'use client'

import { ChevronRight, Home, FolderTree } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryHierarchyItem {
  id: string
  name: string
  level: number
  levelName?: string
  color: string
}

interface CategoryHierarchyProps {
  /** Ruta de jerarquía desde la raíz hasta la categoría actual */
  hierarchyPath: CategoryHierarchyItem[]
  /** Categoría actual (opcional, se puede incluir en hierarchyPath) */
  currentCategory?: {
    name: string
    level: number
    levelName?: string
    color: string
  }
  /** Estilo del componente */
  variant?: 'default' | 'compact' | 'detailed'
  /** Clase CSS adicional */
  className?: string
  /** Mostrar iconos */
  showIcons?: boolean
  /** Mostrar información de nivel */
  showLevelInfo?: boolean
}

export function CategoryHierarchy({
  hierarchyPath,
  currentCategory,
  variant = 'default',
  className,
  showIcons = true,
  showLevelInfo = true
}: CategoryHierarchyProps) {
  // Construir la ruta completa incluyendo la categoría actual si se proporciona
  const fullPath = currentCategory 
    ? [...hierarchyPath, currentCategory]
    : hierarchyPath

  if (fullPath.length === 0) {
    return null
  }

  const isCompact = variant === 'compact'
  const isDetailed = variant === 'detailed'

  return (
    <div className={cn(
      'flex items-center space-x-1 text-sm',
      isCompact && 'text-xs',
      className
    )}>
      {showIcons && (
        <Home className={cn(
          'text-gray-400 flex-shrink-0',
          isCompact ? 'h-3 w-3' : 'h-4 w-4'
        )} />
      )}
      
      {fullPath.map((item, index) => {
        const isLast = index === fullPath.length - 1
        const isFirst = index === 0
        
        return (
          <div key={(item as any).id || index} className="flex items-center space-x-1">
            {/* Separador (excepto para el primer elemento) */}
            {!isFirst && (
              <ChevronRight className={cn(
                'text-gray-400 flex-shrink-0',
                isCompact ? 'h-2 w-2' : 'h-3 w-3'
              )} />
            )}
            
            {/* Elemento de la jerarquía */}
            <div className="flex items-center space-x-1 min-w-0">
              {/* Indicador de color */}
              <div 
                className={cn(
                  'rounded-full flex-shrink-0',
                  isCompact ? 'w-2 h-2' : 'w-3 h-3'
                )}
                style={{ backgroundColor: item.color }}
              />
              
              {/* Nombre */}
              <span className={cn(
                'truncate',
                isLast ? 'font-medium text-gray-900' : 'text-gray-600',
                isCompact && 'max-w-20'
              )}>
                {item.name}
              </span>
              
              {/* Información de nivel */}
              {showLevelInfo && isDetailed && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  ({item.levelName || `Nivel ${item.level}`})
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Componente específico para mostrar jerarquía en modales
export function CategoryHierarchyModal({
  hierarchyPath,
  currentCategory,
  className
}: Omit<CategoryHierarchyProps, 'variant'>) {
  return (
    <div className={cn('bg-gray-50 p-3 rounded-lg border', className)}>
      <div className='font-medium text-gray-700 mb-2 flex items-center'>
        <FolderTree className='h-3 w-3 mr-1' />
        Jerarquía de la Categoría
      </div>
      <CategoryHierarchy
        hierarchyPath={hierarchyPath}
        currentCategory={currentCategory}
        variant="detailed"
        showIcons={false}
        className="text-gray-600"
      />
    </div>
  )
}

// Componente específico para mostrar jerarquía en tarjetas
export function CategoryHierarchyCard({
  hierarchyPath,
  currentCategory,
  color,
  className
}: Omit<CategoryHierarchyProps, 'variant'> & { color: string }) {
  return (
    <div className={cn(
      'p-3 bg-gray-50 rounded-lg border-l-4',
      className
    )} style={{ borderLeftColor: color }}>
      <div className="text-xs font-medium text-gray-700 mb-2 flex items-center">
        <FolderTree className="h-3 w-3 mr-1" />
        Jerarquía
      </div>
      <CategoryHierarchy
        hierarchyPath={hierarchyPath}
        currentCategory={currentCategory}
        variant="compact"
        showIcons={false}
        showLevelInfo={false}
        className="text-gray-600"
      />
    </div>
  )
}