/**
 * Reescribe una URL de adjunto servida por `/uploads/...` a su equivalente
 * autenticado `/api/uploads/...` (`src/app/api/uploads/[...path]/route.ts`).
 *
 * nginx dejó de servir `/uploads/` directamente (ver `docker/nginx.conf`):
 * ese árbol contenía TODOS los adjuntos del sistema (noticias, tickets,
 * equipos, fichas de acceso, contratos, fotos de rondas) servidos como
 * estáticos, sin sesión ni chequeo de visibilidad — bypasseando por
 * completo la autorización de las rutas API que sí la validan. Los pocos
 * consumidores que construían la URL `/uploads/...` a mano deben pasar por
 * este helper (ya usado por `use-landing-data.ts`/`email-branding.ts` para
 * logos, replicado aquí para el resto).
 */
export function toPublicUploadUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/uploads/')) return url.replace('/uploads/', '/api/uploads/')
  return url
}
