/**
 * resolveInitialPriority — tope automático de prioridad por categoría.
 *
 * Antes de esto, cualquier creador de ticket (sin importar su rol) podía
 * elegir "Urgente" libremente y esa elección se convertía directo en la
 * prioridad operativa, saltándose la cola/SLA real sin ningún control. Ahora
 * un CLIENT queda topado por `categories.priorityCeiling` (configurado una
 * sola vez por categoría, no por ticket); ADMIN/TECHNICIAN no tienen tope
 * porque ya tienen autoridad para fijar la prioridad real.
 */

import { resolveInitialPriority, DEFAULT_PRIORITY_CEILING } from '@/lib/tickets/priority-triage'

describe('resolveInitialPriority', () => {
  it('CLIENT pidiendo por encima del techo de la categoría → se recorta al techo, y queda registrado lo pedido', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', 'MEDIUM')

    expect(result.priority).toBe('MEDIUM')
    expect(result.requestedPriority).toBe('URGENT')
  })

  it('CLIENT pidiendo HIGH con techo MEDIUM → también se recorta', () => {
    const result = resolveInitialPriority('CLIENT', 'HIGH', 'MEDIUM')

    expect(result.priority).toBe('MEDIUM')
    expect(result.requestedPriority).toBe('HIGH')
  })

  it('CLIENT pidiendo por debajo o igual al techo → se respeta tal cual, sin requestedPriority', () => {
    expect(resolveInitialPriority('CLIENT', 'LOW', 'MEDIUM')).toEqual({ priority: 'LOW' })
    expect(resolveInitialPriority('CLIENT', 'MEDIUM', 'MEDIUM')).toEqual({ priority: 'MEDIUM' })
  })

  it('CLIENT en una categoría con techo URGENT → puede llegar a URGENT sin recorte', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', 'URGENT')

    expect(result).toEqual({ priority: 'URGENT' })
  })

  it('categoría sin techo configurado (null) → usa MEDIUM como techo por defecto', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', null)

    expect(result.priority).toBe(DEFAULT_PRIORITY_CEILING)
    expect(result.requestedPriority).toBe('URGENT')
  })

  it('ADMIN creando un ticket → sin tope, la prioridad pedida se respeta tal cual', () => {
    const result = resolveInitialPriority('ADMIN', 'URGENT', 'LOW')

    expect(result).toEqual({ priority: 'URGENT' })
  })

  it('TECHNICIAN creando un ticket → sin tope', () => {
    const result = resolveInitialPriority('TECHNICIAN', 'HIGH', 'LOW')

    expect(result).toEqual({ priority: 'HIGH' })
  })

  it('categoría sin techo propio → se cae al techo de la familia', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', null, 'HIGH')

    expect(result).toEqual({ priority: 'HIGH', requestedPriority: 'URGENT' })
  })

  it('categoría con techo propio → ignora el techo de la familia (la categoría manda)', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', 'LOW', 'URGENT')

    expect(result).toEqual({ priority: 'LOW', requestedPriority: 'URGENT' })
  })

  it('sin techo de categoría NI de familia → usa MEDIUM por defecto', () => {
    const result = resolveInitialPriority('CLIENT', 'URGENT', null, null)

    expect(result.priority).toBe(DEFAULT_PRIORITY_CEILING)
  })
})
