/**
 * Configuración de Fuse.js para búsqueda fuzzy de categorías
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { CategorySearchIndex } from '../types';

/**
 * Opciones de configuración para Fuse.js
 * 
 * - threshold: 0.3 = permite coincidencias con hasta 30% de diferencia
 * - distance: 100 = máxima distancia entre caracteres coincidentes
 * - minMatchCharLength: 2 = mínimo 2 caracteres para considerar coincidencia
 * - includeScore: true = incluye score de relevancia en resultados
 * - includeMatches: true = incluye información de qué campos coincidieron
 */
export const fuseOptions: IFuseOptions<CategorySearchIndex> = {
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
  includeMatches: true,
  ignoreLocation: true,
  keys: [
    {
      name: 'name',
      weight: 0.5, // Mayor peso para el nombre
    },
    {
      name: 'description',
      weight: 0.3,
    },
    {
      name: 'keywords',
      weight: 0.2,
    },
    {
      name: 'searchableText',
      weight: 0.1,
    },
  ],
};

/**
 * Normaliza texto para búsqueda (sin acentos, minúsculas)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Elimina acentos
}

/**
 * Extrae palabras clave de un texto
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para',
    'y', 'o', 'pero', 'si', 'no', 'que', 'como', 'cuando',
  ]);

  return normalizeText(text)
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}
