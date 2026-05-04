import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const technicianId = session.user.id
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // ── Todas las queries en paralelo ─────────────────────────────────────────
    const [
      resolvedToday,
      resolvedThisWeek,
      resolvedThisMonth,
      closedThisMonth,
      activeTickets,
      todayAssigned,
      weekAssigned,
      monthAssigned,
      resolvedTicketsForAvg,
      ratingsData,
    ] = await Promise.all([
      // Resueltos hoy (RESOLVED + CLOSED)
      prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          updatedAt: { gte: startOfToday },
        },
      }),
      // Resueltos esta semana
      prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          updatedAt: { gte: startOfWeek },
        },
      }),
      // Resueltos este mes (RESOLVED)
      prisma.tickets.count({
        where: { assigneeId: technicianId, status: 'RESOLVED', updatedAt: { gte: startOfMonth } },
      }),
      // Cerrados este mes (CLOSED)
      prisma.tickets.count({
        where: { assigneeId: technicianId, status: 'CLOSED', updatedAt: { gte: startOfMonth } },
      }),
      // Tickets activos
      prisma.tickets.count({
        where: { assigneeId: technicianId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      // Asignados hoy
      prisma.tickets.count({
        where: { assigneeId: technicianId, createdAt: { gte: startOfToday } },
      }),
      // Asignados esta semana
      prisma.tickets.count({
        where: { assigneeId: technicianId, createdAt: { gte: startOfWeek } },
      }),
      // Asignados este mes
      prisma.tickets.count({
        where: { assigneeId: technicianId, createdAt: { gte: startOfMonth } },
      }),
      // Para calcular tiempo promedio de resolución
      prisma.tickets.findMany({
        where: {
          assigneeId: technicianId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          updatedAt: { gte: startOfMonth },
        },
        select: { createdAt: true, updatedAt: true },
      }),
      // Calificaciones del técnico
      prisma.ticket_ratings.findMany({
        where: { tickets: { assigneeId: technicianId } },
        select: { rating: true },
      }),
    ])

    // Tiempo promedio de resolución
    const avgHours =
      resolvedTicketsForAvg.length > 0
        ? resolvedTicketsForAvg.reduce((sum, t) => {
            return sum + (t.updatedAt.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60)
          }, 0) / resolvedTicketsForAvg.length
        : 0

    const formatHours = (h: number) => {
      if (h < 1) return `${Math.round(h * 60)}m`
      if (h < 24) return `${Math.round(h * 10) / 10}h`
      return `${Math.round((h / 24) * 10) / 10}d`
    }

    // Satisfacción real desde ticket_ratings
    const avgSatisfaction =
      ratingsData.length > 0
        ? Math.round((ratingsData.reduce((s, r) => s + r.rating, 0) / ratingsData.length) * 10) / 10
        : 0

    const totalResolvedThisMonth = resolvedThisMonth + closedThisMonth
    const productivity = weekAssigned > 0 ? Math.round((resolvedThisWeek / weekAssigned) * 100) : 0
    const efficiency =
      activeTickets + totalResolvedThisMonth > 0
        ? Math.round((totalResolvedThisMonth / (activeTickets + totalResolvedThisMonth)) * 100)
        : 0

    // ── Estadísticas por categoría ────────────────────────────────────────────
    // Obtener categorías asignadas al técnico
    const assignments = await prisma.technician_assignments.findMany({
      where: { technicianId, isActive: true },
      include: { categories: { select: { id: true, name: true, color: true } } },
    })

    const assignedCategoryIds = assignments.map(a => a.categoryId)

    // Hijos y nietos de esas categorías
    const children =
      assignedCategoryIds.length > 0
        ? await prisma.categories.findMany({
            where: { parentId: { in: assignedCategoryIds }, isActive: true },
            select: { id: true, parentId: true },
          })
        : []
    const childIds = children.map(c => c.id)
    const grandchildren =
      childIds.length > 0
        ? await prisma.categories.findMany({
            where: { parentId: { in: childIds }, isActive: true },
            select: { id: true, parentId: true },
          })
        : []

    // Mapa rootId → todos sus descendientes
    const rootToAllIds = new Map<string, string[]>()
    for (const rootId of assignedCategoryIds) {
      const myChildren = children.filter(c => c.parentId === rootId).map(c => c.id)
      const myGrandchildren = grandchildren
        .filter(c => myChildren.includes(c.parentId!))
        .map(c => c.id)
      rootToAllIds.set(rootId, [rootId, ...myChildren, ...myGrandchildren])
    }

    const allDescendantIds = Array.from(
      new Set([...assignedCategoryIds, ...childIds, ...grandchildren.map(c => c.id)])
    )

    // Tickets por categoría (RESOLVED + CLOSED = resueltos, OPEN + IN_PROGRESS = pendientes)
    const ticketGroups =
      allDescendantIds.length > 0
        ? await prisma.tickets.groupBy({
            by: ['categoryId', 'status'],
            where: {
              categoryId: { in: allDescendantIds },
              status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
            },
            _count: { id: true },
          })
        : []

    // Agregar por root
    const categoryStats = assignments.map(a => {
      const descIds = rootToAllIds.get(a.categoryId) ?? [a.categoryId]
      let resolved = 0
      let pending = 0
      for (const row of ticketGroups) {
        if (!row.categoryId || !descIds.includes(row.categoryId)) continue
        if (row.status === 'RESOLVED' || row.status === 'CLOSED') resolved += row._count.id
        if (row.status === 'OPEN' || row.status === 'IN_PROGRESS') pending += row._count.id
      }
      return {
        name: a.categories.name,
        resolved,
        pending,
        avgTime: formatHours(avgHours),
        color: a.categories.color || '#6B7280',
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        today: {
          resolved: resolvedToday,
          assigned: todayAssigned,
          avgResponseTime: formatHours(avgHours * 0.3),
          avgResolutionTime: formatHours(avgHours),
        },
        week: {
          resolved: resolvedThisWeek,
          assigned: weekAssigned,
          avgSatisfaction,
          productivity,
        },
        month: {
          resolved: totalResolvedThisMonth,
          assigned: monthAssigned,
          totalHours: Math.round(avgHours * totalResolvedThisMonth),
          efficiency,
        },
      },
      categoryStats,
    })
  } catch (error: any) {
    console.error('[API-TECHNICIAN-STATS] Error:', error?.message)
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas' },
      { status: 500 }
    )
  }
}
