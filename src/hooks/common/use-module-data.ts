/**
 * Hook genérico para operaciones CRUD en cualquier módulo
 * Maneja loading, error states y operaciones comunes
 * 
 * @example
 * ```tsx
 * const { 
 *   data, 
 *   loading, 
 *   error, 
 *   create, 
 *   update, 
 *   remove, 
 *   reload 
 * } = useModuleData<User>({
 *   endpoint: '/api/users',
 *   initialLoad: true
 * })
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
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
  // Datos
  data: T[]
  
  // Estados
  loading: boolean
  error: string | null
  
  // Operaciones CRUD
  create: (item: Partial<T>) => Promise<T | null>
  update: (id: string, item: Partial<T>) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
  reload: () => Promise<void>
  
  // Utilidades
  findById: (id: string) => T | undefined
  setData: (data: T[]) => void
}

interface CacheEntry<T> {
  data: T[]
  timestamp: number
}

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
    cacheTTL = 5 * 60 * 1000, // 5 minutos por defecto
    enableCache = false
  } = options

  const { toast } = useToast()
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cargar datos
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError(null)

    try {
      // Verificar cache
      if (enableCache) {
        const cached = cache.get(endpoint)
        if (cached && Date.now() - cached.timestamp < cacheTTL) {
          setData(cached.data)
          if (showLoading) setLoading(false)
          if (onSuccess) onSuccess(cached.data)
          return
        }
      }

      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Extraer datos según estructura de respuesta
      let items: T[]
      if (result.success && result.data) {
        items = Array.isArray(result.data) ? result.data : [result.data]
      } else if (Array.isArray(result)) {
        items = result
      } else {
        items = []
      }

      // Aplicar transformación si existe
      const finalData = transform ? transform(items) : items

      setData(finalData)

      // Guardar en cache
      if (enableCache) {
        cache.set(endpoint, {
          data: finalData,
          timestamp: Date.now()
        })
      }

      if (onSuccess) onSuccess(finalData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos'
      setError(errorMessage)
      if (onError) onError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [endpoint, enableCache, cacheTTL, transform, onSuccess, onError, toast])

  // Crear item
  const create = useCallback(async (item: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Error ${response.status}`)
      }

      const result = await response.json()
      const newItem = result.success ? result.data : result

      // Actualizar lista local
      setData(prev => [...prev, newItem])

      // Invalidar cache
      if (enableCache) {
        cache.delete(endpoint)
      }

      toast({
        title: 'Éxito',
        description: 'Registro creado correctamente'
      })

      return newItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear'
      setError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })

      return null
    } finally {
      setLoading(false)
    }
  }, [endpoint, enableCache, toast])

  // Actualizar item
  const update = useCallback(async (id: string, item: Partial<T>): Promise<T | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Error ${response.status}`)
      }

      const result = await response.json()
      const updatedItem = result.success ? result.data : result

      // Actualizar lista local
      setData(prev => prev.map(i => i.id === id ? updatedItem : i))

      // Invalidar cache
      if (enableCache) {
        cache.delete(endpoint)
      }

      toast({
        title: 'Éxito',
        description: 'Registro actualizado correctamente'
      })

      return updatedItem
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar'
      setError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })

      return null
    } finally {
      setLoading(false)
    }
  }, [endpoint, enableCache, toast])

  // Eliminar item
  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Error ${response.status}`)
      }

      // Actualizar lista local
      setData(prev => prev.filter(i => i.id !== id))

      // Invalidar cache
      if (enableCache) {
        cache.delete(endpoint)
      }

      toast({
        title: 'Éxito',
        description: 'Registro eliminado correctamente'
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar'
      setError(errorMessage)
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })

      return false
    } finally {
      setLoading(false)
    }
  }, [endpoint, enableCache, toast])

  // Recargar datos
  const reload = useCallback(async () => {
    // Invalidar cache antes de recargar
    if (enableCache) {
      cache.delete(endpoint)
    }
    await loadData(true)
  }, [loadData, enableCache, endpoint])

  // Buscar por ID
  const findById = useCallback((id: string) => {
    return data.find(item => item.id === id)
  }, [data])

  // Carga inicial
  useEffect(() => {
    if (initialLoad) {
      loadData(true)
    }
  }, []) // Solo en mount

  return {
    data,
    loading,
    error,
    create,
    update,
    remove,
    reload,
    findById,
    setData
  }
}
