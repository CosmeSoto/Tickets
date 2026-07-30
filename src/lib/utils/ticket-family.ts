/**
 * Criterio unificado: una familia admite tickets si no tiene config
 * o si ticketsEnabled !== false. Evita listas incompletas cuando falta
 * la fila ticket_family_config (mismo criterio que module=tickets).
 */

export function isFamilyTicketsEnabled(
  family:
    | {
        ticketFamilyConfig?: { ticketsEnabled?: boolean | null } | null
      }
    | null
    | undefined
): boolean {
  if (!family?.ticketFamilyConfig) return true
  return family.ticketFamilyConfig.ticketsEnabled !== false
}

/** URL para familias donde se puede solicitar/crear tickets (scope consumer). */
export function ticketRequestFamiliesUrl(opts?: { forClientId?: string | null }): string {
  const params = new URLSearchParams({ asClient: 'true' })
  if (opts?.forClientId) params.set('forClientId', opts.forClientId)
  return `/api/families?${params.toString()}`
}
