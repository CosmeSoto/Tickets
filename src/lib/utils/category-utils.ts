/**
 * Utilidades para categorías
 */

export interface CategoryWithLevelName {
  id: string
  name: string
  level: number
  levelName: string
  color: string
  [key: string]: any
}

/**
 * Obtiene el nombre del nivel basado en el número
 */
export function getLevelName(level: number): string {
  switch (level) {
    case 1: return 'Principal'
    case 2: return 'Subcategoría'
    case 3: return 'Especialidad'
    case 4: return 'Detalle'
    default: return 'Máximo'
  }
}

/**
 * Enriquece una categoría con levelName
 */
export function enrichCategory<T extends { level: number }>(category: T): T & { levelName: string } {
  return {
    ...category,
    levelName: getLevelName(category.level)
  }
}

/**
 * Enriquece un array de categorías con levelName
 */
export function enrichCategories<T extends { level: number }>(categories: T[]): (T & { levelName: string })[] {
  return categories.map(enrichCategory)
}

/**
 * Valida que una categoría tenga levelName, si no lo agrega
 */
export function ensureLevelName<T extends { level: number }>(category: T): T & { levelName: string } {
  if ('levelName' in category && category.levelName) {
    return category as T & { levelName: string }
  }
  return enrichCategory(category)
}

/**
 * Valida que un array de categorías tengan levelName, si no lo agrega
 */
export function ensureLevelNames<T extends { level: number }>(categories: T[]): (T & { levelName: string })[] {
  return categories.map(ensureLevelName)
}