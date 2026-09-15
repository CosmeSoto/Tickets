/**
 * Consolidación de labels/colores de prioridad.
 *
 * Había ~7-8 definiciones independientes de labels/colores de prioridad
 * repartidas en lib/constants, lib/utils, hooks y componentes — algunas
 * coincidían por casualidad (mismo contenido, copiado a mano en cada lugar),
 * otras divergían de verdad (paleta verde/amarillo/naranja/rojo en
 * ticket-utils.ts y create-ticket-form.tsx, distinta del gris/azul/naranja/
 * rojo que ya usa PriorityBadge en el resto de la UI). Este test fija que
 * los puntos ya migrados siguen derivando de la única fuente de verdad
 * (src/lib/constants/ticket-labels.ts) en vez de volver a divergir.
 */

import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLORS } from '@/lib/constants/ticket-labels'
import { PRIORITY_OPTIONS } from '@/lib/constants/filter-options'
import { getPriorityColor, getPriorityLabel } from '@/lib/utils/ticket-utils'
import { TICKET_PRIORITIES } from '@/hooks/use-ticket-data'

describe('Labels/colores de prioridad — consolidados en una sola fuente', () => {
  it('filter-options.ts: PRIORITY_OPTIONS usa las mismas etiquetas que TICKET_PRIORITY_LABELS', () => {
    for (const [value, label] of Object.entries(TICKET_PRIORITY_LABELS)) {
      const option = PRIORITY_OPTIONS.find(o => o.value === value)
      expect(option?.label).toBe(label)
    }
  })

  it('ticket-utils.ts: getPriorityLabel delega en TICKET_PRIORITY_LABELS', () => {
    for (const [value, label] of Object.entries(TICKET_PRIORITY_LABELS)) {
      expect(getPriorityLabel(value)).toBe(label)
    }
  })

  it('ticket-utils.ts: getPriorityColor usa la misma paleta que TICKET_PRIORITY_COLORS (con borde agregado)', () => {
    for (const [value, color] of Object.entries(TICKET_PRIORITY_COLORS)) {
      expect(getPriorityColor(value)).toContain(color)
    }
  })

  it('use-ticket-data.ts: TICKET_PRIORITIES usa las mismas etiquetas y colores que la fuente canónica', () => {
    for (const entry of TICKET_PRIORITIES) {
      expect(entry.label).toBe(TICKET_PRIORITY_LABELS[entry.value])
      expect(entry.color).toBe(TICKET_PRIORITY_COLORS[entry.value])
    }
  })
})
