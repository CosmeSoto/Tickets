/**
 * Decide si, ante una transición de estado de ticket, corresponde ofrecerle
 * calificar al cliente que lo creó.
 *
 * - RESOLVED es siempre ofrecible directamente: un ticket resuelto nunca
 *   puede tener ya una calificación (calificar es justamente lo que dispara
 *   su cierre automático), así que no hace falta verificar nada más.
 * - CLOSED es ambiguo: es tanto el estado normal tras calificar (RESOLVED →
 *   califica → CLOSED) como el resultado de un cierre directo sin pasar por
 *   RESOLVED (p. ej. "Cerrar directamente" de Super Admin, o un cambio de
 *   estado que salta RESOLVED). Por eso se distingue con 'closed-check':
 *   el llamador debe confirmar que no exista ya una calificación antes de
 *   ofrecerla — nunca se asume directamente como con RESOLVED.
 */
export type RatingOffer = 'resolved' | 'closed-check' | null

export interface ShouldOfferRatingParams {
  /** Estado antes de esta actualización. null = primera carga sin estado previo conocido. */
  prevStatus: string | null
  newStatus: string
  source?: string | null
  /** false desactiva por completo el ofrecimiento (p. ej. actualizaciones que no deben disparar el modal). */
  openRatingIfResolved?: boolean
}

export function shouldOfferRating({
  prevStatus,
  newStatus,
  source,
  openRatingIfResolved,
}: ShouldOfferRatingParams): RatingOffer {
  if (openRatingIfResolved === false || !prevStatus || source === 'PATROL') {
    return null
  }

  if (prevStatus !== 'RESOLVED' && newStatus === 'RESOLVED') {
    return 'resolved'
  }

  if (prevStatus !== newStatus && prevStatus !== 'RESOLVED' && newStatus === 'CLOSED') {
    return 'closed-check'
  }

  return null
}
