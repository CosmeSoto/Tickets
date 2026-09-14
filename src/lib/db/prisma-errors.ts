/** Helpers de manejo de errores de Prisma compartidos entre módulos. */

type PrismaKnownRequestErrorLike = {
  code?: string
  meta?: { target?: string | string[] }
}

/**
 * `true` si `error` es una violación de constraint único de Prisma (P2002).
 * Sin `field`, cualquier P2002 cuenta — útil para un `upsert` que puede
 * chocar contra dos `create` concurrentes ganando la misma fila. Con
 * `field` (nombre de columna en la base de datos, no el nombre del campo en
 * el modelo — `meta.target` refleja el nombre de la constraint/columna), se
 * exige que la violación sea justo sobre esa columna. Evita un `findUnique`
 * previo (que además es una carrera) para detectar colisiones esperables en
 * columnas generadas (códigos, credenciales) o en un `@@unique` compuesto.
 */
export function isPrismaUniqueViolation(error: unknown, field?: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as PrismaKnownRequestErrorLike
  if (e.code !== 'P2002') return false
  if (!field) return true
  const target = e.meta?.target
  if (!target) return false
  const targets = Array.isArray(target) ? target : [target]
  return targets.some(t => t.includes(field))
}

/**
 * `true` si `error` es una violación de foreign key de Prisma (P2003) — por
 * ejemplo, borrar una fila que todavía tiene hijos con una relación
 * requerida. Útil para convertir un TOCTOU de "contar hijos, luego borrar"
 * (una fila colada entre el conteo y el delete) en una respuesta 400
 * controlada en vez de un 500 sin manejar: la FK real de la base de datos ya
 * impide la corrupción de datos, esto solo evita que la carrera se filtre
 * como un error genérico.
 */
export function isPrismaForeignKeyViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as PrismaKnownRequestErrorLike).code === 'P2003'
}
