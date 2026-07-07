/**
 * Custom hook for Attribute Management
 * Gestiona atributos de tipos (equipment, license, consumable)
 */

'use client'

import { useState, useCallback } from 'react'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

// ── Types ──────────────────────────────────────────────────────────────────

export type AttributeType = 'text' | 'number' | 'select' | 'date' | 'boolean'
export type TypeKind = 'equipment' | 'license' | 'consumable'

export interface Attribute {
  id: string
  attributeName: string
  attributeLabel: string
  attributeType: AttributeType
  options?: { options: string[] }
  isRequired: boolean
  isVisible: boolean
  order: number
  helpText?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateAttributeData {
  attributeName: string
  attributeLabel: string
  attributeType: AttributeType
  options?: { options: string[] }
  isRequired?: boolean
  isVisible?: boolean
  order?: number
  helpText?: string
}

export interface UpdateAttributeData {
  attributeLabel?: string
  attributeType?: AttributeType
  options?: { options: string[] }
  isRequired?: boolean
  isVisible?: boolean
  order?: number
  helpText?: string
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAttributeManagement(typeKind: TypeKind, typeId: string | null) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Load attributes ──
  const loadAttributes = useCallback(async () => {
    if (!typeId) {
      setAttributes([])
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/inventory/${typeKind}-types/${typeId}/attributes`)
      const data = await res.json()

      if (res.ok && data.attributes) {
        setAttributes(data.attributes)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al cargar atributos',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión al cargar atributos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [typeKind, typeId, toast])

  // ── Create attribute ──
  const createAttribute = useCallback(
    async (data: CreateAttributeData): Promise<boolean> => {
      if (!typeId) return false

      setSaving(true)
      try {
        const res = await fetch(`/api/admin/inventory/${typeKind}-types/${typeId}/attributes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()

        if (res.ok && result.attribute) {
          setAttributes(prev => [...prev, result.attribute])
          toast({
            title: 'Éxito',
            description: 'Atributo creado correctamente',
          })
          return true
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al crear atributo',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al crear atributo',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [typeKind, typeId, toast]
  )

  // ── Update attribute ──
  const updateAttribute = useCallback(
    async (attributeId: string, data: UpdateAttributeData): Promise<boolean> => {
      setSaving(true)
      try {
        const res = await fetch(`/api/admin/inventory/attributes/${attributeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        const result = await res.json()

        if (res.ok && result.attribute) {
          setAttributes(prev =>
            prev.map(attr => (attr.id === attributeId ? result.attribute : attr))
          )
          toast({
            title: 'Éxito',
            description: 'Atributo actualizado correctamente',
          })
          return true
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al actualizar atributo',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al actualizar atributo',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast]
  )

  // ── Delete attribute ──
  const deleteAttribute = useCallback(
    async (attributeId: string): Promise<boolean> => {
      setSaving(true)
      try {
        const res = await fetch(`/api/admin/inventory/attributes/${attributeId}`, {
          method: 'DELETE',
        })
        const result = await res.json()

        if (res.ok && result.success) {
          setAttributes(prev => prev.filter(attr => attr.id !== attributeId))
          toast({
            title: 'Éxito',
            description: 'Atributo eliminado correctamente',
          })
          return true
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Error al eliminar atributo',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Error de conexión al eliminar atributo',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast]
  )

  // ── Reorder attributes ──
  const reorderAttributes = useCallback(
    async (attributeIds: string[]): Promise<boolean> => {
      if (!typeId) return false

      // Actualizar UI optimísticamente
      const reordered = attributeIds
        .map(id => attributes.find(attr => attr.id === id))
        .filter(Boolean) as Attribute[]
      setAttributes(reordered)

      setSaving(true)
      try {
        const res = await fetch(
          `/api/admin/inventory/${typeKind}-types/${typeId}/attributes/reorder`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ attributeIds }),
          }
        )
        const result = await res.json()

        if (res.ok && result.success) {
          toast({
            title: 'Éxito',
            description: 'Orden actualizado correctamente',
          })
          return true
        } else {
          // Revertir cambios
          await loadAttributes()
          toast({
            title: 'Error',
            description: result.error || 'Error al reordenar atributos',
            variant: 'destructive',
          })
          return false
        }
      } catch (error) {
        // Revertir cambios
        await loadAttributes()
        toast({
          title: 'Error',
          description: 'Error de conexión al reordenar atributos',
          variant: 'destructive',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [typeKind, typeId, attributes, loadAttributes, toast]
  )

  return {
    // Data
    attributes,

    // State
    loading,
    saving,

    // Actions
    loadAttributes,
    createAttribute,
    updateAttribute,
    deleteAttribute,
    reorderAttributes,
  }
}
