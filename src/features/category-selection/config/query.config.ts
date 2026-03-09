/**
 * Configuración de React Query para caché de categorías
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Query keys para React Query
 */
export const categoryQueryKeys = {
  all: ['categories'] as const,
  active: () => [...categoryQueryKeys.all, 'active'] as const,
  frequent: (clientId: string) => [...categoryQueryKeys.all, 'frequent', clientId] as const,
  metadata: (categoryId: string) => [...categoryQueryKeys.all, 'metadata', categoryId] as const,
  search: (query: string) => [...categoryQueryKeys.all, 'search', query] as const,
};

/**
 * Opciones de configuración para queries de categorías
 */
export const categoryQueryOptions = {
  // Categorías activas - cachear por 5 minutos
  active: {
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  },
  
  // Categorías frecuentes - cachear por 1 minuto
  frequent: {
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  },
  
  // Metadata de categoría - cachear por 2 minutos
  metadata: {
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  },
};

/**
 * Cliente de React Query configurado para el módulo de categorías
 */
export function createCategoryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        refetchOnWindowFocus: false,
        staleTime: 5 * 60 * 1000, // 5 minutos por defecto
      },
    },
  });
}
