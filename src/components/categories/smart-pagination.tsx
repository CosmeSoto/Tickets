'use client'

import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PaginationResult } from '@/hooks/use-smart-pagination'

interface SmartPaginationProps<T> {
  pagination: Partial<PaginationResult<T>> & {
    currentPage: number
    totalPages: number
    totalItems: number
    pageSize: number
    goToPage: (page: number) => void
    setPageSize: (size: number) => void
  }
  showPageSizeSelector?: boolean
  showInfo?: boolean
  showFirstLast?: boolean
  maxVisiblePages?: number
  pageSizeOptions?: number[]
  className?: string
}

export function SmartPagination<T>({
  pagination,
  showPageSizeSelector = true,
  showInfo = true,
  showFirstLast = true,
  maxVisiblePages = 7,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: SmartPaginationProps<T>) {
  const {
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    startIndex = (currentPage - 1) * pageSize,
    endIndex = Math.min(startIndex + pageSize, totalItems),
    hasNextPage = currentPage < totalPages,
    hasPreviousPage = currentPage > 1,
    isFirstPage = currentPage === 1,
    isLastPage = currentPage === totalPages,
    goToPage,
    nextPage = () => hasNextPage && goToPage(currentPage + 1),
    previousPage = () => hasPreviousPage && goToPage(currentPage - 1),
    goToFirstPage = () => goToPage(1),
    goToLastPage = () => goToPage(totalPages),
    setPageSize,
    getVisiblePageNumbers = (maxVisible: number = 7) => {
      if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1)
      }
      const half = Math.floor(maxVisible / 2)
      let start = Math.max(1, currentPage - half)
      let end = Math.min(totalPages, start + maxVisible - 1)
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1)
      }
      return Array.from({ length: end - start + 1 }, (_, i) => start + i)
    },
  } = pagination

  if (totalItems === 0) {
    return null
  }

  const visiblePages = getVisiblePageNumbers(maxVisiblePages)
  const showEllipsisStart = visiblePages[0] > 1
  const showEllipsisEnd = visiblePages[visiblePages.length - 1] < totalPages

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 ${className}`}>
      {/* Información de paginación */}
      {showInfo && (
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>
            Mostrando {startIndex} a {endIndex} de {totalItems} resultado{totalItems !== 1 ? 's' : ''}
          </span>
          
          {showPageSizeSelector && (
            <div className="flex items-center space-x-2">
              <span>Mostrar:</span>
              <Select
                value={pageSize.toString()}
                onValueChange={(value) => setPageSize(parseInt(value))}
              >
                <SelectTrigger className="w-20 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map(size => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Controles de paginación */}
      <div className="flex items-center space-x-1">
        {/* Botón primera página */}
        {showFirstLast && (
          <Button
            variant="outline"
            size="sm"
            onClick={goToFirstPage}
            disabled={isFirstPage}
            className="h-8 w-8 p-0"
            title="Primera página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Botón página anterior */}
        <Button
          variant="outline"
          size="sm"
          onClick={previousPage}
          disabled={!hasPreviousPage}
          className="h-8 w-8 p-0"
          title="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Elipsis inicial */}
        {showEllipsisStart && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              className="h-8 w-8 p-0"
            >
              1
            </Button>
            {visiblePages[0] > 2 && (
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          </>
        )}

        {/* Números de página */}
        {visiblePages.map(page => (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="sm"
            onClick={() => goToPage(page)}
            className="h-8 w-8 p-0"
          >
            {page}
          </Button>
        ))}

        {/* Elipsis final */}
        {showEllipsisEnd && (
          <>
            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-8 w-8 p-0"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(totalPages)}
              className="h-8 w-8 p-0"
            >
              {totalPages}
            </Button>
          </>
        )}

        {/* Botón página siguiente */}
        <Button
          variant="outline"
          size="sm"
          onClick={nextPage}
          disabled={!hasNextPage}
          className="h-8 w-8 p-0"
          title="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Botón última página */}
        {showFirstLast && (
          <Button
            variant="outline"
            size="sm"
            onClick={goToLastPage}
            disabled={isLastPage}
            className="h-8 w-8 p-0"
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}