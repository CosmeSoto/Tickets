import prisma from '@/lib/prisma'
import {
  calculateAvgResolutionTime,
  calculateAvgResponseTime,
  getRecentActivity,
  getFamilyMetrics,
  getProactiveAlerts,
  enrichFamiliesWithModules,
} from './shared'

export async function getAdminStats(userId: string, isSuperAdmin: boolean) {
  const now = new Date()

  // Scope de familias para Admin Normal (tickets)
  let ticketFamilyFilter: Record<string, any> = {}
  if (!isSuperAdmin) {
    const { getUserFamilyScope, buildFamilyFilter } = await import('@/lib/auth/admin-scope')
    const scope = await getUserFamilyScope(userId, 'ADMIN', false)
    ticketFamilyFilter = buildFamilyFilter(scope)
  }

  const [
    totalUsers,
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    urgentTickets,
    overdueTickets,
    todayTickets,
    thisWeekTickets,
    resolvedTicketsWithTime,
    plansStats,
    avgFirstResponseTime,
  ] = await Promise.all([
    prisma.users.count(),
    prisma.tickets.count({ where: ticketFamilyFilter }),
    prisma.tickets.count({ where: { status: 'OPEN', ...ticketFamilyFilter } }),
    prisma.tickets.count({ where: { status: 'IN_PROGRESS', ...ticketFamilyFilter } }),
    prisma.tickets.count({ where: { status: 'RESOLVED', ...ticketFamilyFilter } }),
    prisma.tickets.count({ where: { status: 'CLOSED', ...ticketFamilyFilter } }),
    prisma.tickets.count({
      where: {
        priority: 'HIGH',
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        ...ticketFamilyFilter,
      },
    }),
    prisma.tickets.count({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        ...ticketFamilyFilter,
        OR: [
          {
            priority: 'HIGH',
            createdAt: { lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
          },
          {
            priority: 'MEDIUM',
            createdAt: { lt: new Date(now.getTime() - 8 * 60 * 60 * 1000) },
          },
          {
            priority: 'LOW',
            createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        ],
      },
    }),
    prisma.tickets.count({
      where: {
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        ...ticketFamilyFilter,
      },
    }),
    prisma.tickets.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ...ticketFamilyFilter,
      },
    }),
    prisma.tickets.findMany({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null },
        ...ticketFamilyFilter,
      },
      orderBy: { resolvedAt: 'desc' },
      take: 500,
      select: { createdAt: true, resolvedAt: true },
    }),
    prisma.resolution_plans.aggregate({
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
  const resolutionRate =
    totalTickets > 0 ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100) : 0

  const planEfficiency =
    plansStats._avg.estimatedHours && plansStats._avg.actualHours
      ? Math.round((plansStats._avg.estimatedHours / plansStats._avg.actualHours) * 100)
      : 100

  const taskCompletionRate =
    plansStats._avg.totalTasks && plansStats._avg.completedTasks
      ? Math.round((plansStats._avg.completedTasks / plansStats._avg.totalTasks) * 100)
      : 0

  const stats: any = {
    totalUsers,
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    closedTickets,
    urgentTickets,
    overdueTickets,
    todayTickets,
    thisWeekTickets,
    avgResolutionTime,
    avgFirstResponseTime,
    resolutionRate,
    activeTickets: openTickets + inProgressTickets,
    systemHealth:
      resolutionRate >= 85 ? 'excellent' : resolutionRate >= 70 ? 'good' : 'needs_attention',
    resolutionPlans: {
      total: plansStats._count.id,
      avgEstimatedHours: Math.round((plansStats._avg.estimatedHours || 0) * 10) / 10,
      avgActualHours: Math.round((plansStats._avg.actualHours || 0) * 10) / 10,
      efficiency: planEfficiency,
      taskCompletionRate,
    },
    ...(await (async () => {
      const [recentActivity, familyMetrics, proactiveAlerts] = await Promise.all([
        getRecentActivity('ADMIN', userId),
        getFamilyMetrics(),
        getProactiveAlerts(),
      ])
      return { recentActivity, familyMetrics, proactiveAlerts }
    })()),
  }

  try {
    // Scope de familias para inventario (Admin Normal)
    let inventoryFamilyFilter: Record<string, any> = {}
    if (!isSuperAdmin) {
      const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
      const invFamilyIds = await getModuleFamilyIds(userId, 'inventory')
      if (invFamilyIds.length > 0) {
        // Filtrar equipos por tipo → familia
        const typesInScope = await prisma.equipment_types.findMany({
          where: { familyId: { in: invFamilyIds } },
          select: { id: true },
        })
        const typeIds = typesInScope.map(t => t.id)
        inventoryFamilyFilter =
          typeIds.length > 0 ? { typeId: { in: typeIds } } : { id: '__NONE__' }
      } else {
        inventoryFamilyFilter = { id: '__NONE__' }
      }
    }

    const [
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      totalConsumables,
      lowStockConsumables,
      totalLicenses,
      expiredLicenses,
    ] = await Promise.all([
      prisma.equipment.count({ where: { status: { not: 'RETIRED' }, ...inventoryFamilyFilter } }),
      prisma.equipment.count({ where: { status: 'AVAILABLE', ...inventoryFamilyFilter } }),
      prisma.equipment.count({ where: { status: 'ASSIGNED', ...inventoryFamilyFilter } }),
      prisma.equipment.count({ where: { status: 'MAINTENANCE', ...inventoryFamilyFilter } }),
      prisma.consumables.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count FROM consumables WHERE current_stock <= min_stock
        `.then(r => Number(r[0]?.count ?? 0)),
      prisma.software_licenses.count(),
      prisma.software_licenses.count({ where: { expirationDate: { lt: new Date() } } }),
    ])
    stats.inventoryStats = {
      totalAssets,
      availableAssets,
      assignedAssets,
      maintenanceAssets,
      totalConsumables,
      lowStockConsumables,
      totalLicenses,
      expiredLicenses,
    }
  } catch {
    // Si el módulo de inventario no está disponible, no incluir stats
  }

  let assignedFamilies: any[] = []
  let adminFamilyIds: string[] = []

  if (isSuperAdmin) {
    const allFamilies = await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, color: true, icon: true },
    })
    assignedFamilies = await enrichFamiliesWithModules(allFamilies)
    stats.isSuperAdmin = true
  } else {
    const adminFamilies = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: {
        family: { select: { id: true, name: true, code: true, color: true, icon: true } },
      },
    })
    const familyMap = new Map<string, any>()
    adminFamilies.forEach(a => {
      if (a.family) familyMap.set(a.family.id, a.family)
    })

    const adminUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        departments: {
          select: {
            family: { select: { id: true, name: true, code: true, color: true, icon: true } },
          },
        },
      },
    })
    if (adminUser?.departments?.family) {
      familyMap.set(adminUser.departments.family.id, adminUser.departments.family)
    }

    assignedFamilies = await enrichFamiliesWithModules(Array.from(familyMap.values()))
    adminFamilyIds = Array.from(familyMap.keys())
    stats.isSuperAdmin = false

    if (stats.familyMetrics && adminFamilyIds.length > 0) {
      stats.familyMetrics = (stats.familyMetrics as any[]).filter((m: any) =>
        adminFamilyIds.includes(m.familyId)
      )
    }
    if (stats.proactiveAlerts && adminFamilyIds.length > 0) {
      stats.proactiveAlerts = (stats.proactiveAlerts as any[]).filter(
        (a: any) => !a.familyId || adminFamilyIds.includes(a.familyId)
      )
    }
  }

  stats.assignedFamilies = assignedFamilies

  return stats
}
