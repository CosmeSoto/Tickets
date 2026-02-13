'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { usePagination } from './common/use-pagination'
import { useMassActions } from './use-mass-actions'

// Tipos optimizados para el hook
export interface DepartmentData {
  id: string
  name: string
  description?: string
  color: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
  _count?: {
    users: number
    categories: number
  }
}

export interface DepartmentFormData {
  name: string
  description: string
  color: string
  isActive: boolean
  order: number
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface UseDepartmentsOptions {
  cacheTTL?: number
  enableCache?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  enablePagination?: boolean
  pageSize?: number
  enableMassActions?: boolean
}

export function useDepartments(options: UseDepartmentsOptions = {}) {
  const {
    cacheTTL = 5 * 60 * 1000, // 5 minutos
    enableCache = true,
    autoRefresh = false,
    refreshInterval = 30000, // 30 segundos
    enablePagination = true,
    pageSize = 20,
    enableMassActions = true,
  } = options

  // Estados principales
  const [departments, setDepartments] = useState<DepartmentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'table'>('list')
  
  // Estados de formulario
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<DepartmentData | null>(null)
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentData | null>(null)
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    description: '',
    color: '#3B82F6',
    isActive: true,
    order: 0,
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { toast } = useToast()

  // Cache inteligente
  const cache = useMemo(() => new Map<string, CacheEntry<any>>(), [])

  const getCacheKey = useCallback((endpoint: string, params?: Record<string, any>) => {
    const paramString = params ? JSON.stringify(params) : ''
    return `${endpoint}:${paramString}`
  }, [])

  const getFromCache = useCallback(<T>(key: string): T | null => {
    if (!enableCache) return null
    
    const entry = cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key)
      return null
    }
    
    return entry.data
  }, [cache, enableCache])

  const setToCache = useCallback(<T>(key: string, data: T, ttl = cacheTTL) => {
    if (!enableCache) return
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }, [cache, enableCache, cacheTTL])

  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      const keysToDelete = Array.from(cache.keys()).filter(key => key.includes(pattern))
      keysToDelete.forEach(key => cache.delete(key))
    } else {
      cache.clear()
    }
  }, [cache])

  // Función principal para cargar departamentos con cache
  const loadDepartments = useCallback(async (forceRefresh = false) => {
    const cacheKey = getCacheKey('/api/departments')
    
    if (!forceRefresh) {
      const cached = getFromCache<DepartmentData[]>(cacheKey)
      if (cached) {
        setDepartments(cached)
        setLoading(false)
        return
      }
    }

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/departments', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300',
        },
        credentials: 'include',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname)
          return
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && Array.isArray(data.data)) {
        // Ordenar por order y luego por nombre
        const sortedDepartments = data.data.sort((a: DepartmentData, b: DepartmentData) => {
          if (a.order !== b.order) return a.order - b.order
          return a.name.localeCompare(b.name)
        })
        
        setDepartments(sortedDepartments)
        setToCache(cacheKey, sortedDepartments)
      } else {
        throw new Error('Formato de respuesta inválido')
      }
      
    } catch (error) {
      console.error('[DEPARTMENTS] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(errorMessage)
      setDepartments([])
      
      toast({
        title: 'Error al cargar departamentos',
        description: `No se pudieron cargar los departamentos: ${errorMessage}`,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [getCacheKey, getFromCache, setToCache, toast])

  // Departamentos filtrados con memoización
  const filteredDepartments = useMemo(() => {
    return departments.filter(department => {
      const matchesSearch = !searchTerm || 
        department.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (department.description && department.description.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' && department.isActive) ||
        (statusFilter === 'inactive' && !department.isActive)
      
      return matchesSearch && matchesStatus
    })
  }, [departments, searchTerm, statusFilter])

  // Paginación inteligente
  const pagination = usePagination(filteredDepartments, {
    pageSize,
  })

  // Acciones masivas
  const massActions = useMassActions<DepartmentData>({
    getItemId: (item: DepartmentData) => item.id,
    getItemName: (item: DepartmentData) => item.name,
    canDelete: (item: DepartmentData) => (item._count?.users || 0) === 0 && (item._count?.categories || 0) === 0,
    canUpdate: (item: DepartmentData) => true,
    onBulkDelete: async (items: DepartmentData[]) => {
      const promises = items.map(item => 
        fetch(`/api/departments/${item.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      )
      
      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        throw new Error(`No se pudieron eliminar ${failed} departamento(s)`)
      }
      
      // Invalidar cache y recargar
      invalidateCache('departments')
      await loadDepartments(true)
    },
    onBulkUpdate: async (items: DepartmentData[], updates: Partial<DepartmentData>) => {
      const promises = items.map(item => 
        fetch(`/api/departments/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, ...updates }),
          credentials: 'include',
        })
      )
      
      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        throw new Error(`No se pudieron actualizar ${failed} departamento(s)`)
      }
      
      // Invalidar cache y recargar
      invalidateCache('departments')
      await loadDepartments(true)
    },
    onBulkActivate: async (items: DepartmentData[]) => {
      const promises = items.map(item => 
        fetch(`/api/departments/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, isActive: true }),
          credentials: 'include',
        })
      )
      
      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        throw new Error(`No se pudieron activar ${failed} departamento(s)`)
      }
      
      // Invalidar cache y recargar
      invalidateCache('departments')
      await loadDepartments(true)
    },
    onBulkDeactivate: async (items: DepartmentData[]) => {
      const promises = items.map(item => 
        fetch(`/api/departments/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, isActive: false }),
          credentials: 'include',
        })
      )
      
      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected').length
      
      if (failed > 0) {
        throw new Error(`No se pudieron desactivar ${failed} departamento(s)`)
      }
      
      // Invalidar cache y recargar
      invalidateCache('departments')
      await loadDepartments(true)
    },
    onBulkExport: async (items: DepartmentData[]) => {
      // Crear CSV con los datos de los departamentos
      const csvHeaders = ['ID', 'Nombre', 'Descripción', 'Color', 'Estado', 'Orden', 'Técnicos', 'Categorías', 'Creado']
      const csvRows = items.map(item => [
        item.id,
        item.name,
        item.description || '',
        item.color,
        item.isActive ? 'Activo' : 'Inactivo',
        item.order,
        item._count?.users || 0,
        item._count?.categories || 0,
        new Date(item.createdAt).toLocaleDateString()
      ])
      
      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n')
      
      // Descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `departamentos_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },
  })

  // Estadísticas memoizadas
  const stats = useMemo(() => ({
    total: departments.length,
    filtered: filteredDepartments.length,
    active: departments.filter(d => d.isActive).length,
    inactive: departments.filter(d => !d.isActive).length,
    totalUsers: departments.reduce((acc, d) => acc + (d._count?.users || 0), 0),
    totalCategories: departments.reduce((acc, d) => acc + (d._count?.categories || 0), 0),
    // Estadísticas de paginación
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    pageSize: pagination.pageSize,
    startIndex: pagination.startIndex,
    endIndex: pagination.endIndex,
  }), [departments, filteredDepartments, pagination])

  // Manejar envío del formulario
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: 'Error de validación',
        description: 'El nombre del departamento es requerido',
        variant: 'destructive',
        duration: 4000,
      })
      return
    }

    setSubmitting(true)
    const departmentName = formData.name
    
    try {
      const url = editingDepartment
        ? `/api/departments/${editingDepartment.id}`
        : '/api/departments'
      
      const method = editingDepartment ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: editingDepartment ? 'Departamento actualizado exitosamente' : 'Departamento creado exitosamente',
          description: editingDepartment
            ? `"${departmentName}" ha sido actualizado correctamente en el sistema`
            : `"${departmentName}" ha sido agregado a tu organización`,
          duration: 4000,
        })
        
        handleCloseDialog()
        
        // Invalidar cache y recargar
        invalidateCache('departments')
        await loadDepartments(true)
      } else {
        toast({
          title: editingDepartment ? 'Error al actualizar departamento' : 'Error al crear departamento',
          description: data.message || `No se pudo ${editingDepartment ? 'actualizar' : 'crear'} el departamento`,
          variant: 'destructive',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('[DEPARTMENTS] Error al guardar:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: editingDepartment ? 'Error al actualizar departamento' : 'Error al crear departamento',
        description: `No se pudo ${editingDepartment ? 'actualizar' : 'crear'} "${departmentName}". ${errorMessage}`,
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setSubmitting(false)
    }
  }, [formData, editingDepartment, toast, invalidateCache, loadDepartments, handleCloseDialog])

  // Manejar eliminación
  const handleDelete = useCallback(async () => {
    if (!deletingDepartment) return

    setDeleting(true)
    const departmentName = deletingDepartment.name
    
    try {
      const response = await fetch(`/api/departments/${deletingDepartment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: 'Departamento eliminado exitosamente',
          description: `"${departmentName}" ha sido eliminado permanentemente de tu organización`,
          duration: 4000,
        })
        
        setShowDeleteDialog(false)
        setDeletingDepartment(null)
        
        // Invalidar cache y recargar
        invalidateCache('departments')
        await loadDepartments(true)
      } else {
        toast({
          title: 'Error al eliminar departamento',
          description: data.message || `No se pudo eliminar "${departmentName}"`,
          variant: 'destructive',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('[DEPARTMENTS] Error al eliminar:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: 'Error al eliminar departamento',
        description: `No se pudo eliminar "${departmentName}". ${errorMessage}`,
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setDeleting(false)
    }
  }, [deletingDepartment, toast, invalidateCache, loadDepartments])

  // Manejar apertura de diálogo
  const handleOpenDialog = useCallback((department?: DepartmentData) => {
    if (department) {
      setEditingDepartment(department)
      setFormData({
        name: department.name,
        description: department.description || '',
        color: department.color,
        isActive: department.isActive,
        order: department.order,
      })
    } else {
      setEditingDepartment(null)
      setFormData({
        name: '',
        description: '',
        color: '#3B82F6',
        isActive: true,
        order: departments.length,
      })
    }
    setShowDialog(true)
  }, [departments.length])

  // Manejar cierre de diálogo
  const handleCloseDialog = useCallback(() => {
    setShowDialog(false)
    setEditingDepartment(null)
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      isActive: true,
      order: 0,
    })
  }, [])

  // Manejar apertura de diálogo de eliminación
  const handleOpenDeleteDialog = useCallback((department: DepartmentData) => {
    setDeletingDepartment(department)
    setShowDeleteDialog(true)
  }, [])

  // Efectos
  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  // Auto-refresh si está habilitado
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadDepartments()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadDepartments])

  return {
    // Estados principales
    departments,
    loading,
    error,
    
    // Estados de filtros
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    
    // Estados de formulario
    showDialog,
    setShowDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    editingDepartment,
    deletingDepartment,
    formData,
    setFormData,
    submitting,
    deleting,
    
    // Datos procesados
    filteredDepartments,
    stats,
    
    // Paginación y acciones masivas
    pagination: enablePagination ? pagination : null,
    massActions: enableMassActions ? massActions : null,
    
    // Funciones principales
    loadDepartments,
    handleSubmit,
    handleDelete,
    handleOpenDialog,
    handleCloseDialog,
    handleOpenDeleteDialog,
    
    // Funciones de cache
    invalidateCache,
    
    // Funciones de utilidad
    refresh: () => loadDepartments(true),
  }
}