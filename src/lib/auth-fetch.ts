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

const RETRYABLE_MAX_ATTEMPTS = 3 // intento inicial + 2 reintentos
const RETRYABLE_BASE_DELAY_MS = 400

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Reintenta solo fallos de RED (fetch() rechazado: conexión cortada, DNS,
 * TLS) — nunca ante una respuesta HTTP real (4xx/5xx), que ya llegó al
 * servidor y no se arregla reintentando. Con backoff simple (400ms, 800ms).
 *
 * Motivo: en una carga con muchas peticiones en paralelo (prefetch de rutas
 * de Next.js + llamadas de datos) sobre una red débil, alguna conexión
 * puede cortarse a medio camino sin que el servidor llegue a responder — el
 * navegador lo reporta como "Failed to fetch" aunque el backend esté sano.
 * Sin esto, un solo hipo de conexión bastaba para mostrarle al usuario un
 * error de servidor que en realidad nunca ocurrió.
 */
async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < RETRYABLE_MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init)
    } catch (err) {
      lastError = err
      if (attempt < RETRYABLE_MAX_ATTEMPTS - 1) {
        await wait(RETRYABLE_BASE_DELAY_MS * (attempt + 1))
      }
    }
  }
  throw lastError
}

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

  // Reintento solo para GET/HEAD: son idempotentes, seguros de repetir.
  const isIdempotent = method === 'GET' || method === 'HEAD'
  const promise = (isIdempotent ? fetchWithRetry(input, init) : fetch(input, init)).finally(() => {
    setTimeout(() => inFlightGets.delete(key), 100)
  })
  inFlightGets.set(key, promise)
  return promise
}
