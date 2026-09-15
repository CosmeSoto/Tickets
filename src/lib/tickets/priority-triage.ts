import { TicketPriority } from '@prisma/client'

const PRIORITY_RANK: Record<TicketPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
}

/** Techo aplicado cuando la categoría nunca configuró uno explícito (categories.priorityCeiling = null). */
export const DEFAULT_PRIORITY_CEILING: TicketPriority = 'MEDIUM'

export interface ResolvedPriority {
  /** Prioridad operativa final: la que realmente maneja el SLA y la cola. */
  priority: TicketPriority
  /**
   * Lo que el creador pidió, tal cual, antes de aplicar el techo — solo se
   * incluye cuando difiere de `priority` (si coinciden no hay nada que
   * registrar). Se guarda en tickets.requestedPriority, informativo.
   */
  requestedPriority?: TicketPriority
}

/**
 * Decide la prioridad operativa de un ticket nuevo.
 *
 * El creador siempre puede elegir cualquiera de las 4 prioridades (no se le
 * oculta ninguna opción en el formulario), pero cuando quien crea el ticket
 * es un CLIENT, la prioridad operativa queda topada por
 * `categoryPriorityCeiling` — configurable una sola vez por categoría
 * (`categories.priorityCeiling`), no por ticket. Así un cliente no obtiene
 * ningún beneficio de cola/SLA por marcar "Urgente" en una categoría que no
 * lo amerita, sin que ningún admin tenga que revisar el ticket a mano; y una
 * categoría genuinamente crítica (techo en URGENT) deja pasar la elección
 * del cliente sin ningún recorte.
 *
 * Si la categoría no tiene techo propio configurado, se cae al techo de la
 * familia (`ticket_family_config.priorityCeiling`) antes de usar el default
 * global — mismo criterio jerárquico categoría → familia → global que ya
 * usa `sla_policies` para los tiempos de SLA.
 *
 * Un ADMIN o TECHNICIAN creando un ticket (incluido "en nombre de un
 * cliente") ya tiene autoridad para fijar la prioridad real directamente:
 * no se le aplica ningún tope.
 */
export function resolveInitialPriority(
  creatorRole: string,
  requestedPriority: TicketPriority,
  categoryPriorityCeiling: TicketPriority | null | undefined,
  familyPriorityCeiling?: TicketPriority | null
): ResolvedPriority {
  if (creatorRole !== 'CLIENT') {
    return { priority: requestedPriority }
  }

  const ceiling = categoryPriorityCeiling ?? familyPriorityCeiling ?? DEFAULT_PRIORITY_CEILING

  if (PRIORITY_RANK[requestedPriority] <= PRIORITY_RANK[ceiling]) {
    return { priority: requestedPriority }
  }

  return { priority: ceiling, requestedPriority }
}
