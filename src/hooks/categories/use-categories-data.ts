/**
 * Hook para gestión de datos y cache de categorías
 * Responsabilidad: Cargar, cachear y gestionar el estado de las categorías
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { devLogger } from '@/lib/dev-logger'
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
        setCategories(cached)
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
        setCategories(data.data)
        setToCache(cacheKey, data.data)
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
  
  // Cargar padres disponibles
  const loadAvailableParents = useCallback(async (currentCategoryId?: string) => {
    try {
      const response = await fetch('/api/categories?level=1,2,3')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          const filtered = currentCategoryId
            ? data.data.filter((cat: CategoryData) => cat.id !== currentCategoryId)
            : data.data
          setAvailableParents(filtered)
        }
      }
    } catch (error) {
      devLogger.error('[CATEGORIES] Error al cargar padres:', error)
    }
  }, [])
  
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
