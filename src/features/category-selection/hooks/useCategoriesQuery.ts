/**
 * Hook optimizado para cargar categorías con React Query
 * 
 * Requisitos: 9.6, 9.1
 * 
 * Optimizaciones:
 * - Caché de categorías en el cliente
 * - Prefetching para mejorar tiempos de carga
 * - Stale-while-revalidate pattern
 */

import { useQuery } from '@tanstack/react-query';
import type { Category } from '../types';
import { categoryQueryKeys, categoryQueryOptions } from '../config/query.config';

export interface UseCategoriesQueryOptions {
  enabled?: boolean;
}

export interface UseCategoriesQueryReturn {
  categories: Category[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface CategoriesAPIResponse {
  success: boolean;
  data: Category[];
  meta?: {
    total: number;
    filters: any;
  };
  message?: string;
}

/**
 * Fetch categories from API
 */
async function fetchCategories(): Promise<Category[]> {
  const response = await fetch('/api/categories?isActive=true', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Error al obtener categorías: ${response.status}`
    );
  }

  const result: CategoriesAPIResponse = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Error al obtener categorías');
  }

  // La API retorna data directamente como array de categorías
  return result.data || [];
}

/**
 * Hook para cargar categorías con caché optimizado
 * 
 * @example
 * ```tsx
 * const { categories, isLoading, error } = useCategoriesQuery();
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return <CategorySelector categories={categories} />;
 * ```
 */
export function useCategoriesQuery({
  enabled = true,
}: UseCategoriesQueryOptions = {}): UseCategoriesQueryReturn {
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Category[], Error>({
    queryKey: categoryQueryKeys.active(),
    queryFn: fetchCategories,
    enabled,
    ...categoryQueryOptions.active,
  });

  return {
    categories: data,
    isLoading,
    error: error || null,
    refetch,
  };
}
