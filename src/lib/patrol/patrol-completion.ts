/**
 * Utilidades de cálculo de completitud de patrullas.
 * Funciones puras sin dependencias externas — aptas para property-based testing.
 */

/**
 * Calcula el porcentaje de completitud de una patrulla.
 *
 * @param visited - Número de checkpoints requeridos visitados (puede exceder total; se recorta)
 * @param total   - Número total de checkpoints requeridos en la ruta
 * @returns Entero en [0, 100]. Retorna 0 cuando total es 0.
 */
export function calculateCompletionPercentage(visited: number, total: number): number {
  if (total <= 0) return 0
  const clamped = Math.min(visited, total)
  return Math.round((clamped / total) * 100)
}
