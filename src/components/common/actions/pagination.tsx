/**
 * Componente de paginación completo
 * Incluye navegación, selector de tamaño de página e información
 */

'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  // Estado de paginación
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  
  // Funciones de navegación
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  
  // Configuración
  showPageSizeSelector?: boolean
  pageSizeOptions?: number[]
  showInfo?: boolean
  showFirstLast?: boolean
  maxVisiblePages?: number
  
  // Estilos
  className?: string
  disabled?: boolean
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = true,
  pageSizeOptions = [10, 20, 50, 100],
  showInfo = true,
  showFirstLast = true,
  maxVisiblePages = 7,
  className,
  disabled = false
}: PaginationProps) {
  // Calcular rango de items mostrados
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generar números de página visibles
  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = []
    
    if (totalPages <= maxVisiblePages) {
      // Mostrar todas las páginas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Mostrar con ellipsis
      const leftSiblingIndex = Math.max(currentPage - 1, 1)
      const rightSiblingIndex = Math.min(currentPage + 1, totalPages)
      
      const showLeftEllipsis = leftSiblingIndex > 2
      const showRightEllipsis = rightSiblingIndex < totalPages - 1
      
      // Primera página
      pages.push(1)
      
      // Ellipsis izquierdo
      if (showLeftEllipsis) {
        pages.push('ellipsis')
      }
      
      // Páginas del medio
      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        if (i !== 1 && i !== totalPages) {
          pages.push(i)
        }
      }
      
      // Ellipsis derecho
      if (showRightEllipsis) {
        pages.push('ellipsis')
      }
      
      // Última página
      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const visiblePages = getVisiblePages()

  // Estados de navegación
  const canGoPrev = currentPage > 1
  const canGoNext = currentPage < totalPages

  return (
    <div className={cn(
      'flex flex-col sm:flex-row items-center justify-between gap-4',
      className
    )}>
      {/* Información y selector de tamaño */}
      <div className='flex items-center gap-4'>
        {showInfo && (
          <p className='text-sm text-muted-foreground whitespace-nowrap'>
            Mostrando <span className='font-medium'>{startItem}</span> a{' '}
            <span className='font-medium'>{endItem}</span> de{' '}
            <span className='font-medium'>{totalItems}</span> resultados
          </p>
        )}
        
        {showPageSizeSelector && onPageSizeChange && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground whitespace-nowrap'>
              Por página:
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
              disabled={disabled}
            >
              <SelectTrigger className='w-[70px] h-8'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      {/* Navegación */}
      <div className='flex items-center gap-1'>
        {/* Primera página */}
        {showFirstLast && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(1)}
            disabled={!canGoPrev || disabled}
            className='h-8 w-8 p-0'
            aria-label='Primera página'
          >
            <ChevronsLeft className='h-4 w-4' />
          </Button>
        )}
        
        {/* Página anterior */}
        <Button
          variant='outline'
          size='sm'
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev || disabled}
          className='h-8 w-8 p-0'
          aria-label='Página anterior'
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        
        {/* Números de página */}
        {visiblePages.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className='flex h-8 w-8 items-center justify-center text-sm text-muted-foreground'
              >
                ...
              </span>
            )
          }
          
          return (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              size='sm'
              onClick={() => onPageChange(page)}
              disabled={disabled}
              className='h-8 w-8 p-0'
              aria-label={`Página ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </Button>
          )
        })}
        
        {/* Página siguiente */}
        <Button
          variant='outline'
          size='sm'
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext || disabled}
          className='h-8 w-8 p-0'
          aria-label='Página siguiente'
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
        
        {/* Última página */}
        {showFirstLast && (
          <Button
            variant='outline'
            size='sm'
            onClick={() => onPageChange(totalPages)}
            disabled={!canGoNext || disabled}
            className='h-8 w-8 p-0'
            aria-label='Última página'
          >
            <ChevronsRight className='h-4 w-4' />
          </Button>
        )}
      </div>
    </div>
  )
}
