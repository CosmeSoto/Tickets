/**
 * Hook para búsqueda fuzzy de categorías con Fuse.js
 * 
 * Proporciona búsqueda en tiempo real sobre nombres, descripciones y palabras clave
 * de categorías, con historial de búsquedas en la sesión.
 * 
 * @module useCategorySearch
 * 
 * @description
 * Este hook implementa búsqueda fuzzy usando Fuse.js para encontrar categorías
 * relevantes basándose en el texto ingresado por el usuario. Características:
 * 
 * - Búsqueda normalizada (sin acentos, case-insensitive)
 * - Búsqueda en múltiples campos (nombre, descripción, keywords)
 * - Resaltado de términos coincidentes
 * - Historial de búsquedas en sessionStorage
 * - Construcción automática de paths jerárquicos
 * - Configuración de threshold y límite de resultados
 * 
 * @example
 * ```tsx
 * const { search, isSearching, searchHistory } = useCategorySearch({
 *   categories: allCategories,
 *   threshold: 0.3,
 *   maxResults: 10
 * });
 * 
 * // Realizar búsqueda
 * const results = search('impresora');
 * 
 * // Mostrar resultados
 * results.forEach(result => {
 *   console.log(result.category.name);
 *   console.log('Path:', result.path.map(c => c.name).join(' > '));
 *   console.log('Score:', result.score);
 * });
 * ```
 * 
 * @remarks
 * - El historial se guarda en sessionStorage y persiste durante la sesión
 * - Las búsquedas con menos de 2 caracteres retornan array vacío
 * - Los resultados incluyen el path completo desde la categoría raíz
 * - El score va de 0 (peor) a 1 (mejor)
 * 
 * Requisitos implementados: 1.2, 1.3, 1.4, 1.5, 1.7, 1.8
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import Fuse from 'fuse.js';
import type { Category, SearchResult, CategorySearchIndex } from '../types';
import { fuseOptions, normalizeText } from '../config/fuse.config';
import { buildSearchIndex, buildCategoryPath } from '../utils/search-index';

const SEARCH_HISTORY_KEY = 'category_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Opciones de configuración para useCategorySearch
 * 
 * @property {Category[]} categories - Array de todas las categorías disponibles
 * @property {number} [threshold=0.3] - Umbral de similitud para Fuse.js (0.0 = exacto, 1.0 = cualquier cosa)
 * @property {number} [maxResults=10] - Número máximo de resultados a retornar
 */
export interface UseCategorySearchOptions {
  categories: Category[];
  threshold?: number;
  maxResults?: number;
}

/**
 * Valor de retorno del hook useCategorySearch
 * 
 * @property {function} search - Función para realizar búsqueda. Recibe query string y retorna array de resultados
 * @property {boolean} isSearching - Indica si hay una búsqueda en progreso
 * @property {string[]} searchHistory - Historial de búsquedas de la sesión (máximo 10 items)
 * @property {function} clearHistory - Función para limpiar el historial de búsquedas
 */
export interface UseCategorySearchReturn {
  search: (query: string) => SearchResult[];
  isSearching: boolean;
  searchHistory: string[];
  clearHistory: () => void;
}

/**
 * Hook para búsqueda fuzzy de categorías
 * 
 * @param {UseCategorySearchOptions} options - Opciones de configuración
 * @returns {UseCategorySearchReturn} Objeto con función de búsqueda, estado y historial
 * 
 * @example
 * ```tsx
 * const { search, isSearching, searchHistory } = useCategorySearch({
 *   categories: allCategories,
 *   threshold: 0.3,
 *   maxResults: 10
 * });
 * 
 * const results = search('impresora');
 * ```
 */
export function useCategorySearch({
  categories,
  threshold = 0.3,
  maxResults = 10,
}: UseCategorySearchOptions): UseCategorySearchReturn {
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Cargar historial de búsquedas desde sessionStorage al montar
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SEARCH_HISTORY_KEY);
      if (stored) {
        const history = JSON.parse(stored) as string[];
        setSearchHistory(history);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }, []);

  // Construir índice de búsqueda
  const searchIndex = useMemo(() => {
    return buildSearchIndex(categories);
  }, [categories]);

  // Crear mapa de categorías para acceso rápido
  const categoriesMap = useMemo(() => {
    return new Map<string, Category>(
      categories.map(cat => [cat.id, cat])
    );
  }, [categories]);

  // Inicializar Fuse.js con el índice
  const fuse = useMemo(() => {
    const options = {
      ...fuseOptions,
      threshold,
    };
    return new Fuse(searchIndex, options);
  }, [searchIndex, threshold]);

  // Guardar historial en sessionStorage
  const saveHistory = useCallback((history: string[]) => {
    try {
      sessionStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }, []);

  // Agregar búsqueda al historial
  const addToHistory = useCallback((query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 2) return;

    setSearchHistory(prev => {
      // Evitar duplicados y mantener máximo de items
      const filtered = prev.filter(item => item !== normalizedQuery);
      const newHistory = [normalizedQuery, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      saveHistory(newHistory);
      return newHistory;
    });
  }, [saveHistory]);

  // Limpiar historial
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      sessionStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing search history:', error);
    }
  }, []);

  // Función de búsqueda
  const search = useCallback((query: string): SearchResult[] => {
    // Manejar consultas vacías
    if (!query || query.trim().length < 2) {
      return [];
    }

    setIsSearching(true);

    try {
      // Normalizar query para búsqueda
      const normalizedQuery = normalizeText(query);

      // Realizar búsqueda con Fuse.js
      const fuseResults = fuse.search(normalizedQuery);

      // Agregar al historial
      addToHistory(query);

      // Transformar resultados de Fuse a SearchResult
      const results: SearchResult[] = fuseResults
        .slice(0, maxResults)
        .map(result => {
          const indexItem = result.item;
          const category = categoriesMap.get(indexItem.id);

          if (!category) {
            return null;
          }

          // Construir path completo
          const path = buildCategoryPath(category, categoriesMap);

          // Extraer campos coincidentes
          const matchedFields = result.matches
            ? result.matches.map(match => match.key || '').filter(Boolean)
            : [];

          // Score de relevancia (Fuse devuelve 0 = mejor, 1 = peor, lo invertimos)
          const score = result.score !== undefined ? 1 - result.score : 0;

          return {
            category,
            path,
            matchedFields,
            score,
          };
        })
        .filter((result): result is SearchResult => result !== null);

      return results;
    } finally {
      setIsSearching(false);
    }
  }, [fuse, categoriesMap, maxResults, addToHistory]);

  return {
    search,
    isSearching,
    searchHistory,
    clearHistory,
  };
}
