/**
 * Hook principal de categorías - Orquestador
 * Combina funcionalidad de datos y formularios
 * API pública unificada
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePagination } from '../common/use-pagination'
import { useMassActions } from '../use-mass-actions'
import { useCategoriesData } from './use-categories-data'
import { useCategoriesForm } from './use-categories-form'
import type { UseCategoriesOptions } from './types'
import type { CategoryLevel } from '@/lib/constants/category-constants'

export * from './types'

export function useCategories(options: UseCategoriesOptions = {}) {
  const {
    cacheTTL = 5 * 60 * 1000,
    enableCache = true,
    autoRefresh = false,
    refreshInterval = 30000,
    enablePagination = true,
    pageSize = 20,
    enableMassActions = true,
  } = options
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<CategoryLevel>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [departmentFilter, setDepartmentFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('table')
  
  // Hook de datos
  const dataHook = useCategoriesData({ cacheTTL, enableCache })
  
  // Hook de formularios
  const formHook = useCategoriesForm({
    onSuccess: () => {
      dataHook.loadCategories(searchTerm, levelFilter, true)
    },
  })
  
  // Cargar datos iniciales
  useEffect(() => {
    dataHook.loadCategories(searchTerm, levelFilter)
    dataHook.loadAvailableParents()
    dataHook.loadAvailableTechnicians()
    dataHook.loadDepartments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Solo al montar
  
  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      dataHook.loadCategories(searchTerm, levelFilter, true)
    }, refreshInterval)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, refreshInterval])
  
  // NO recargar cuando cambien los filtros - el filtrado se hace en el cliente
  // El filtrado se maneja en filteredCategories con useMemo
  
  // Categorías filtradas
  const filteredCategories = useMemo(() => {
    return dataHook.categories.filter(category => {
      // Filtro de búsqueda
      const matchesSearch = !searchTerm || 
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
      
      // Filtro de nivel
      const matchesLevel = levelFilter === 'all' || category.level.toString() === levelFilter
      
      // Filtro de estado
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && category.isActive) ||
        (statusFilter === 'inactive' && !category.isActive)
      
      // Filtro de departamento
      const matchesDepartment = departmentFilter === 'all' || 
        (category.technician_assignments && category.technician_assignments.some((ta: any) => 
          ta.users?.departmentId === departmentFilter
        ))
      
      return matchesSearch && matchesLevel && matchesStatus && matchesDepartment
    })
  }, [dataHook.categories, searchTerm, levelFilter, statusFilter, departmentFilter])
  
  // Estadísticas
  const stats = useMemo(() => {
    const total = dataHook.categories.length
    const active = dataHook.categories.filter(c => c.isActive).length
    const inactive = total - active
    const filtered = filteredCategories.length
    const withTechnicians = dataHook.categories.filter(c => 
      c.technician_assignments && c.technician_assignments.length > 0
    ).length
    
    const byLevel = {
      level1: dataHook.categories.filter(c => c.level === 1).length,
      level2: dataHook.categories.filter(c => c.level === 2).length,
      level3: dataHook.categories.filter(c => c.level === 3).length,
      level4: dataHook.categories.filter(c => c.level === 4).length,
    }
    
    return { total, active, inactive, filtered, withTechnicians, byLevel }
  }, [dataHook.categories, filteredCategories])
  
  // Paginación
  const pagination = enablePagination
    ? usePagination(filteredCategories, { pageSize })
    : null
  
  // Acciones masivas
  const massActionsHook = enableMassActions 
    ? useMassActions<any>({
        getItemId: (item) => item.id,
        getItemName: (item) => item.name,
        onBulkDelete: async (items) => {
          // Implementar eliminación masiva
          await Promise.all(items.map(item => 
            fetch(`/api/categories/${item.id}`, { method: 'DELETE' })
          ))
          dataHook.loadCategories(searchTerm, levelFilter, true)
        },
        onBulkActivate: async (items) => {
          // Implementar activación masiva
          await Promise.all(items.map(item =>
            fetch(`/api/categories/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: true })
            })
          ))
          dataHook.loadCategories(searchTerm, levelFilter, true)
        },
        onBulkDeactivate: async (items) => {
          // Implementar desactivación masiva
          await Promise.all(items.map(item =>
            fetch(`/api/categories/${item.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isActive: false })
            })
          ))
          dataHook.loadCategories(searchTerm, levelFilter, true)
        },
        onBulkExport: async (items) => {
          // Implementar exportación
          const csv = items.map(item => 
            `${item.id},${item.name},${item.level},${item.isActive}`
          ).join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'categories.csv'
          a.click()
        }
      })
    : null
  
  const massActions = massActionsHook
  
  // Función de refresh
  const refresh = useCallback(() => {
    dataHook.loadCategories(searchTerm, levelFilter, true)
    dataHook.loadAvailableParents()
    dataHook.loadAvailableTechnicians()
    dataHook.loadDepartments()
  }, [searchTerm, levelFilter])
  
  // Wrapper para handleSubmit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    await formHook.handleSubmit(
      dataHook.invalidateCache,
      () => dataHook.loadCategories(searchTerm, levelFilter, true)
    )
  }, [formHook, dataHook, searchTerm, levelFilter])
  
  // Wrapper para handleDelete
  const handleDelete = useCallback(async () => {
    await formHook.handleDelete(
      dataHook.invalidateCache,
      () => dataHook.loadCategories(searchTerm, levelFilter, true)
    )
  }, [formHook, dataHook, searchTerm, levelFilter])
  
  return {
    // Estados de datos
    categories: dataHook.categories,
    availableParents: dataHook.availableParents,
    availableTechnicians: dataHook.availableTechnicians,
    departments: dataHook.departments,
    loading: dataHook.loading,
    error: dataHook.error,
    
    // Estados de filtros
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
    viewMode,
    setViewMode,
    
    // Estados de formulario
    isDialogOpen: formHook.isDialogOpen,
    setIsDialogOpen: formHook.setIsDialogOpen,
    editingCategory: formHook.editingCategory,
    deletingCategory: formHook.deletingCategory,
    setDeletingCategory: formHook.setDeletingCategory,
    formData: formHook.formData,
    setFormData: formHook.setFormData,
    formErrors: formHook.formErrors,
    submitting: formHook.submitting,
    deleting: formHook.deleting,
    
    // Datos procesados
    filteredCategories,
    stats,
    
    // Paginación y acciones masivas
    pagination,
    massActions,
    
    // Funciones principales
    loadCategories: dataHook.loadCategories,
    loadAvailableParents: dataHook.loadAvailableParents,
    loadAvailableTechnicians: dataHook.loadAvailableTechnicians,
    loadDepartments: dataHook.loadDepartments,
    handleSubmit,
    handleDelete,
    handleEdit: formHook.handleEdit,
    handleNew: formHook.handleNew,
    resetForm: formHook.resetForm,
    
    // Funciones de utilidad
    refresh,
  }
}
