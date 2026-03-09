/**
 * Hook para gestión de datos y cache de categorías
 * Responsabilidad: Cargar, cachear y gestionar el estado de las categorías
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { devLogger } from '@/lib/dev-logger'
import { enrichCategories } from '@/lib/utils/category-utils'
import type { CategoryData, CacheEntry } from './types'

interface UseCategoriesDataOptions {
  cacheTTL?: number
  enableCache?: boolean
}

export function useCategoriesData(options: UseCategoriesDataOptions = {}) {
  const { cacheTTL = 5 * 60 * 1000, enableCache = true } = options
  
  // Estados
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [availableParents, setAvailableParents] = useState<CategoryData[]>([])
  const [availableTechnicians, setAvailableTechnicians] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { toast } = useToast()
  
  // Cache
  const cache = useMemo(() => new Map<string, CacheEntry<any>>(), [])
  
  const getCacheKey = useCallback((endpoint: string, params?: Record<string, any>) => {
    const paramString = params ? JSON.stringify(params) : ''
    return `${endpoint}:${paramString}`
  }, [])
  
  const getFromCache = useCallback(<T>(key: string): T | null => {
    if (!enableCache) return null
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key)
      return null
    }
    return entry.data
  }, [cache, enableCache])
  
  const setToCache = useCallback(<T>(key: string, data: T, ttl = cacheTTL) => {
    if (!enableCache) return
    cache.set(key, { data, timestamp: Date.now(), ttl })
  }, [cache, enableCache, cacheTTL])
  
  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      Array.from(cache.keys())
        .filter(key => key.includes(pattern))
        .forEach(key => cache.delete(key))
    } else {
      cache.clear()
    }
  }, [cache])
  
  // Cargar categorías
  const loadCategories = useCallback(async (searchTerm = '', levelFilter = 'all', forceRefresh = false) => {
    const params = {
      search: searchTerm || undefined,
      level: levelFilter !== 'all' ? levelFilter : undefined
    }
    const cacheKey = getCacheKey('/api/categories', params)
    
    if (!forceRefresh) {
      const cached = getFromCache<CategoryData[]>(cacheKey)
      if (cached) {
        const enrichedCached = enrichCategoriesWithLevelName(cached)
        setCategories(enrichedCached)
        setLoading(false)
        return
      }
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const urlParams = new URLSearchParams()
      if (searchTerm) urlParams.append('search', searchTerm)
      if (levelFilter !== 'all') urlParams.append('level', levelFilter)
      
      const response = await fetch(`/api/categories?${urlParams}`, {
        headers: { 'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300' },
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
        const enrichedCategories = enrichCategoriesWithLevelName(data.data)
        setCategories(enrichedCategories)
        setToCache(cacheKey, enrichedCategories)
      } else {
        throw new Error('Formato de respuesta inválido')
      }
    } catch (error) {
      devLogger.error('[CATEGORIES] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(errorMessage)
      setCategories([])
      toast({
        title: 'Error al cargar categorías',
        description: `No se pudieron cargar las categorías: ${errorMessage}`,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [getCacheKey, getFromCache, setToCache, toast])
  
  // Cargar técnicos
  const loadAvailableTechnicians = useCallback(async () => {
    const cacheKey = getCacheKey('/api/users', { role: 'TECHNICIAN', isActive: true })
    const cached = getFromCache<any[]>(cacheKey)
    if (cached) {
      setAvailableTechnicians(cached)
      return
    }
    
    try {
      const response = await fetch('/api/users?role=TECHNICIAN&isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setAvailableTechnicians(data.data)
          setToCache(cacheKey, data.data)
        }
      }
    } catch (error) {
      devLogger.error('[CATEGORIES] Error al cargar técnicos:', error)
    }
  }, [getCacheKey, getFromCache, setToCache])
  
  // Cargar departamentos
  const loadDepartments = useCallback(async () => {
    const cacheKey = getCacheKey('/api/departments', { isActive: true })
    const cached = getFromCache<any[]>(cacheKey)
    if (cached) {
      setDepartments(cached)
      return
    }
    
    try {
      const response = await fetch('/api/departments?isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setDepartments(data.data)
          setToCache(cacheKey, data.data)
        }
      }
    } catch (error) {
      devLogger.error('[CATEGORIES] Error al cargar departamentos:', error)
    }
  }, [getCacheKey, getFromCache, setToCache])
  
  // Función para obtener el nombre del nivel
  const getLevelName = useCallback((level: number): string => {
    switch (level) {
      case 1: return 'Principal'
      case 2: return 'Subcategoría'
      case 3: return 'Especialidad'
      case 4: return 'Detalle'
      default: return 'Máximo'
    }
  }, [])

  // Función para enriquecer categorías con levelName
  const enrichCategoriesWithLevelName = useCallback((categories: CategoryData[]): CategoryData[] => {
    return enrichCategories(categories)
  }, [])

  // Cargar padres disponibles con información de técnicos
  const loadAvailableParents = useCallback(async (currentCategoryId?: string) => {
    try {
      // Cargar todas las categorías activas con información completa de técnicos
      const response = await fetch('/api/categories?isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          // Filtrar categorías que pueden ser padres (niveles 1, 2, 3)
          const availableAsParents = data.data.filter((cat: CategoryData) => {
            // Excluir la categoría actual si se está editando
            if (currentCategoryId && cat.id === currentCategoryId) {
              return false
            }
            // Solo niveles 1, 2, 3 pueden ser padres (nivel 4 es el máximo)
            return cat.level <= 3 && cat.isActive
          })
          
          // Enriquecer con levelName y información de técnicos
          const enrichedCategories = enrichCategoriesWithLevelName(availableAsParents).map(cat => ({
            ...cat,
            // Agregar información de técnicos asignados
            assignedTechnicians: cat.technician_assignments?.map(ta => ({
              id: ta.users.id,
              name: ta.users.name,
              email: ta.users.email,
              priority: ta.priority,
              maxTickets: ta.maxTickets,
              autoAssign: ta.autoAssign
            })) || [],
            // Agregar estadísticas de técnicos
            technicianStats: {
              total: cat.technician_assignments?.length || 0,
              autoAssign: cat.technician_assignments?.filter(ta => ta.autoAssign).length || 0,
              highPriority: cat.technician_assignments?.filter(ta => ta.priority <= 3).length || 0
            }
          }))
          
          setAvailableParents(enrichedCategories)
        }
      }
    } catch (error) {
      devLogger.error('[CATEGORIES] Error al cargar padres:', error)
    }
  }, [enrichCategoriesWithLevelName])
  
  return {
    // Estados
    categories,
    availableParents,
    availableTechnicians,
    departments,
    loading,
    error,
    
    // Funciones
    loadCategories,
    loadAvailableParents,
    loadAvailableTechnicians,
    loadDepartments,
    invalidateCache,
    
    // Setters
    setCategories,
    setLoading,
    setError,
  }
}
