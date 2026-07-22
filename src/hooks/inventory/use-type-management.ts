/**
 * Custom hook for Type Management (Generic)
 * Reutilizable para equipment_types, license_types, consumable_types
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Genera un código slug a partir de un nombre
 * Ej: "Laptop HP" -> "laptop-hp"
 */
function generateCode(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD') // Normalizar caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres especiales
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-') // Múltiples guiones a uno solo
}

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
  trackMaintenance: boolean
}

export interface LicenseType extends BaseType {}

export interface ConsumableType extends BaseType {}

export type AnyType = EquipmentType | LicenseType | ConsumableType

export interface CreateTypeData {
  code?: string
  name: string
  description?: string
  icon?: string | null
  familyId: string
  isActive?: boolean
  order?: number
  /** Solo equipment_types */
  trackMaintenance?: boolean
}

export interface UpdateTypeData extends Partial<CreateTypeData> {}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTypeManagement<T extends AnyType = AnyType>(
  typeKind: TypeKind,
  familyId: string | null
) {
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
        const code = data.code || generateCode(data.name)
        const body: Record<string, unknown> = {
          code,
          name: data.name,
          description: data.description,
          icon: data.icon,
          familyId,
          isActive: data.isActive,
          order: data.order,
        }
        if (typeKind === 'equipment') {
          body.trackMaintenance = data.trackMaintenance ?? false
        }

        const res = await fetch(getEndpoint(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
    [familyId, getEndpoint, toast, typeKind]
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
    if (familyId) {
      loadTypes()
    }
  }, [familyId])

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
