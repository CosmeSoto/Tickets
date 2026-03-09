/**
 * Hook para obtener categorías frecuentes del cliente
 * 
 * Integra con el endpoint GET /api/categories/frequent y usa React Query
 * para caché y manejo de estados de loading/error.
 * 
 * @module useFrequentCategories
 * 
 * @description
 * Este hook obtiene las categorías más usadas por un cliente específico,
 * basándose en su historial de tickets. Características:
 * 
 * - Integración con React Query para caché automático
 * - Cálculo basado en los últimos 20 tickets del cliente
 * - Fallback a categorías populares del sistema si no hay historial
 * - Manejo automático de estados de loading y error
 * - Opción para deshabilitar la query
 * - Función de refetch manual
 * 
 * @example
 * ```tsx
 * const { frequentCategories, isLoading, error } = useFrequentCategories({
 *   clientId: 'user-123',
 *   limit: 5
 * });
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     {frequentCategories.map(item => (
 *       <CategoryCard key={item.category.id} {...item} />
 *     ))}
 *   </div>
 * );
 * ```
 * 
 * @remarks
 * - Los datos se cachean automáticamente por 5 minutos
 * - La query solo se ejecuta si enabled=true y hay clientId
 * - El límite por defecto es 5 categorías
 * - Las categorías se ordenan por frecuencia de uso descendente
 * 
 * Requisitos implementados: 5.1, 5.2, 5.3, 5.6
 */

import { useQuery } from '@tanstack/react-query';
import type { FrequentCategory } from '../types';
import { categoryQueryKeys, categoryQueryOptions } from '../config/query.config';

/**
 * Opciones de configuración para useFrequentCategories
 * 
 * @property {string} clientId - ID del cliente para obtener sus categorías frecuentes
 * @property {number} [limit=5] - Número máximo de categorías frecuentes a retornar
 * @property {boolean} [enabled=true] - Si la query está habilitada (útil para lazy loading)
 */
export interface UseFrequentCategoriesOptions {
  clientId: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Valor de retorno del hook useFrequentCategories
 * 
 * @property {FrequentCategory[]} frequentCategories - Array de categorías frecuentes con metadata
 * @property {boolean} isLoading - Indica si la query está cargando
 * @property {Error | null} error - Error si la query falló, null si no hay error
 * @property {function} refetch - Función para refrescar manualmente los datos
 */
export interface UseFrequentCategoriesReturn {
  frequentCategories: FrequentCategory[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Respuesta de la API de categorías frecuentes
 */
interface FrequentCategoriesAPIResponse {
  success: boolean;
  data: {
    categories: Array<{
      category: FrequentCategory['category'];
      path: FrequentCategory['path'];
      usageCount: number;
      lastUsed: string; // ISO string
    }>;
  };
  message?: string;
}

/**
 * Función para hacer fetch de categorías frecuentes
 */
async function fetchFrequentCategories(
  clientId: string,
  limit: number
): Promise<FrequentCategory[]> {
  const params = new URLSearchParams({
    clientId,
    limit: limit.toString(),
  });

  const response = await fetch(`/api/categories/frequent?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Error al obtener categorías frecuentes: ${response.status}`
    );
  }

  const data: FrequentCategoriesAPIResponse = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Error al obtener categorías frecuentes');
  }

  // Transformar respuesta de API a FrequentCategory
  return data.data.categories.map(item => ({
    category: item.category,
    path: item.path,
    usageCount: item.usageCount,
    lastUsed: new Date(item.lastUsed),
  }));
}

/**
 * Hook para obtener categorías frecuentes del cliente
 * 
 * @param {UseFrequentCategoriesOptions} options - Opciones de configuración
 * @returns {UseFrequentCategoriesReturn} Objeto con categorías frecuentes, estado y función refetch
 * 
 * @example
 * ```tsx
 * const { frequentCategories, isLoading, error } = useFrequentCategories({
 *   clientId: 'user-123',
 *   limit: 5
 * });
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorMessage error={error} />;
 * 
 * return (
 *   <div>
 *     {frequentCategories.map(item => (
 *       <CategoryCard key={item.category.id} {...item} />
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useFrequentCategories({
  clientId,
  limit = 5,
  enabled = true,
}: UseFrequentCategoriesOptions): UseFrequentCategoriesReturn {
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<FrequentCategory[], Error>({
    queryKey: categoryQueryKeys.frequent(clientId),
    queryFn: () => fetchFrequentCategories(clientId, limit),
    enabled: enabled && !!clientId, // Solo ejecutar si está habilitado y hay clientId
    ...categoryQueryOptions.frequent,
  });

  return {
    frequentCategories: data,
    isLoading,
    error: error || null,
    refetch,
  };
}
