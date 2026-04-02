/**
 * authFetch — wrapper de fetch que cancela silenciosamente si no hay sesión.
 *
 * Uso: reemplaza `fetch(url)` por `authFetch(url)` en hooks y componentes.
 * Si la sesión no está activa (status !== 'authenticated'), no hace el request
 * y retorna null en lugar de disparar un 401/403 en consola.
 *
 * Para uso fuera de componentes React (sin acceso a useSession), usa
 * `safeFetch` que simplemente ignora 401/403 sin lanzar error.
 */

/**
 * safeFetch — fetch que no lanza error en 401/403.
 * Útil para pollings donde la sesión puede expirar entre requests.
 * Retorna null si la respuesta es 401 o 403.
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  try {
    const res = await fetch(input, init)
    if (res.status === 401 || res.status === 403) return null
    return res
  } catch {
    return null
  }
}
