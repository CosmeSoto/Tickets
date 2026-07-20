/**
 * Hook optimizado para cargar categorías con React Query.
 * Soporta familyId para el flujo de creación de tickets (consumer por área).
 */

import { useQuery } from '@tanstack/react-query'
import type { Category } from '../types'
import { categoryQueryKeys, categoryQueryOptions } from '../config/query.config'

export interface UseCategoriesQueryOptions {
  enabled?: boolean
  /** Si se indica, pide categorías de esa área (consumer) al API */
  familyId?: string
}

export interface UseCategoriesQueryReturn {
  categories: Category[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

interface CategoriesAPIResponse {
  success: boolean
  data: Category[]
  meta?: {
    total: number
    filters: any
  }
  message?: string
}

async function fetchCategories(familyId?: string): Promise<Category[]> {
  const params = new URLSearchParams({ isActive: 'true' })
  if (familyId) params.set('familyId', familyId)

  const response = await fetch(`/api/categories?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Error al obtener categorías: ${response.status}`)
  }

  const result: CategoriesAPIResponse = await response.json()

  if (!result.success) {
    throw new Error(result.message || 'Error al obtener categorías')
  }

  return result.data || []
}

/**
 * Hook para cargar categorías con caché optimizado.
 * Con familyId: carga solo las del área (correcto al crear tickets).
 */
export function useCategoriesQuery({
  enabled = true,
  familyId,
}: UseCategoriesQueryOptions = {}): UseCategoriesQueryReturn {
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Category[], Error>({
    queryKey: familyId ? categoryQueryKeys.byFamily(familyId) : categoryQueryKeys.active(),
    queryFn: () => fetchCategories(familyId),
    enabled: enabled && (familyId ? Boolean(familyId) : true),
    ...categoryQueryOptions.active,
    // Al cambiar de área siempre debe pedir de nuevo
    refetchOnMount: Boolean(familyId),
  })

  return {
    categories: data,
    isLoading,
    error: error || null,
    refetch,
  }
}
