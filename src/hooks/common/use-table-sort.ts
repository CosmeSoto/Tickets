/**
 * Hook de ordenamiento para tablas HTML nativas.
 *
 * Soporta:
 *   - Campos primitivos (string, number, Date)
 *   - Campos objeto — extrae automáticamente .name, .label o .title
 *   - Campos anidados con notación punto: 'category.name', 'assignee.name'
 *   - Órdenes especiales: priority, status (tickets)
 *
 * Uso:
 *   const { sorted, sortKey, sortDir, toggleSort } = useTableSort(items, 'name')
 *
 *   <th onClick={() => toggleSort('name')}>
 *     Nombre {SortIcon('name', sortKey, sortDir)}
 *   </th>
 *
 *   // Columna con objeto anidado — usar notación punto:
 *   <th onClick={() => toggleSort('category.name' as any)}>
 *     Categoría {SortIcon('category.name', sortKey, sortDir)}
 *   </th>
 */

'use client'

import { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import React from 'react'

type Direction = 'asc' | 'desc'

const PRIORITY_ORDER: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
const STATUS_ORDER: Record<string, number> = { OPEN: 4, IN_PROGRESS: 3, RESOLVED: 2, CLOSED: 1 }

/**
 * Extrae el valor de comparación de un campo, soportando:
 * - Notación punto: 'category.name'
 * - Objetos con .name / .label / .title
 * - Primitivos directos
 */
function extractValue(obj: any, key: string): string | number | null {
  // Notación punto: 'category.name', 'assignee.name', etc.
  if (key.includes('.')) {
    const parts = key.split('.')
    let val = obj
    for (const part of parts) {
      if (val == null) return null
      val = val[part]
    }
    return val == null ? null : String(val)
  }

  const val = obj[key]

  if (val == null) return null

  // Objeto — extraer campo de texto más probable
  if (typeof val === 'object' && !Array.isArray(val)) {
    const text = val.name ?? val.label ?? val.title ?? val.code ?? null
    return text != null ? String(text) : null
  }

  // Array — unir como texto (ej: accessories)
  if (Array.isArray(val)) {
    return val.join(', ')
  }

  return val
}

export function useTableSort<T>(
  data: T[],
  defaultKey: keyof T | string | null = null,
  defaultDir: Direction = 'asc'
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey as string | null)
  const [sortDir, setSortDir] = useState<Direction>(defaultDir)

  const toggleSort = (key: keyof T | string) => {
    const k = String(key)
    if (sortKey === k) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data
    const dir = sortDir === 'asc' ? 1 : -1

    return [...data].sort((a, b) => {
      // Órdenes especiales por nombre de campo
      if (sortKey === 'priority') {
        const aVal = (a as any)[sortKey]
        const bVal = (b as any)[sortKey]
        return ((PRIORITY_ORDER[aVal] ?? 0) - (PRIORITY_ORDER[bVal] ?? 0)) * dir
      }
      if (sortKey === 'status') {
        const aVal = (a as any)[sortKey]
        const bVal = (b as any)[sortKey]
        // Si los valores están en STATUS_ORDER (tickets), usar ese orden
        if (aVal in STATUS_ORDER || bVal in STATUS_ORDER) {
          return ((STATUS_ORDER[aVal] ?? 0) - (STATUS_ORDER[bVal] ?? 0)) * dir
        }
        // Si no, ordenar alfabéticamente
      }

      const aVal = extractValue(a, sortKey)
      const bVal = extractValue(b, sortKey)

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1 * dir // nulls al final
      if (bVal == null) return -1 * dir

      // Números
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir
      }

      // Fechas (ISO strings)
      const aStr = String(aVal)
      const bStr = String(bVal)
      const aDate = Date.parse(aStr)
      const bDate = Date.parse(bStr)
      if (!isNaN(aDate) && !isNaN(bDate)) {
        return (aDate - bDate) * dir
      }

      // Strings — comparación locale-aware
      return aStr.localeCompare(bStr, 'es', { sensitivity: 'base' }) * dir
    })
  }, [data, sortKey, sortDir])

  return { sorted, sortKey, sortDir, toggleSort }
}

/** Renderiza el ícono de sort para una columna */
export function SortIcon(
  col: PropertyKey,
  sortKey: PropertyKey | null,
  sortDir: Direction
): React.ReactElement {
  const isActive = sortKey != null && String(sortKey) === String(col)
  if (!isActive)
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
