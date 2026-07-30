import prisma from '@/lib/prisma'
import { isFamilyTicketsEnabled } from '@/lib/utils/ticket-family'

export type TicketRequestFamily = {
  id: string
  name: string
  code: string
  color: string | null
  icon: string | null
  description: string | null
  isActive: boolean
  isOwnFamily: boolean
  isRestricted: boolean
  ticketFamilyConfig: {
    ticketsEnabled: boolean
    allowedFromFamilies: string[]
  } | null
}

/**
 * Lista familias activas habilitadas para solicitar tickets.
 * `familyIds` undefined = todas las activas (p. ej. Super Admin).
 */
export async function listTicketRequestFamilies(opts: {
  familyIds?: string[]
  userFamilyId?: string | null
}): Promise<TicketRequestFamily[]> {
  if (opts.familyIds && opts.familyIds.length === 0) return []

  const families = await prisma.families.findMany({
    where: {
      isActive: true,
      ...(opts.familyIds ? { id: { in: opts.familyIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      icon: true,
      description: true,
      isActive: true,
      ticketFamilyConfig: {
        select: { ticketsEnabled: true, allowedFromFamilies: true },
      },
    },
    orderBy: { order: 'asc' },
  })

  return families.filter(isFamilyTicketsEnabled).map(f => ({
    ...f,
    isOwnFamily: f.id === opts.userFamilyId,
    isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
  }))
}
