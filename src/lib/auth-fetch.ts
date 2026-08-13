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
 * safeFetch — fetch que no lanza error en 401/403/429.
 * Retorna null si la sesión expiró, no hay permiso o hay rate limit.
 */
export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response | null> {
  try {
    const res = await fetch(input, init)
    if (res.status === 401 || res.status === 403 || res.status === 429) return null
    return res
  } catch {
    return null
  }
}

const inFlightGets = new Map<string, Promise<Response>>()

/** Evita N peticiones GET idénticas simultáneas (p. ej. varios hooks al montar). */
export async function dedupedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString()
  const method = init?.method ?? 'GET'
  const key = `${method}:${url}`

  const existing = inFlightGets.get(key)
  if (existing) return existing

  const promise = fetch(input, init).finally(() => {
    setTimeout(() => inFlightGets.delete(key), 100)
  })
  inFlightGets.set(key, promise)
  return promise
}
