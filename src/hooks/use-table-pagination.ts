import { useState, useMemo } from 'react'

interface UsePaginationOptions {
  pageSize?: number
}

export function useTablePagination<T>(data: T[], options: UsePaginationOptions = {}) {
  const { pageSize = 10 } = options
  const [currentPage, setCurrentPage] = useState(1)

  const totalPages = Math.ceil(data.length / pageSize)
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return data.slice(startIndex, endIndex)
  }, [data, currentPage, pageSize])

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(validPage)
  }

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const resetPage = () => {
    setCurrentPage(1)
  }

  return {
    paginatedData,
    currentPage,
    totalPages,
    pageSize,
    totalItems: data.length,
    goToPage,
    nextPage,
    previousPage,
    resetPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    startIndex: (currentPage - 1) * pageSize + 1,
    endIndex: Math.min(currentPage * pageSize, data.length)
  }
}
