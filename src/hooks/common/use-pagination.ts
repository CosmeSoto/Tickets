/**
 * Hook genérico para paginación de datos
 * Soporta paginación cliente y servidor
 * Consolidado de useSmartPagination y usePagination
 * 
 * @example
 * ```tsx
 * const { 
 *   paginatedData, 
 *   currentPage, 
 *   totalPages, 
 *   goToPage, 
 *   nextPage, 
 *   prevPage 
 * } = usePagination(filteredData, { pageSize: 20 })
 * 
 * return (
 *   <>
 *     <DataTable data={paginatedData} />
 *     <Pagination 
 *       currentPage={currentPage}
 *       totalPages={totalPages}
 *       onPageChange={goToPage}
 *     />
 *   </>
 * )
 * ```
 */

import { useState, useMemo, useCallback, useEffect } from 'react'

export interface UsePaginationOptions {
  pageSize?: number
  initialPage?: number
  persistInUrl?: boolean
  onPageChange?: (page: number) => void
}

export interface UsePaginationReturn<T> {
  // Datos paginados
  paginatedData: T[]
  currentItems: T[]
  
  // Estado de paginación
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  
  // Información de rango
  startIndex: number
  endIndex: number
  
  // Funciones de navegación
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  previousPage: () => void // Alias para compatibilidad
  goToFirstPage: () => void
  goToLastPage: () => void
  setPageSize: (size: number) => void
  
  // Estados
  hasNextPage: boolean
  hasPrevPage: boolean
  hasPreviousPage: boolean // Alias para compatibilidad
  isFirstPage: boolean
  isLastPage: boolean
  
  // Utilidades adicionales
  getPageNumbers: () => number[]
  getVisiblePageNumbers: (maxVisible?: number) => number[]
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    pageSize: initialPageSize = 20,
    initialPage = 1,
    onPageChange
  } = options

  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  // Calcular totales
  const totalItems = data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Asegurar que currentPage esté en rango válido
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
    if (currentPage < 1) {
      setCurrentPage(1)
    }
  }, [currentPage, totalPages])

  // Calcular índices (1-based para display, 0-based para slice)
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endIndex = Math.min(currentPage * pageSize, totalItems)

  // Obtener datos de la página actual
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return data.slice(start, end)
  }, [data, currentPage, pageSize])

  // Estados de navegación
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1
  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages

  // Funciones de navegación
  const goToPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
    if (onPageChange) {
      onPageChange(validPage)
    }
  }, [totalPages, onPageChange])

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      goToPage(currentPage + 1)
    }
  }, [hasNextPage, currentPage, goToPage])

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      goToPage(currentPage - 1)
    }
  }, [hasPrevPage, currentPage, goToPage])

  const goToFirstPage = useCallback(() => {
    goToPage(1)
  }, [goToPage])

  const goToLastPage = useCallback(() => {
    goToPage(totalPages)
  }, [totalPages, goToPage])

  const setPageSize = useCallback((size: number) => {
    const newPageSize = Math.max(1, size)
    setPageSizeState(newPageSize)
    
    // Ajustar página actual para mantener el primer item visible
    const firstItemIndex = (currentPage - 1) * pageSize
    const newPage = Math.floor(firstItemIndex / newPageSize) + 1
    setCurrentPage(newPage)
  }, [currentPage, pageSize])

  // Obtener números de página
  const getPageNumbers = useCallback((): number[] => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }, [totalPages])

  // Obtener números de página visibles (para UI con ellipsis)
  const getVisiblePageNumbers = useCallback((maxVisible = 7): number[] => {
    if (totalPages <= maxVisible) {
      return getPageNumbers()
    }

    const half = Math.floor(maxVisible / 2)
    let start = currentPage - half
    let end = currentPage + half

    if (start < 1) {
      start = 1
      end = maxVisible
    }

    if (end > totalPages) {
      end = totalPages
      start = totalPages - maxVisible + 1
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [totalPages, currentPage, getPageNumbers])

  // Reset a primera página cuando cambian los datos
  useEffect(() => {
    setCurrentPage(1)
  }, [data.length])

  return {
    // Datos
    paginatedData,
    currentItems: paginatedData,
    
    // Estado
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    
    // Rango
    startIndex,
    endIndex,
    
    // Navegación
    goToPage,
    nextPage,
    prevPage,
    previousPage: prevPage, // Alias
    goToFirstPage,
    goToLastPage,
    setPageSize,
    
    // Estados
    hasNextPage,
    hasPrevPage,
    hasPreviousPage: hasPrevPage, // Alias
    isFirstPage,
    isLastPage,
    
    // Utilidades
    getPageNumbers,
    getVisiblePageNumbers
  }
}
