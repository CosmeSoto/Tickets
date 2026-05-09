/**
 * Custom hook for Type Management (Generic)
 * Reutilizable para equipment_types, license_types, consumable_types
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────

export type TypeKind = 'equipment' | 'license' | 'consumable'

export interface BaseType {
  id: string
  name: string
  description?: string | null
  familyId: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EquipmentType extends BaseType {
  requiresSerial: boolean
  requiresModel: boolean
  trackMaintenance: boolean
}

export interface LicenseType extends BaseType {
  requiresKey: boolean
  allowMultipleAssignments: boolean
  maxAssignments?: number | null
}

export interface ConsumableType extends BaseType {
  trackStock: boolean
  minStockLevel?: number | null
  reorderPoint?: number | null
}

export type AnyType = EquipmentType | LicenseType | ConsumableType

export interface CreateTypeData {
  name: string
  description?: string
  familyId: string
  isActive?: boolean
  // Equipment specific
  requiresSerial?: boolean
  requiresModel?: boolean
  trackMaintenance?: boolean
  // License specific
  requiresKey?: boolean
  allowMultipleAssignments?: boolean
  maxAssignments?: number | null
  // Consumable specific
  trackStock?: boolean
  minStockLevel?: number | null
  reorderPoint?: number | null
}

export interface UpdateTypeData extends Partial<CreateTypeData> {}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTypeManagement<T extends AnyType = AnyType>(
  typeKind: TypeKind,
  familyId: string | null
) {
  const { toast } = useToast()

  const [types, setTypes] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Get API endpoint ──
  const getEndpoint = useCallback(() => {
    return `/api/admin/inventory/${typeKind}-types`
  }, [typeKind])

  // ── Load types ──
  const loadTypes = useCallback(async () => {
    if (!familyId) {
      setTypes([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${getEndpoint()}?familyId=${familyId}`)
      const data = await res.json()

      if (res.ok && data.types) {
        setTypes(data.types)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al cargar tipos',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión al cargar tipos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [familyId, getEndpoint, toast])

  // ── Create type ──
  const createType = useCallback(
    async (data: CreateTypeData): Promise<T | null> => {
      if (!familyId) return null

      setSaving(true)
      try {
        const res = await fetch(getEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, familyId }),
        })
        const result = await res.json()

        if (res.ok && result.type) {
          setTypes(prev => [...prev, result.type])
          toast({
            title: 'Éxito',
            description: 'Tipo creado correctamente',
          })
          return result.type
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al crear tipo',
            variant: 'destructive',
          })
          return null
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al crear tipo',
          variant: 'destructive',
        })
        return null
      } finally {
        setSaving(false)
      }
    },
    [familyId, getEndpoint, toast]
  )

  // ── Update type ──
  const updateType = useCallback(
    async (typeId: string, data: UpdateTypeData): Promise<boolean> => {
      setSaving(true)
      try {
        const res = await fetch(`${getEndpoint()}/${typeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()

        if (res.ok && result.type) {
          setTypes(prev => prev.map(t => (t.id === typeId ? result.type : t)))
          toast({
            title: 'Éxito',
            description: 'Tipo actualizado correctamente',
          })
          return true
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al actualizar tipo',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al actualizar tipo',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [getEndpoint, toast]
  )

  // ── Delete type ──
  const deleteType = useCallback(
    async (typeId: string): Promise<boolean> => {
      setSaving(true)
      try {
        const res = await fetch(`${getEndpoint()}/${typeId}`, {
          method: 'DELETE',
        })
        const result = await res.json()

        if (res.ok && result.success) {
          // Si fue soft delete, actualizar el tipo en lugar de eliminarlo
          if (result.type) {
            setTypes(prev => prev.map(t => (t.id === typeId ? result.type : t)))
          } else {
            // Hard delete, remover de la lista
            setTypes(prev => prev.filter(t => t.id !== typeId))
          }
          toast({
            title: 'Éxito',
            description: result.message || 'Tipo eliminado correctamente',
          })
          return true
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al eliminar tipo',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al eliminar tipo',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [getEndpoint, toast]
  )

  // ── Toggle active status ──
  const toggleActive = useCallback(
    async (typeId: string): Promise<boolean> => {
      const type = types.find(t => t.id === typeId)
      if (!type) return false

      return updateType(typeId, { isActive: !type.isActive })
    },
    [types, updateType]
  )

  // Auto-load when familyId changes
  useEffect(() => {
    loadTypes()
  }, [loadTypes])

  return {
    // Data
    types,

    // State
    loading,
    saving,

    // Actions
    loadTypes,
    createType,
    updateType,
    deleteType,
    toggleActive,
  }
}
