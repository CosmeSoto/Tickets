'use client'

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface EquipmentBrand {
  id: string
  code: string
  name: string
  description?: string | null
  logoUrl?: string | null
  isActive: boolean
  order: number
  familyId?: string | null
  createdAt: string
  updatedAt: string
}

interface UseBrandManagementOptions {
  familyId?: string | null
}

export function useBrandManagement({ familyId }: UseBrandManagementOptions = {}) {
  const { toast } = useToast()
  const [brands, setBrands] = useState<EquipmentBrand[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadBrands = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (familyId) params.set('familyId', familyId)
      const response = await fetch(`/api/admin/inventory/brands?${params}`)
      if (!response.ok) throw new Error('Error al cargar marcas')
      const data = await response.json()
      setBrands(data.brands ?? [])
    } catch (error) {
      console.error('Error loading brands:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las marcas',
      })
    } finally {
      setLoading(false)
    }
  }, [familyId, toast])

  const createBrand = useCallback(
    async (data: {
      code: string
      name: string
      description?: string
      logoUrl?: string
      isActive?: boolean
      order?: number
    }): Promise<EquipmentBrand | null> => {
      setSaving(true)
      try {
        const response = await fetch('/api/admin/inventory/brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, familyId }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al crear marca')
        }

        const newBrand = await response.json()
        setBrands(prev => [...prev, newBrand])
        toast({ title: 'Marca creada', description: newBrand.name })
        return newBrand
      } catch (error: any) {
        console.error('Error creating brand:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo crear la marca',
        })
        return null
      } finally {
        setSaving(false)
      }
    },
    [familyId, toast]
  )

  const updateBrand = useCallback(
    async (
      id: string,
      data: Partial<{
        code: string
        name: string
        description?: string
        logoUrl?: string
        isActive?: boolean
        order?: number
      }>
    ): Promise<boolean> => {
      setSaving(true)
      try {
        const response = await fetch(`/api/admin/inventory/brands/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al actualizar marca')
        }

        const updatedBrand = await response.json()
        setBrands(prev => prev.map(b => (b.id === id ? updatedBrand : b)))
        toast({ title: 'Marca actualizada', description: updatedBrand.name })
        return true
      } catch (error: any) {
        console.error('Error updating brand:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo actualizar la marca',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast]
  )

  const deleteBrand = useCallback(
    async (id: string): Promise<boolean> => {
      setSaving(true)
      try {
        const response = await fetch(`/api/admin/inventory/brands/${id}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Error al eliminar marca')
        }

        setBrands(prev => prev.filter(b => b.id !== id))
        toast({ title: 'Marca eliminada' })
        return true
      } catch (error: any) {
        console.error('Error deleting brand:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'No se pudo eliminar la marca',
        })
        return false
      } finally {
        setSaving(false)
      }
    },
    [toast]
  )

  const toggleActive = useCallback(
    async (id: string, isActive: boolean): Promise<boolean> => {
      return updateBrand(id, { isActive })
    },
    [updateBrand]
  )

  const activeBrands = useMemo(() => brands.filter(b => b.isActive), [brands])

  return {
    brands,
    activeBrands,
    loading,
    saving,
    loadBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    toggleActive,
  }
}
