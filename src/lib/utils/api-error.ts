/**
 * Extrae el mensaje de error más específico de una respuesta de API.
 * Soporta los formatos usados en este proyecto:
 *   { error: string }
 *   { message: string }
 *   { error: string, details: [{path, message}] }  ← errores Zod
 *   { errors: [{field, message}] }                  ← errores de validación
 */
export function extractApiError(result: any, fallback = 'Ocurrió un error inesperado'): string {
  if (!result) return fallback

  // Detalles Zod — el más específico
  if (result.details && Array.isArray(result.details) && result.details.length > 0) {
    const first = result.details[0]
    const field = first.path?.[0] ? `${first.path[0]}: ` : ''
    return `${field}${first.message}`
  }

  // Array de errores de validación
  if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
    const first = result.errors[0]
    if (typeof first === 'string') return first
    const field = first.field ? `${first.field}: ` : ''
    return `${field}${first.message || fallback}`
  }

  // Mensaje directo
  if (typeof result.error === 'string' && result.error) return result.error
  if (typeof result.message === 'string' && result.message) return result.message

  return fallback
}

/**
 * Extrae el mensaje de error de una excepción capturada en catch.
 */
export function extractCatchError(err: unknown, fallback = 'No se pudo conectar con el servidor'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return fallback
}
