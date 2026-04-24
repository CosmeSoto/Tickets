/**
 * Hook de ordenamiento para tablas HTML nativas.
 * Uso:
 *   const { sorted, sortKey, sortDir, toggleSort } = useTableSort(items, 'name')
 *
 *   <th onClick={() => toggleSort('name')}>
 *     Nombre {SortIcon('name', sortKey, sortDir)}
 *   </th>
 */

'use client'

import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import React from 'react'

type Direction = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
const STATUS_ORDER: Record<string, number> = { OPEN: 4, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 1 }

export function useTableSort<T>(
  data: T[],
  defaultKey: keyof T | null = null,
  defaultDir: Direction = 'asc'
) {
  const [sortKey, setSortKey] = useState<keyof T | null>(defaultKey)
  const [sortDir, setSortDir] = useState<Direction>(defaultDir)

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => {
      const aVal = (a as any)[sortKey]
      const bVal = (b as any)[sortKey]
      if (String(sortKey) === 'priority')
        return ((PRIORITY_ORDER[aVal] ?? 0) - (PRIORITY_ORDER[bVal] ?? 0)) * dir
      if (String(sortKey) === 'status')
        return ((STATUS_ORDER[aVal] ?? 0) - (STATUS_ORDER[bVal] ?? 0)) * dir
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'string')
        return aVal.localeCompare(bVal, 'es', { sensitivity: 'base' }) * dir
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * dir
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}

/** Renderiza el ícono de sort para una columna */
export function SortIcon<T>(
  col: keyof T,
  sortKey: keyof T | null,
  sortDir: Direction
): React.ReactElement {
  if (sortKey !== col)
    return React.createElement(ArrowUpDown, {
      className: 'h-3.5 w-3.5 ml-1 text-muted-foreground/50 inline',
    })
  if (sortDir === 'asc')
    return React.createElement(ArrowUp, { className: 'h-3.5 w-3.5 ml-1 text-foreground inline' })
  return React.createElement(ArrowDown, { className: 'h-3.5 w-3.5 ml-1 text-foreground inline' })
}

/** Clases CSS para el header de columna sorteable */
export const sortableHeaderClass =
  'cursor-pointer select-none hover:text-foreground transition-colors'
