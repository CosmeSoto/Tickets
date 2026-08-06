import prisma from '@/lib/prisma'
import {
  calculateAvgResolutionTime,
  calculateAvgResponseTimeForClient,
  enrichFamiliesWithModules,
} from './shared'

export async function getClientStats(userId: string, canManageInventory: boolean) {
  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    thisMonthTickets,
    resolvedTicketsWithTime,
    ratingsAgg,
    assignedEquipment,
    pendingMaintenance,
    ticketsToRate,
    responseTime,
  ] = await Promise.all([
    prisma.tickets.count({ where: { clientId: userId } }),
    prisma.tickets.count({ where: { clientId: userId, status: 'OPEN' } }),
    prisma.tickets.count({ where: { clientId: userId, status: 'IN_PROGRESS' } }),
    prisma.tickets.count({
      where: { clientId: userId, status: { in: ['RESOLVED', 'CLOSED'] } },
    }),
    prisma.tickets.count({
      where: {
        clientId: userId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.tickets.findMany({
      where: {
        clientId: userId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null },
      },
      orderBy: { resolvedAt: 'desc' },
      take: 500,
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.ticket_ratings.aggregate({
      where: { tickets: { clientId: userId } },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.equipment_assignments.count({
      where: { receiverId: userId, isActive: true },
    }),
    prisma.equipment_assignments
      .findMany({
        where: { receiverId: userId, isActive: true },
        select: { equipmentId: true },
      })
      .then(async assignments => {
        if (assignments.length === 0) return 0
        return prisma.maintenance_records.count({
          where: {
            equipmentId: { in: assignments.map(a => a.equipmentId) },
            status: { in: ['REQUESTED', 'SCHEDULED', 'ACCEPTED'] },
          },
        })
      }),
    prisma.tickets.count({
      where: {
        clientId: userId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        ticket_ratings: null,
      },
    }),
    calculateAvgResponseTimeForClient(userId),
  ])

  const avgResolutionTime = calculateAvgResolutionTime(resolvedTicketsWithTime)
  const totalRatings = ratingsAgg._count.id
  const avgRating = ratingsAgg._avg.rating != null ? ratingsAgg._avg.rating : 0

  const stats: any = {
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    thisMonthTickets,
    avgResolutionTime,
    satisfactionRating: Math.round(avgRating * 10) / 10,
    totalRatings,
    ticketsToRate,
    responseTime,
    assignedEquipment,
    pendingMaintenance,
    supportQuality: avgRating >= 4.5 ? 'excellent' : avgRating >= 4 ? 'good' : 'fair',
  }

  stats.isInventoryManager = canManageInventory
  const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
  const familySelect = { id: true, name: true, code: true, color: true, icon: true } as const

  if (canManageInventory) {
    const invScopeIds = await resolveModuleFamilyScopeIds(userId, 'inventory', 'canView')
    const invFamilies =
      invScopeIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: invScopeIds }, isActive: true },
            select: familySelect,
          })
        : []
    const enriched = await enrichFamiliesWithModules(invFamilies)
    stats.inventoryFamilies = enriched
    stats.assignedFamilies = enriched
  } else {
    const ticketScopeIds = await resolveModuleFamilyScopeIds(userId, 'tickets')
    const families =
      ticketScopeIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: ticketScopeIds }, isActive: true },
            select: familySelect,
          })
        : []
    stats.assignedFamilies = await enrichFamiliesWithModules(families)
  }

  return stats
}
