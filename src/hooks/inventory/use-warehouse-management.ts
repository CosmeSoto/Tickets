/**
 * Hook: useWarehouseManagement
 * Gestión de bodegas por familia
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface WarehouseManager {
  id: string
  name: string
  email: string
}

export interface Warehouse {
  id: string
  name: string
  location: string | null
  description: string | null
  managerId: string | null
  familyId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  manager?: WarehouseManager | null
  _count?: {
    equipment: number
    consumables: number
    batches?: number
  }
}

export interface CreateWarehouseData {
  name: string
  location?: string
  description?: string
  managerId?: string
  isActive?: boolean
}

export interface UpdateWarehouseData {
  name?: string
  location?: string
  description?: string
  managerId?: string | null
  isActive?: boolean
}

export function useWarehouseManagement(familyId: string | null) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [availableManagers, setAvailableManagers] = useState<WarehouseManager[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Cargar bodegas de la familia
   */
  const loadWarehouses = useCallback(async () => {
    if (!familyId) {
      setWarehouses([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/inventory/families/${familyId}/warehouses`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error al cargar bodegas')
      }

      const data = await response.json()
      setWarehouses(data.warehouses || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar bodegas'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [familyId])

  /**
   * Cargar managers disponibles (usuarios con canManageInventory)
   */
  const loadAvailableManagers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?canManageInventory=true')

      if (!response.ok) {
        throw new Error('Error al cargar managers')
      }

      const data = await response.json()
      setAvailableManagers(
        data.users?.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })) || []
      )
    } catch (err) {
      console.error('Error cargando managers:', err)
      // No mostrar toast, es un error silencioso
    }
  }, [])

  /**
   * Crear bodega
   */
  const createWarehouse = useCallback(
    async (data: CreateWarehouseData): Promise<Warehouse | null> => {
      if (!familyId) {
        toast.error('No hay familia seleccionada')
        return null
      }

      setSaving(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/inventory/families/${familyId}/warehouses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al crear bodega')
        }

        const result = await response.json()
        const newWarehouse = result.warehouse

        setWarehouses(prev => [...prev, newWarehouse])
        toast.success('Bodega creada exitosamente')

        return newWarehouse
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear bodega'
        setError(message)
        toast.error(message)
        return null
      } finally {
        setSaving(false)
      }
    },
    [familyId]
  )

  /**
   * Actualizar bodega
   */
  const updateWarehouse = useCallback(
    async (id: string, data: UpdateWarehouseData): Promise<boolean> => {
      setSaving(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/inventory/warehouses/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al actualizar bodega')
        }

        const result = await response.json()
        const updatedWarehouse = result.warehouse

        setWarehouses(prev => prev.map(w => (w.id === id ? updatedWarehouse : w)))
        toast.success('Bodega actualizada exitosamente')

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar bodega'
        setError(message)
        toast.error(message)
        return false
      } finally {
        setSaving(false)
      }
    },
    []
  )

  /**
   * Eliminar/desactivar bodega
   */
  const deleteWarehouse = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/inventory/warehouses/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al eliminar bodega')
      }

      const result = await response.json()

      // Si fue soft delete, actualizar estado
      if (result.warehouse) {
        setWarehouses(prev => prev.map(w => (w.id === id ? result.warehouse : w)))
      } else {
        // Si fue hard delete, remover de la lista
        setWarehouses(prev => prev.filter(w => w.id !== id))
      }

      toast.success(result.message || 'Bodega eliminada exitosamente')

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar bodega'
      setError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  /**
   * Activar/desactivar bodega
   */
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      return updateWarehouse(id, { isActive })
    },
    [updateWarehouse]
  )

  /**
   * Auto-load cuando cambia familyId
   */
  useEffect(() => {
    loadWarehouses()
  }, [loadWarehouses])

  /**
   * Cargar managers al montar
   */
  useEffect(() => {
    loadAvailableManagers()
  }, [loadAvailableManagers])

  return {
    warehouses,
    availableManagers,
    loading,
    saving,
    error,
    loadWarehouses,
    loadAvailableManagers,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    toggleActive,
  }
}
