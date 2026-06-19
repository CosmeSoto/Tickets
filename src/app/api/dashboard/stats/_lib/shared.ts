import prisma from '@/lib/prisma'

const AVG_RESPONSE_SAMPLE_DAYS = 90
const AVG_RESPONSE_MAX_TICKETS = 500

export function calculateAvgResolutionTime(tickets: any[]): string {
  if (tickets.length === 0) return '0h'

  const totalMinutes = tickets.reduce((acc, ticket) => {
    if (ticket.resolvedAt && ticket.createdAt) {
      const diff = new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()
      return acc + diff / (1000 * 60)
    }
    return acc
  }, 0)

  const avgMinutes = totalMinutes / tickets.length
  const hours = Math.floor(avgMinutes / 60)
  const minutes = Math.floor(avgMinutes % 60)

  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

export async function calculateAvgResponseTime(): Promise<string> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - AVG_RESPONSE_SAMPLE_DAYS)

    const ticketsWithComments = await prisma.tickets.findMany({
      where: {
        createdAt: { gte: since },
        comments: { some: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: AVG_RESPONSE_MAX_TICKETS,
      select: {
        id: true,
        createdAt: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    if (ticketsWithComments.length === 0) return '2h'

    const totalMinutes = ticketsWithComments.reduce((acc, ticket) => {
      if (ticket.comments[0]) {
        const diff = ticket.comments[0].createdAt.getTime() - ticket.createdAt.getTime()
        return acc + diff / (1000 * 60)
      }
      return acc
    }, 0)

    const avgMinutes = totalMinutes / ticketsWithComments.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    if (hours > 0) return `${hours}h ${minutes > 0 ? minutes + 'min' : ''}`
    return `${minutes}min`
  } catch (error) {
    console.error('Error calculating response time:', error)
    return '2h'
  }
}

export async function calculateAvgResponseTimeForClient(clientId: string): Promise<string> {
  try {
    const since = new Date()
    since.setDate(since.getDate() - AVG_RESPONSE_SAMPLE_DAYS)

    const ticketsWithComments = await prisma.tickets.findMany({
      where: {
        clientId,
        createdAt: { gte: since },
        comments: { some: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: AVG_RESPONSE_MAX_TICKETS,
      select: {
        id: true,
        createdAt: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    })

    if (ticketsWithComments.length === 0) return '2h'

    const totalMinutes = ticketsWithComments.reduce((acc, ticket) => {
      if (ticket.comments[0]) {
        const diff = ticket.comments[0].createdAt.getTime() - ticket.createdAt.getTime()
        return acc + diff / (1000 * 60)
      }
      return acc
    }, 0)

    const avgMinutes = totalMinutes / ticketsWithComments.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    if (hours > 0) return `${hours}h ${minutes > 0 ? minutes + 'min' : ''}`
    return `${minutes}min`
  } catch (error) {
    console.error('Error calculating client response time:', error)
    return '2h'
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `hace ${days}d`
  if (hours > 0) return `hace ${hours}h`
  if (minutes > 0) return `hace ${minutes}min`
  return 'ahora'
}

export async function getRecentActivity(role: string, _userId: string) {
  const activities: any[] = []

  if (role === 'ADMIN') {
    const recentTickets = await prisma.tickets.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        users_tickets_clientIdTousers: { select: { name: true } },
        users_tickets_assigneeIdTousers: { select: { name: true } },
      },
    })

    recentTickets.forEach(ticket => {
      activities.push({
        id: `ticket_${ticket.id}`,
        type: 'ticket_created',
        title: `Nuevo ticket: ${ticket.title}`,
        description: `Creado por ${ticket.users_tickets_clientIdTousers?.name || 'Usuario'}`,
        time: formatTimeAgo(ticket.createdAt),
        user: ticket.users_tickets_clientIdTousers?.name || 'Sistema',
        ticketId: ticket.id,
      })
    })
  }

  return activities.slice(0, 5)
}

export async function getFamilyMetrics(scopeFamilyIds?: string[]) {
  try {
    const families = await prisma.families.findMany({
      where: {
        isActive: true,
        ...(scopeFamilyIds ? { id: { in: scopeFamilyIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        color: true,
        icon: true,
        code: true,
        ticketFamilyConfig: {
          select: { ticketsEnabled: true },
        },
        formConfig: {
          select: {
            inventoryEnabled: true,
            allowedSubtypes: true,
          },
        },
      },
    })

    if (families.length === 0) return []

    const familyIds = families.map(f => f.id)

    const ticketCounts = await prisma.tickets.groupBy({
      by: ['familyId', 'status'],
      where: {
        familyId: { in: familyIds },
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      _count: { id: true },
    })

    const techCounts = await prisma.technician_family_assignments.groupBy({
      by: ['familyId'],
      where: { familyId: { in: familyIds }, isActive: true },
      _count: { id: true },
    })

    const equipmentCounts = await prisma.equipment.groupBy({
      by: ['typeId', 'status'],
      where: {
        status: { in: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE'] },
        type: { familyId: { in: familyIds } },
      },
      _count: { id: true },
    })

    const equipmentTypes = await prisma.equipment_types.findMany({
      where: { familyId: { in: familyIds } },
      select: { id: true, familyId: true },
    })

    const ticketMap = new Map<string, { open: number; inProgress: number }>()
    for (const row of ticketCounts) {
      if (!row.familyId) continue
      const entry = ticketMap.get(row.familyId) ?? { open: 0, inProgress: 0 }
      if (row.status === 'OPEN') entry.open = row._count.id
      if (row.status === 'IN_PROGRESS') entry.inProgress = row._count.id
      ticketMap.set(row.familyId, entry)
    }

    const techMap = new Map<string, number>()
    for (const row of techCounts) {
      techMap.set(row.familyId, row._count.id)
    }

    const typeToFamily = new Map<string, string>()
    for (const t of equipmentTypes) {
      if (t.familyId) typeToFamily.set(t.id, t.familyId)
    }

    const equipMap = new Map<string, { available: number; assigned: number; maintenance: number }>()
    for (const row of equipmentCounts) {
      const familyId = typeToFamily.get(row.typeId)
      if (!familyId) continue
      const entry = equipMap.get(familyId) ?? { available: 0, assigned: 0, maintenance: 0 }
      if (row.status === 'AVAILABLE') entry.available = row._count.id
      if (row.status === 'ASSIGNED') entry.assigned = row._count.id
      if (row.status === 'MAINTENANCE') entry.maintenance = row._count.id
      equipMap.set(familyId, entry)
    }

    return families.map(family => {
      const ticketsEnabled = family.ticketFamilyConfig?.ticketsEnabled ?? false
      const inventoryEnabled =
        family.formConfig !== null && (family.formConfig?.inventoryEnabled ?? true)

      const tickets = ticketMap.get(family.id) ?? { open: 0, inProgress: 0 }
      const equip = equipMap.get(family.id) ?? { available: 0, assigned: 0, maintenance: 0 }

      return {
        familyId: family.id,
        familyName: family.name,
        familyColor: family.color,
        familyCode: family.code,
        modules: { tickets: ticketsEnabled, inventory: inventoryEnabled },
        ...(ticketsEnabled
          ? {
              openTickets: tickets.open,
              inProgressTickets: tickets.inProgress,
              technicianCount: techMap.get(family.id) ?? 0,
            }
          : {}),
        ...(inventoryEnabled
          ? {
              inventory: {
                availableAssets: equip.available,
                assignedAssets: equip.assigned,
                maintenanceAssets: equip.maintenance,
                totalAssets: equip.available + equip.assigned + equip.maintenance,
              },
            }
          : {}),
      }
    })
  } catch {
    return []
  }
}

export async function getProactiveAlerts() {
  const alerts: any[] = []

  try {
    const slaViolations = await prisma.sla_violations.findMany({
      where: {
        isResolved: false,
        ticket: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      },
      select: {
        id: true,
        ticket: { select: { id: true, title: true, familyId: true } },
      },
      take: 10,
    })
    slaViolations.forEach(sv => {
      alerts.push({
        type: 'SLA_EXPIRING',
        severity: 'WARNING',
        message: `Ticket "${sv.ticket?.title}" tiene una violación de SLA activa`,
        ticketId: sv.ticket?.id,
        familyId: sv.ticket?.familyId,
      })
    })

    const familiesWithoutTechnicians = await prisma.families.findMany({
      where: {
        isActive: true,
        ticketFamilyConfig: { ticketsEnabled: true },
        technicianFamilyAssignments: { none: { isActive: true } },
      },
      select: { id: true, name: true },
    })
    familiesWithoutTechnicians.forEach(family => {
      alerts.push({
        type: 'NO_TECHNICIANS',
        severity: 'CRITICAL',
        message: `La familia "${family.name}" no tiene técnicos activos asignados`,
        familyId: family.id,
      })
    })

    const overloadedTechnicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
        tickets_tickets_assigneeIdTousers: {
          some: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        },
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { tickets_tickets_assigneeIdTousers: true },
        },
      },
    })
    overloadedTechnicians.forEach(tech => {
      const count = tech._count.tickets_tickets_assigneeIdTousers
      if (count > 15) {
        alerts.push({
          type: 'TECHNICIAN_OVERLOADED',
          severity: count > 25 ? 'CRITICAL' : 'WARNING',
          message: `Técnico "${tech.name}" tiene ${count} tickets activos`,
          technicianId: tech.id,
        })
      }
    })
  } catch (err) {
    console.error('[Dashboard] Error generando alertas proactivas:', err)
  }

  return alerts
}

export async function enrichFamiliesWithModules(families: any[]) {
  if (families.length === 0) return families
  const ids = families.map(f => f.id)
  const [ticketConfigs, invConfigs] = await Promise.all([
    prisma.ticket_family_config.findMany({
      where: { familyId: { in: ids } },
      select: { familyId: true, ticketsEnabled: true },
    }),
    prisma.inventory_family_config.findMany({
      where: { familyId: { in: ids } },
      select: { familyId: true, inventoryEnabled: true },
    }),
  ])
  const ticketMap = new Map(ticketConfigs.map(c => [c.familyId, c.ticketsEnabled]))
  const invMap = new Map(invConfigs.map(c => [c.familyId, c.inventoryEnabled]))
  return families.map(f => ({
    ...f,
    modules: {
      tickets: ticketMap.get(f.id) ?? false,
      inventory: invMap.get(f.id) ?? false,
    },
  }))
}
