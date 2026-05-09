/**
 * Hook reutilizable para ordenamiento de tablas
 * Proporciona estado y funciones para ordenar datos por columnas
 */

import { useState, useMemo, useCallback } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig<T> {
  key: keyof T | string
  direction: SortDirection
}

export interface UseTableSortReturn<T> {
  sortedData: T[]
  sortConfig: SortConfig<T>
  requestSort: (key: keyof T | string) => void
  getSortIcon: (key: keyof T | string) => 'asc' | 'desc' | null
  // Legacy compatibility
  sorted: T[]
  sortKey: string
  sortDir: SortDirection
  toggleSort: (key: string) => void
}

/**
 * Hook para ordenamiento de tablas
 * @param data - Array de datos a ordenar
 * @param defaultSort - Configuración de ordenamiento por defecto (puede ser string o SortConfig)
 */
export function useTableSort<T>(
  data: T[],
  defaultSort?: SortConfig<T> | string
): UseTableSortReturn<T> {
  // Normalizar defaultSort
  const normalizedDefault: SortConfig<T> =
    typeof defaultSort === 'string'
      ? { key: defaultSort, direction: 'asc' }
      : defaultSort || { key: '', direction: null }

  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(normalizedDefault)

  const sortedData = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) {
      return data
    }

    const sorted = [...data].sort((a, b) => {
      const key = sortConfig.key as keyof T

      // Obtener valores
      let aValue = a[key]
      let bValue = b[key]

      // Manejar valores anidados (ej: 'manager.name')
      if (typeof sortConfig.key === 'string' && sortConfig.key.includes('.')) {
        const keys = sortConfig.key.split('.')
        aValue = keys.reduce((obj: any, k) => obj?.[k], a) as any
        bValue = keys.reduce((obj: any, k) => obj?.[k], b) as any
      }

      // Manejar null/undefined
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Comparar números
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      // Comparar booleanos
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const aNum = aValue ? 1 : 0
        const bNum = bValue ? 1 : 0
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Comparar strings (case-insensitive)
      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()

      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [data, sortConfig])

  const requestSort = useCallback((key: keyof T | string) => {
    setSortConfig(prevConfig => {
      // Si es la misma columna, cambiar dirección
      if (prevConfig.key === key) {
        if (prevConfig.direction === 'asc') {
          return { key, direction: 'desc' }
        }
        if (prevConfig.direction === 'desc') {
          return { key: '', direction: null }
        }
      }
      // Nueva columna, empezar con ascendente
      return { key, direction: 'asc' }
    })
  }, [])

  const getSortIcon = useCallback(
    (key: keyof T | string): 'asc' | 'desc' | null => {
      if (sortConfig.key === key) {
        return sortConfig.direction
      }
      return null
    },
    [sortConfig]
  )

  // Legacy compatibility
  const toggleSort = useCallback(
    (key: string) => {
      requestSort(key)
    },
    [requestSort]
  )

  return {
    sortedData,
    sortConfig,
    requestSort,
    getSortIcon,
    // Legacy compatibility
    sorted: sortedData,
    sortKey: String(sortConfig.key),
    sortDir: sortConfig.direction,
    toggleSort,
  }
}
