/**
 * Hook: useSupplierTypeManagement
 * Gestión de tipos de proveedor (globales o por familia)
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export interface SupplierTypeFamily {
  id: string
  name: string
  code: string
  color: string | null
}

export interface SupplierType {
  id: string
  name: string
  description: string | null
  familyId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  family?: SupplierTypeFamily | null
  _count?: {
    suppliers: number
  }
}

export interface CreateSupplierTypeData {
  name: string
  description?: string
  familyId?: string | null
  isActive?: boolean
}

export interface UpdateSupplierTypeData {
  name?: string
  description?: string | null
  familyId?: string | null
  isActive?: boolean
}

export function useSupplierTypeManagement(familyId?: string | null, includeGlobal = true) {
  const [supplierTypes, setSupplierTypes] = useState<SupplierType[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Cargar tipos de proveedor
   */
  const loadSupplierTypes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (familyId) {
        params.append('familyId', familyId)
      }
      if (!includeGlobal) {
        params.append('includeGlobal', 'false')
      }

      const response = await fetch(`/api/admin/inventory/supplier-types?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(data.error || 'Error al cargar tipos de proveedor')
      }

      const data = await response.json()
      setSupplierTypes(data.supplierTypes || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar tipos de proveedor'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [familyId, includeGlobal])

  /**
   * Crear tipo de proveedor
   */
  const createSupplierType = useCallback(
    async (data: CreateSupplierTypeData): Promise<SupplierType | null> => {
      setSaving(true)
      setError(null)

      try {
        const response = await fetch('/api/admin/inventory/supplier-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al crear tipo de proveedor')
        }

        const result = await response.json()
        const newSupplierType = result.supplierType

        setSupplierTypes(prev => [...prev, newSupplierType])
        toast.success('Tipo de proveedor creado exitosamente')

        return newSupplierType
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al crear tipo de proveedor'
        setError(message)
        toast.error(message)
        return null
      } finally {
        setSaving(false)
      }
    },
    []
  )

  /**
   * Actualizar tipo de proveedor
   */
  const updateSupplierType = useCallback(
    async (id: string, data: UpdateSupplierTypeData): Promise<boolean> => {
      setSaving(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/inventory/supplier-types/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Error al actualizar tipo de proveedor')
        }

        const result = await response.json()
        const updatedSupplierType = result.supplierType

        setSupplierTypes(prev => prev.map(st => (st.id === id ? updatedSupplierType : st)))
        toast.success('Tipo de proveedor actualizado exitosamente')

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error al actualizar tipo de proveedor'
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
   * Eliminar/desactivar tipo de proveedor
   */
  const deleteSupplierType = useCallback(async (id: string): Promise<boolean> => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/inventory/supplier-types/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al eliminar tipo de proveedor')
      }

      const result = await response.json()

      // Si fue soft delete, actualizar estado
      if (result.supplierType) {
        setSupplierTypes(prev => prev.map(st => (st.id === id ? result.supplierType : st)))
      } else {
        // Si fue hard delete, remover de la lista
        setSupplierTypes(prev => prev.filter(st => st.id !== id))
      }

      toast.success(result.message || 'Tipo de proveedor eliminado exitosamente')

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar tipo de proveedor'
      setError(message)
      toast.error(message)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  /**
   * Activar/desactivar tipo de proveedor
   */
  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      return updateSupplierType(id, { isActive })
    },
    [updateSupplierType]
  )

  /**
   * Auto-load cuando cambian los parámetros
   */
  useEffect(() => {
    loadSupplierTypes()
  }, [loadSupplierTypes])

  return {
    supplierTypes,
    loading,
    saving,
    error,
    loadSupplierTypes,
    createSupplierType,
    updateSupplierType,
    deleteSupplierType,
    toggleActive,
  }
}
