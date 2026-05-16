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
  if (canManageInventory) {
    const invFamilies = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: {
        family: { select: { id: true, name: true, code: true, color: true, icon: true } },
      },
    })
    const enriched = await enrichFamiliesWithModules(invFamilies.map(a => a.family))
    stats.inventoryFamilies = enriched
    stats.assignedFamilies = enriched
  } else {
    const [userDept, clientAssignments] = await Promise.all([
      prisma.users.findUnique({
        where: { id: userId },
        select: {
          departments: {
            select: {
              familyId: true,
              family: { select: { id: true, name: true, code: true, color: true, icon: true } },
            },
          },
        },
      }),
      prisma.client_family_assignments.findMany({
        where: { clientId: userId, isActive: true },
        select: {
          family: { select: { id: true, name: true, code: true, color: true, icon: true } },
        },
      }),
    ])
    const familyMap = new Map<string, any>()
    if (userDept?.departments?.family) {
      const f = userDept.departments.family
      familyMap.set(f.id, f)
    }
    for (const a of clientAssignments) {
      if (a.family) familyMap.set(a.family.id, a.family)
    }
    stats.assignedFamilies = await enrichFamiliesWithModules(Array.from(familyMap.values()))
  }

  return stats
}
