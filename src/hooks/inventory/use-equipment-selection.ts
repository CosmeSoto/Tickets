/**
 * Hook para manejar selección múltiple de equipos
 */

import { useState, useCallback } from 'react'

export function useEquipmentSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.has(id)
    },
    [selectedIds]
  )

  const isAllSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return false
      return ids.every(id => selectedIds.has(id))
    },
    [selectedIds]
  )

  const isSomeSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return false
      return ids.some(id => selectedIds.has(id)) && !isAllSelected(ids)
    },
    [selectedIds, isAllSelected]
  )

  const toggleAll = useCallback(
    (ids: string[]) => {
      if (isAllSelected(ids)) {
        deselectAll()
      } else {
        selectAll(ids)
      }
    },
    [isAllSelected, selectAll, deselectAll]
  )

  const getSelectedIds = useCallback(() => {
    return Array.from(selectedIds)
  }, [selectedIds])

  const getSelectedCount = useCallback(() => {
    return selectedIds.size
  }, [selectedIds])

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleAll,
    getSelectedIds,
    getSelectedCount,
  }
}
