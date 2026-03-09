/**
 * Hook para sugerencias contextuales de categorías basadas en análisis de texto
 * 
 * Analiza el título y descripción del ticket para sugerir categorías relevantes
 * usando análisis de palabras clave con stop words en español.
 * 
 * @module useCategorySuggestions
 * 
 * @description
 * Este hook implementa un motor de sugerencias que analiza el contenido del ticket
 * y sugiere las categorías más relevantes. Características:
 * 
 * - Extracción de palabras clave con filtrado de stop words en español
 * - Normalización de texto (sin acentos, lowercase)
 * - Matching de keywords con categorías
 * - Scoring de relevancia basado en coincidencias
 * - Debounce configurable para evitar análisis excesivos
 * - Generación de razones explicativas para cada sugerencia
 * 
 * @example
 * ```tsx
 * const { suggestions, isAnalyzing } = useCategorySuggestions({
 *   categories: allCategories,
 *   title: 'No puedo imprimir documentos',
 *   description: 'La impresora no responde cuando envío trabajos',
 *   debounceMs: 500
 * });
 * 
 * // Mostrar sugerencias
 * suggestions.forEach(suggestion => {
 *   console.log(suggestion.category.name);
 *   console.log('Relevancia:', suggestion.relevanceScore);
 *   console.log('Razón:', suggestion.reason);
 * });
 * ```
 * 
 * @remarks
 * - El análisis se ejecuta automáticamente cuando cambia el título o descripción
 * - Se aplica debounce para evitar análisis mientras el usuario escribe
 * - Las sugerencias se ordenan por relevancia descendente
 * - Si no hay texto suficiente (< 3 caracteres), no se generan sugerencias
 * 
 * Requisitos implementados: 2.1, 2.2, 2.3, 2.6
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Category, Suggestion, CategorySearchIndex } from '../types';
import { normalizeText, extractKeywords } from '../config/fuse.config';
import { buildSearchIndex, buildCategoryPath } from '../utils/search-index';

/**
 * Opciones de configuración para useCategorySuggestions
 * 
 * @property {Category[]} categories - Array de todas las categorías disponibles
 * @property {string} title - Título del ticket a analizar
 * @property {string} description - Descripción del ticket a analizar
 * @property {number} [debounceMs=500] - Tiempo de debounce en milisegundos antes de analizar
 * @property {number} [maxSuggestions=5] - Número máximo de sugerencias a retornar
 */
export interface UseCategorySuggestionsOptions {
  categories: Category[];
  title: string;
  description: string;
  debounceMs?: number;
  maxSuggestions?: number;
}

/**
 * Valor de retorno del hook useCategorySuggestions
 * 
 * @property {Suggestion[]} suggestions - Array de sugerencias ordenadas por relevancia
 * @property {boolean} isAnalyzing - Indica si hay un análisis en progreso
 * @property {function} refresh - Función para forzar re-análisis de sugerencias
 */
export interface UseCategorySuggestionsReturn {
  suggestions: Suggestion[];
  isAnalyzing: boolean;
  refresh: () => void;
}

/**
 * Hook para sugerencias contextuales de categorías
 * 
 * @param {UseCategorySuggestionsOptions} options - Opciones de configuración
 * @returns {UseCategorySuggestionsReturn} Objeto con sugerencias, estado de análisis y función refresh
 * 
 * @example
 * ```tsx
 * const { suggestions, isAnalyzing } = useCategorySuggestions({
 *   categories: allCategories,
 *   title: 'No puedo imprimir documentos',
 *   description: 'La impresora no responde cuando envío trabajos',
 *   debounceMs: 500
 * });
 * ```
 */
export function useCategorySuggestions({
  categories,
  title,
  description,
  debounceMs = 500,
  maxSuggestions = 5,
}: UseCategorySuggestionsOptions): UseCategorySuggestionsReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

  // Función para calcular relevancia entre keywords del texto y de una categoría
  const calculateRelevance = useCallback((
    textKeywords: string[],
    categoryIndex: CategorySearchIndex
  ): { score: number; matchedKeywords: string[] } => {
    const categoryKeywords = categoryIndex.keywords;
    const matchedKeywords: string[] = [];
    let matchCount = 0;

    // Contar coincidencias exactas y parciales
    for (const textKeyword of textKeywords) {
      for (const categoryKeyword of categoryKeywords) {
        if (textKeyword === categoryKeyword) {
          // Coincidencia exacta
          matchedKeywords.push(textKeyword);
          matchCount++;
        } else if (textKeyword.length >= 4 && categoryKeyword.length >= 4) {
          // Para palabras de 4+ caracteres, buscar coincidencias parciales
          const minLength = Math.min(textKeyword.length, categoryKeyword.length);
          const maxLength = Math.max(textKeyword.length, categoryKeyword.length);
          
          // Calcular prefijo común
          let commonPrefixLength = 0;
          for (let i = 0; i < minLength; i++) {
            if (textKeyword[i] === categoryKeyword[i]) {
              commonPrefixLength++;
            } else {
              break;
            }
          }
          
          // Si comparten al menos 4 caracteres al inicio, es una coincidencia parcial
          if (commonPrefixLength >= 4) {
            matchedKeywords.push(textKeyword);
            matchCount += 0.7; // Alta confianza en prefijos comunes
          } else if (
            textKeyword.includes(categoryKeyword) || 
            categoryKeyword.includes(textKeyword)
          ) {
            // Coincidencia por substring
            matchedKeywords.push(textKeyword);
            matchCount += 0.5;
          }
        }
      }
    }

    // Calcular score normalizado (0-1)
    const maxPossibleMatches = Math.max(textKeywords.length, categoryKeywords.length);
    const score = maxPossibleMatches > 0 ? matchCount / maxPossibleMatches : 0;

    return { score, matchedKeywords: [...new Set(matchedKeywords)] };
  }, []);

  // Función para generar razón de sugerencia
  const generateReason = useCallback((
    matchedKeywords: string[],
    score: number
  ): string => {
    if (matchedKeywords.length === 0) {
      return 'Categoría relacionada con tu consulta';
    }

    if (matchedKeywords.length === 1) {
      return `Coincide con: "${matchedKeywords[0]}"`;
    }

    if (matchedKeywords.length <= 3) {
      return `Coincide con: ${matchedKeywords.map(k => `"${k}"`).join(', ')}`;
    }

    return `Alta coincidencia (${matchedKeywords.length} palabras clave)`;
  }, []);

  // Función para analizar texto y generar sugerencias
  const analyzeSuggestions = useCallback(() => {
    setIsAnalyzing(true);

    try {
      // Combinar título y descripción
      const combinedText = `${title} ${description}`.trim();

      // Si no hay texto suficiente, no sugerir nada
      if (combinedText.length < 3) {
        setSuggestions([]);
        return;
      }

      // Extraer palabras clave del texto
      const textKeywords = extractKeywords(combinedText);

      // Si no hay keywords significativas, no sugerir nada
      if (textKeywords.length === 0) {
        setSuggestions([]);
        return;
      }

      // Calcular relevancia para cada categoría
      const scoredCategories = searchIndex
        .map(categoryIndex => {
          const { score, matchedKeywords } = calculateRelevance(textKeywords, categoryIndex);
          return {
            categoryIndex,
            score,
            matchedKeywords,
          };
        })
        .filter(item => item.score > 0) // Solo categorías con alguna coincidencia
        .sort((a, b) => b.score - a.score) // Ordenar por relevancia descendente
        .slice(0, maxSuggestions); // Limitar a máximo de sugerencias

      // Construir sugerencias
      const newSuggestions: Suggestion[] = scoredCategories
        .map(item => {
          const category = categoriesMap.get(item.categoryIndex.id);
          if (!category) return null;

          const path = buildCategoryPath(category, categoriesMap);
          const reason = generateReason(item.matchedKeywords, item.score);

          return {
            category,
            path,
            relevanceScore: item.score,
            matchedKeywords: item.matchedKeywords,
            reason,
          };
        })
        .filter((suggestion): suggestion is Suggestion => suggestion !== null);

      setSuggestions(newSuggestions);
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    title,
    description,
    searchIndex,
    categoriesMap,
    maxSuggestions,
    calculateRelevance,
    generateReason,
  ]);

  // Función para forzar actualización
  const refresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Efecto con debounce para analizar cuando cambia el texto
  useEffect(() => {
    const timer = setTimeout(() => {
      analyzeSuggestions();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [title, description, debounceMs, analyzeSuggestions, refreshTrigger]);

  return {
    suggestions,
    isAnalyzing,
    refresh,
  };
}
