import prisma from '@/lib/prisma'
import {
  calculateAvgResolutionTime,
  calculateAvgResponseTime,
  enrichFamiliesWithModules,
} from './shared'

export async function getTechnicianStats(userId: string, canManageInventory: boolean) {
  const [
    assignedTickets,
    resolvedTickets,
    inProgressTickets,
    completedToday,
    thisWeekResolved,
    urgentTickets,
    resolvedTicketsWithTime,
    ratings,
    myPlansStats,
    avgFirstResponseTime,
  ] = await Promise.all([
    prisma.tickets.count({ where: { assigneeId: userId } }),
    prisma.tickets.count({
      where: { assigneeId: userId, status: { in: ['RESOLVED', 'CLOSED'] } },
    }),
    prisma.tickets.count({ where: { assigneeId: userId, status: 'IN_PROGRESS' } }),
    prisma.tickets.count({
      where: {
        assigneeId: userId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    prisma.tickets.count({
      where: {
        assigneeId: userId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.tickets.count({ where: { assigneeId: userId, priority: 'HIGH' } }),
    prisma.tickets.findMany({
      where: {
        assigneeId: userId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null },
      },
      orderBy: { resolvedAt: 'desc' },
      take: 500,
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.ticket_ratings.findMany({
      where: {
        tickets: { assigneeId: userId },
      },
      select: { rating: true },
    }),
    prisma.resolution_plans.aggregate({
      where: { ticket: { assigneeId: userId } },
      _count: { id: true },
      _avg: {
        estimatedHours: true,
        actualHours: true,
        completedTasks: true,
        totalTasks: true,
      },
    }),
    calculateAvgResponseTime(),
  ])

  const avgResolutionTime = calculateAvgResolutionTime(resolvedTicketsWithTime)
  const avgRating =
    ratings.length > 0 ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length : 0

  const myPlanEfficiency =
    myPlansStats._avg.estimatedHours && myPlansStats._avg.actualHours
      ? Math.round((myPlansStats._avg.estimatedHours / myPlansStats._avg.actualHours) * 100)
      : 100

  const myTaskCompletionRate =
    myPlansStats._avg.totalTasks && myPlansStats._avg.completedTasks
      ? Math.round((myPlansStats._avg.completedTasks / myPlansStats._avg.totalTasks) * 100)
      : 0

  const stats: any = {
    assignedTickets,
    resolvedTickets,
    inProgressTickets,
    completedToday,
    thisWeekResolved,
    urgentTickets,
    avgResolutionTime,
    avgFirstResponseTime,
    satisfactionScore: Math.round(avgRating * 10) / 10,
    totalRatings: ratings.length,
    ratingsBreakdown: {
      excellent: ratings.filter(r => r.rating === 5).length,
      good: ratings.filter(r => r.rating === 4).length,
      average: ratings.filter(r => r.rating === 3).length,
      poor: ratings.filter(r => r.rating <= 2).length,
    },
    performance: avgRating >= 4.5 ? 'excellent' : avgRating >= 4 ? 'good' : 'needs_improvement',
    workload: assignedTickets > 15 ? 'high' : assignedTickets > 8 ? 'medium' : 'low',
    myResolutionPlans: {
      total: myPlansStats._count.id,
      avgEstimatedHours: Math.round((myPlansStats._avg.estimatedHours || 0) * 10) / 10,
      avgActualHours: Math.round((myPlansStats._avg.actualHours || 0) * 10) / 10,
      efficiency: myPlanEfficiency,
      taskCompletionRate: myTaskCompletionRate,
    },
  }

  const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
  const familySelect = { id: true, name: true, code: true, color: true, icon: true } as const

  const ticketScopeIds = await resolveModuleFamilyScopeIds(userId, 'tickets')
  const techFamilies =
    ticketScopeIds.length > 0
      ? await prisma.families.findMany({
          where: { id: { in: ticketScopeIds }, isActive: true },
          select: familySelect,
        })
      : []
  stats.assignedFamilies = await enrichFamiliesWithModules(techFamilies)
  stats.isInventoryManager = canManageInventory

  if (canManageInventory) {
    const invScopeIds = await resolveModuleFamilyScopeIds(userId, 'inventory', 'canView')
    const invFamilies =
      invScopeIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: invScopeIds }, isActive: true },
            select: familySelect,
          })
        : []
    stats.inventoryFamilies = await enrichFamiliesWithModules(invFamilies)
  }

  return stats
}
