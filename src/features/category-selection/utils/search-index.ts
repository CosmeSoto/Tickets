/**
 * Utilidades para construir el índice de búsqueda de categorías
 */

import type { Category, CategorySearchIndex } from '../types';
import { normalizeText, extractKeywords } from '../config/fuse.config';

/**
 * Construye el path completo de una categoría
 */
export function buildCategoryPath(
  category: Category,
  categoriesMap: Map<string, Category>
): Category[] {
  const path: Category[] = [];
  let current: Category | undefined = category;

  while (current) {
    path.unshift(current);
    current = current.parentId ? categoriesMap.get(current.parentId) : undefined;
  }

  return path;
}

/**
 * Construye el índice de búsqueda a partir de las categorías
 */
export function buildSearchIndex(categories: Category[]): CategorySearchIndex[] {
  // Crear mapa para acceso rápido
  const categoriesMap = new Map<string, Category>(
    categories.map(cat => [cat.id, cat])
  );

  return categories.map(category => {
    const path = buildCategoryPath(category, categoriesMap);
    const pathNames = path.map(c => c.name).join(' > ');
    const pathIds = path.map(c => c.id);

    // Construir texto buscable
    const searchableText = [
      category.name,
      category.description || '',
      pathNames,
    ].join(' ');

    // Extraer palabras clave
    const keywords = extractKeywords(searchableText);

    return {
      id: category.id,
      name: category.name,
      description: category.description || '',
      level: category.level,
      parentId: category.parentId,
      path: pathNames,
      pathIds,
      keywords,
      searchableText: normalizeText(searchableText),
      color: category.color,
    };
  });
}

/**
 * Filtra solo categorías activas
 */
export function filterActiveCategories(categories: Category[]): Category[] {
  return categories.filter(cat => cat.isActive);
}
