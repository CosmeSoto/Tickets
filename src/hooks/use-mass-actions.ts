'use client'

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface MassActionOptions<T> {
  onBulkDelete?: (items: T[]) => Promise<void>
  onBulkUpdate?: (items: T[], updates: Partial<T>) => Promise<void>
  onBulkActivate?: (items: T[]) => Promise<void>
  onBulkDeactivate?: (items: T[]) => Promise<void>
  onBulkExport?: (items: T[]) => Promise<void>
  getItemId: (item: T) => string
  getItemName: (item: T) => string
  canDelete?: (item: T) => boolean
  canUpdate?: (item: T) => boolean
}

export interface MassActionResult<T> {
  // Estados de selección
  selectedItems: Set<string>
  selectedCount: number
  isAllSelected: (items: T[]) => boolean
  isPartiallySelected: (items: T[]) => boolean
  hasSelection: boolean
  
  // Funciones de selección
  selectItem: (itemId: string) => void
  deselectItem: (itemId: string) => void
  toggleItem: (itemId: string) => void
  selectAll: (items: T[]) => void
  deselectAll: () => void
  toggleAll: (items: T[]) => void
  
  // Funciones de filtrado
  getSelectedItemsData: (items: T[]) => T[]
  getDeletableItems: (items: T[]) => T[]
  getUpdatableItems: (items: T[]) => T[]
  
  // Estados de acciones
  isProcessing: boolean
  processingAction: string | null
  
  // Funciones de acciones masivas
  bulkDelete: (items: T[]) => Promise<void>
  bulkUpdate: (items: T[], updates: Partial<T>) => Promise<void>
  bulkActivate: (items: T[]) => Promise<void>
  bulkDeactivate: (items: T[]) => Promise<void>
  bulkExport: (items: T[]) => Promise<void>
  
  // Utilidades
  clearSelection: () => void
  getSelectionSummary: (items: T[]) => string
}

export function useMassActions<T>(
  options: MassActionOptions<T>
): MassActionResult<T> {
  const {
    onBulkDelete,
    onBulkUpdate,
    onBulkActivate,
    onBulkDeactivate,
    onBulkExport,
    getItemId,
    getItemName,
    canDelete = () => true,
    canUpdate = () => true,
  } = options

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  
  const { toast } = useToast()

  // Estados derivados
  const selectedCount = selectedItems.size
  const hasSelection = selectedCount > 0

  // Funciones de selección
  const selectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => new Set([...prev, itemId]))
  }, [])

  const deselectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      newSet.delete(itemId)
      return newSet
    })
  }, [])

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    const allIds = items.map(getItemId)
    setSelectedItems(new Set(allIds))
  }, [getItemId])

  const deselectAll = useCallback(() => {
    setSelectedItems(new Set())
  }, [])

  const toggleAll = useCallback((items: T[]) => {
    const allIds = items.map(getItemId)
    const isAllSelected = allIds.every(id => selectedItems.has(id))
    
    if (isAllSelected) {
      deselectAll()
    } else {
      selectAll(items)
    }
  }, [selectedItems, getItemId, selectAll, deselectAll])

  // Estados de selección calculados
  const isAllSelected = useCallback((items: T[]) => {
    if (items.length === 0) return false
    return items.every(item => selectedItems.has(getItemId(item)))
  }, [selectedItems, getItemId])

  const isPartiallySelected = useCallback((items: T[]) => {
    if (items.length === 0) return false
    const selectedInItems = items.filter(item => selectedItems.has(getItemId(item)))
    return selectedInItems.length > 0 && selectedInItems.length < items.length
  }, [selectedItems, getItemId])

  // Funciones de filtrado
  const getSelectedItemsData = useCallback((items: T[]): T[] => {
    return items.filter(item => selectedItems.has(getItemId(item)))
  }, [selectedItems, getItemId])

  const getDeletableItems = useCallback((items: T[]): T[] => {
    return getSelectedItemsData(items).filter(canDelete)
  }, [getSelectedItemsData, canDelete])

  const getUpdatableItems = useCallback((items: T[]): T[] => {
    return getSelectedItemsData(items).filter(canUpdate)
  }, [getSelectedItemsData, canUpdate])

  // Función auxiliar para manejar acciones
  const executeAction = useCallback(async (
    actionName: string,
    action: () => Promise<void>,
    successMessage: string,
    errorMessage: string
  ) => {
    setIsProcessing(true)
    setProcessingAction(actionName)
    
    try {
      await action()
      toast({
        title: 'Acción completada',
        description: successMessage,
        variant: 'default',
      })
      deselectAll()
    } catch (error) {
      console.error(`Error en ${actionName}:`, error)
      toast({
        title: 'Error en acción masiva',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setProcessingAction(null)
    }
  }, [toast, deselectAll])

  // Acciones masivas
  const bulkDelete = useCallback(async (items: T[]) => {
    if (!onBulkDelete) return
    
    const itemsToDelete = getDeletableItems(items)
    if (itemsToDelete.length === 0) {
      toast({
        title: 'Sin elementos para eliminar',
        description: 'No hay elementos seleccionados que puedan ser eliminados.',
        variant: 'destructive',
      })
      return
    }

    await executeAction(
      'bulkDelete',
      () => onBulkDelete(itemsToDelete),
      `${itemsToDelete.length} elemento(s) eliminado(s) exitosamente.`,
      'No se pudieron eliminar algunos elementos. Verifica los permisos.'
    )
  }, [onBulkDelete, getDeletableItems, executeAction, toast])

  const bulkUpdate = useCallback(async (items: T[], updates: Partial<T>) => {
    if (!onBulkUpdate) return
    
    const itemsToUpdate = getUpdatableItems(items)
    if (itemsToUpdate.length === 0) {
      toast({
        title: 'Sin elementos para actualizar',
        description: 'No hay elementos seleccionados que puedan ser actualizados.',
        variant: 'destructive',
      })
      return
    }

    await executeAction(
      'bulkUpdate',
      () => onBulkUpdate(itemsToUpdate, updates),
      `${itemsToUpdate.length} elemento(s) actualizado(s) exitosamente.`,
      'No se pudieron actualizar algunos elementos. Verifica los datos.'
    )
  }, [onBulkUpdate, getUpdatableItems, executeAction, toast])

  const bulkActivate = useCallback(async (items: T[]) => {
    if (!onBulkActivate) return
    
    const itemsToActivate = getSelectedItemsData(items)
    if (itemsToActivate.length === 0) return

    await executeAction(
      'bulkActivate',
      () => onBulkActivate(itemsToActivate),
      `${itemsToActivate.length} elemento(s) activado(s) exitosamente.`,
      'No se pudieron activar algunos elementos.'
    )
  }, [onBulkActivate, getSelectedItemsData, executeAction])

  const bulkDeactivate = useCallback(async (items: T[]) => {
    if (!onBulkDeactivate) return
    
    const itemsToDeactivate = getSelectedItemsData(items)
    if (itemsToDeactivate.length === 0) return

    await executeAction(
      'bulkDeactivate',
      () => onBulkDeactivate(itemsToDeactivate),
      `${itemsToDeactivate.length} elemento(s) desactivado(s) exitosamente.`,
      'No se pudieron desactivar algunos elementos.'
    )
  }, [onBulkDeactivate, getSelectedItemsData, executeAction])

  const bulkExport = useCallback(async (items: T[]) => {
    if (!onBulkExport) return
    
    const itemsToExport = getSelectedItemsData(items)
    if (itemsToExport.length === 0) {
      toast({
        title: 'Sin elementos para exportar',
        description: 'Selecciona al menos un elemento para exportar.',
        variant: 'destructive',
      })
      return
    }

    await executeAction(
      'bulkExport',
      () => onBulkExport(itemsToExport),
      `${itemsToExport.length} elemento(s) exportado(s) exitosamente.`,
      'No se pudo completar la exportación.'
    )
  }, [onBulkExport, getSelectedItemsData, executeAction, toast])

  // Utilidades
  const clearSelection = useCallback(() => {
    deselectAll()
  }, [deselectAll])

  const getSelectionSummary = useCallback((items: T[]): string => {
    const selectedItemsData = getSelectedItemsData(items)
    if (selectedItemsData.length === 0) return 'Ningún elemento seleccionado'
    if (selectedItemsData.length === 1) return `1 elemento seleccionado: ${getItemName(selectedItemsData[0])}`
    return `${selectedItemsData.length} elementos seleccionados`
  }, [getSelectedItemsData, getItemName])

  return {
    // Estados de selección
    selectedItems,
    selectedCount,
    isAllSelected,
    isPartiallySelected,
    hasSelection,
    
    // Funciones de selección
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    deselectAll,
    toggleAll,
    
    // Funciones de filtrado
    getSelectedItemsData,
    getDeletableItems,
    getUpdatableItems,
    
    // Estados de acciones
    isProcessing,
    processingAction,
    
    // Funciones de acciones masivas
    bulkDelete,
    bulkUpdate,
    bulkActivate,
    bulkDeactivate,
    bulkExport,
    
    // Utilidades
    clearSelection,
    getSelectionSummary,
  }
}