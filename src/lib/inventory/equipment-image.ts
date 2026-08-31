/**
 * Resuelve la ruta pública de la foto de un equipo a partir de sus adjuntos —
 * usa el primer adjunto tipo imagen (el más antiguo) si existe; si no, cae a
 * `equipment.photoUrl` (legado).
 *
 * Compartido entre:
 * - delivery-act.service.ts: al crear el acta, para el snapshot inicial.
 * - pdf-generator.service.ts: al renderizar el PDF, para volver a resolverla
 *   con los adjuntos que existan EN ESE MOMENTO (ver comentario ahí — el acta
 *   suele crearse justo al asignar un equipo recién dado de alta, antes de
 *   que dé tiempo a subirle una foto; el PDF en cambio no se genera hasta que
 *   se acepta/firma, minutos u horas después, así que conviene mirar de nuevo
 *   los adjuntos en ese momento en vez de confiar solo en la foto que existía
 *   al crear el acta).
 */
export function resolveEquipmentImagePath(eq: {
  id: string
  photoUrl?: string | null
  attachments?: Array<{ filename: string }>
}): string | null {
  const firstAttachment = eq.attachments?.[0]
  return firstAttachment
    ? `/api/uploads/equipment/${eq.id}/${firstAttachment.filename}`
    : eq.photoUrl || null
}
