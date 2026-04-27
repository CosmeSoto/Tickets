/**
 * Hook genérico para operaciones CRUD en cualquier módulo.
 * 
 * Principio: las listas CRUD deben ser siempre frescas.
 * - NO hay caché local por defecto (enableCache=false)
 * - Después de create/update/remove: actualización optimista inmediata + reload para sincronizar
 * - reload() siempre limpia el Map local y hace fetch fresco
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface UseModuleDataOptions<T> {
  endpoint: string
  initialLoad?: boolean
  onSuccess?: (data: T[]) => void
  onError?: (error: string) => void
  transform?: (data: any) => T[]
  cacheTTL?: number
  enableCache?: boolean
}

export interface UseModuleDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  create: (item: Partial<T>) => Promise<T | null>
  update: (id: string, item: Partial<T>) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
  reload: () => Promise<void>
  findById: (id: string) => T | undefined
  setData: React.Dispatch<React.SetStateAction<T[]>>
}

interface CacheEntry<T> {
  data: T[]
  timestamp: number
}

// Map compartido a nivel de módulo — se limpia explícitamente en reload/mutaciones
const cache = new Map<string, CacheEntry<any>>()

export function useModuleData<T extends { id: string }>(
  options: UseModuleDataOptions<T>
): UseModuleDataReturn<T> {
  const {
    endpoint,
    initialLoad = true,
    onSuccess,
    onError,
    transform,
    cacheTTL = 30_000, // 30 segundos — mucho más conservador que antes
    enableCache = false,
  } = options

  const { toast } = useToast()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch central ──────────────────────────────────────────────────────────
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)

    try {
      // Caché local solo si está habilitada y no expiró
      if (enableCache) {
        const cached = cache.get(endpoint)
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          setData(cached.data)
          if (showLoading) setLoading(false)
          onSuccess?.(cached.data)
          return
        }
      }

      const response = await fetch(endpoint, { cache: 'no-store' })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      let items: T[]
      if (result.success && result.data) {
        items = Array.isArray(result.data) ? result.data : [result.data]
      } else if (Array.isArray(result)) {
        items = result
      } else {
        items = []
      }

      const finalData = transform ? transform(items) : items
      setData(finalData)

      if (enableCache) {
        cache.set(endpoint, { data: finalData, timestamp: Date.now() })
      }

      onSuccess?.(finalData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar datos'
      setError(msg)
      onError?.(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [endpoint, enableCache, cacheTTL, transform, onSuccess, onError, toast])

  // ── reload: siempre limpia caché y recarga ─────────────────────────────────
  const reload = useCallback(async () => {
    cache.delete(endpoint)
    await loadData(true)
  }, [loadData, endpoint])

  // ── create ─────────────────────────────────────────────────────────────────
  const create = useCallback(async (item: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || err.error || `Error ${response.status}`)
      }

      const result = await response.json()
      const newItem = result.success ? result.data : result

      // 1. Actualización optimista inmediata
      setData(prev => [...prev, newItem])
      // 2. Limpiar caché y recargar para obtener datos enriquecidos del servidor
      cache.delete(endpoint)
      setLoading(false)
      await loadData(false)

      toast({ title: 'Éxito', description: 'Registro creado correctamente' })
      return newItem
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear'
      setError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      setLoading(false)
      return null
    }
  }, [endpoint, loadData, toast])

  // ── update ─────────────────────────────────────────────────────────────────
  const update = useCallback(async (id: string, item: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || err.error || `Error ${response.status}`)
      }

      const result = await response.json()
      const updatedItem = result.success ? result.data : result

      // 1. Actualización optimista inmediata
      setData(prev => prev.map(i => i.id === id ? updatedItem : i))
      // 2. Recargar para sincronizar
      cache.delete(endpoint)
      setLoading(false)
      await loadData(false)

      toast({ title: 'Éxito', description: 'Registro actualizado correctamente' })
      return updatedItem
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar'
      setError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      setLoading(false)
      return null
    }
  }, [endpoint, loadData, toast])

  // ── remove ─────────────────────────────────────────────────────────────────
  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${endpoint}/${id}`, { method: 'DELETE' })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.message || err.error || `Error ${response.status}`)
      }

      // 1. Eliminación optimista inmediata
      setData(prev => prev.filter(i => i.id !== id))
      // 2. Recargar para sincronizar
      cache.delete(endpoint)
      setLoading(false)
      await loadData(false)

      toast({ title: 'Éxito', description: 'Registro eliminado correctamente' })
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar'
      setError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
      setLoading(false)
      return false
    }
  }, [endpoint, loadData, toast])

  const findById = useCallback((id: string) => data.find(i => i.id === id), [data])

  useEffect(() => {
    if (initialLoad) loadData(true)
  }, []) // Solo en mount

  return { data, loading, error, create, update, remove, reload, findById, setData }
}
