/** Helpers de manejo de errores compartidos por las rutas del módulo de Accesos. */

type PrismaKnownRequestErrorLike = {
  code?: string
  meta?: { target?: string | string[] }
}

/**
 * `true` si `error` es una violación de constraint único de Prisma (P2002)
 * sobre `field` (nombre de columna en la base de datos, no el nombre del
 * campo en el modelo — `meta.target` refleja el nombre de la constraint/columna).
 * Evita un `findUnique` previo (que además es una carrera) para detectar
 * colisiones esperables en columnas generadas (códigos, credenciales).
 */
export function isPrismaUniqueViolation(error: unknown, field: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as PrismaKnownRequestErrorLike
  if (e.code !== 'P2002') return false
  const target = e.meta?.target
  if (!target) return false
  const targets = Array.isArray(target) ? target : [target]
  return targets.some(t => t.includes(field))
}
