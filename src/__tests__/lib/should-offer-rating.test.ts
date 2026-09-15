/**
 * shouldOfferRating — cuándo ofrecerle al cliente calificar su ticket.
 *
 * El modal automático solo reaccionaba a una transición hacia RESOLVED,
 * nunca a CLOSED — así que un ticket cerrado directamente (p. ej. "Cerrar
 * directamente" de Super Admin, que salta RESOLVED) nunca ofrecía calificar.
 * Al extenderlo a CLOSED había que evitar el "doble modal": el flujo normal
 * (RESOLVED → el cliente califica → el servidor cierra automáticamente) NO
 * debe volver a abrir el modal justo después de que el cliente ya calificó.
 */

import { shouldOfferRating } from '@/lib/tickets/should-offer-rating'

describe('shouldOfferRating', () => {
  it('OPEN/IN_PROGRESS → RESOLVED: ofrece calificar directamente', () => {
    expect(shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'RESOLVED' })).toBe('resolved')
    expect(shouldOfferRating({ prevStatus: 'IN_PROGRESS', newStatus: 'RESOLVED' })).toBe('resolved')
  })

  it('regresión: OPEN/IN_PROGRESS → CLOSED directo (sin pasar por RESOLVED) → hay que verificar si ya calificó', () => {
    expect(shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'CLOSED' })).toBe('closed-check')
    expect(shouldOfferRating({ prevStatus: 'IN_PROGRESS', newStatus: 'CLOSED' })).toBe(
      'closed-check'
    )
  })

  it('regresión: RESOLVED → CLOSED (flujo normal tras calificar) → NO vuelve a ofrecer (evita el doble modal)', () => {
    expect(shouldOfferRating({ prevStatus: 'RESOLVED', newStatus: 'CLOSED' })).toBeNull()
  })

  it('sin cambio real de estado (eco de la propia actualización local) → no ofrece nada', () => {
    expect(shouldOfferRating({ prevStatus: 'CLOSED', newStatus: 'CLOSED' })).toBeNull()
    expect(shouldOfferRating({ prevStatus: 'RESOLVED', newStatus: 'RESOLVED' })).toBeNull()
  })

  it('tickets de PATROL (el agente no califica) → nunca ofrece, ni a RESOLVED ni a CLOSED', () => {
    expect(
      shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'RESOLVED', source: 'PATROL' })
    ).toBeNull()
    expect(
      shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'CLOSED', source: 'PATROL' })
    ).toBeNull()
  })

  it('sin prevStatus conocido (primera carga sin transición real) → no ofrece nada', () => {
    expect(shouldOfferRating({ prevStatus: null, newStatus: 'RESOLVED' })).toBeNull()
  })

  it('openRatingIfResolved: false desactiva por completo el ofrecimiento', () => {
    expect(
      shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'RESOLVED', openRatingIfResolved: false })
    ).toBeNull()
    expect(
      shouldOfferRating({ prevStatus: 'OPEN', newStatus: 'CLOSED', openRatingIfResolved: false })
    ).toBeNull()
  })
})
