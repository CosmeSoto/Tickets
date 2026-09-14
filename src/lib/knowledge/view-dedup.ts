/**
 * Dedup de vistas de artículos de la base de conocimiento — compartido entre
 * `GET /api/knowledge/[id]` (auto-incrementa al abrir el artículo) y
 * `POST /api/knowledge-articles/[id]/view` (incremento explícito desde el
 * modal de artículos sugeridos). Ambas rutas leen/escriben el MISMO estado
 * en memoria, así que un usuario que ve el mismo artículo por los dos
 * caminos dentro de la ventana sigue contando como una sola vista.
 *
 * Se cuenta como máximo una vista por usuario+artículo cada 30 minutos, sin
 * importar cuántas veces se dispare la ruta en ese lapso (refetch de sesión,
 * pestañas duplicadas, ida y vuelta con el botón atrás, etc.).
 */

const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000
const recentArticleViews = new Map<string, number>() // `${userId}:${articleId}` -> timestamp

export function shouldCountArticleView(userId: string, articleId: string): boolean {
  const key = `${userId}:${articleId}`
  const now = Date.now()
  const last = recentArticleViews.get(key)
  if (last && now - last < VIEW_DEDUP_WINDOW_MS) return false
  recentArticleViews.set(key, now)
  return true
}

// Limpieza periódica para no acumular memoria indefinidamente
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, ts] of recentArticleViews.entries()) {
        if (now - ts > VIEW_DEDUP_WINDOW_MS) recentArticleViews.delete(key)
      }
    },
    10 * 60 * 1000
  )
}
