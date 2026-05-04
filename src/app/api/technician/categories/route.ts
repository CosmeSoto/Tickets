import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const technicianId = session.user.id

    // Obtener categorías asignadas al técnico con estadísticas
    const assignments = await prisma.technician_assignments.findMany({
      where: { technicianId, isActive: true },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
            parentId: true,
            color: true,
          },
        },
      },
      orderBy: { priority: 'asc' },
    })

    // Obtener estadísticas de tickets por categoría
    // Incluimos tickets de la categoría Y de todas sus subcategorías hijas
    const categoryIds = assignments.map(a => a.categoryId)

    if (categoryIds.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Paso 1: hijos directos
    const children = await prisma.categories.findMany({
      where: { parentId: { in: categoryIds }, isActive: true },
      select: { id: true, parentId: true },
    })
    const childIds = children.map(c => c.id)

    // Paso 2: nietos (hijos de los hijos)
    const grandchildren =
      childIds.length > 0
        ? await prisma.categories.findMany({
            where: { parentId: { in: childIds }, isActive: true },
            select: { id: true, parentId: true },
          })
        : []
    const grandchildIds = grandchildren.map(c => c.id)

    // Todos los IDs: raíces + hijos + nietos
    const allCategoryIds = Array.from(new Set([...categoryIds, ...childIds, ...grandchildIds]))

    // Construir mapa: rootId → todos sus descendientes
    const rootToAllIds = new Map<string, string[]>()
    for (const rootId of categoryIds) {
      const myChildren = children.filter(c => c.parentId === rootId).map(c => c.id)
      const myGrandchildren = grandchildren
        .filter(c => myChildren.includes(c.parentId!))
        .map(c => c.id)
      rootToAllIds.set(rootId, [rootId, ...myChildren, ...myGrandchildren])
    }

    const [ticketGroups, currentTicketGroups] = await Promise.all([
      // Todos los tickets de estas categorías y sus hijas, agrupados por categoría+status
      prisma.tickets.groupBy({
        by: ['categoryId', 'status'],
        where: {
          categoryId: { in: allCategoryIds },
          status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] },
        },
        _count: { id: true },
      }),
      // Tickets activos del técnico en estas categorías y sus hijas
      prisma.tickets.groupBy({
        by: ['categoryId'],
        where: {
          categoryId: { in: allCategoryIds },
          assigneeId: technicianId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        _count: { id: true },
      }),
    ])

    // Construir mapas por categoryId individual
    const rawStatsMap = new Map<string, { open: number; inProgress: number; resolved: number }>()
    for (const row of ticketGroups) {
      if (!row.categoryId) continue
      const entry = rawStatsMap.get(row.categoryId) ?? { open: 0, inProgress: 0, resolved: 0 }
      if (row.status === 'OPEN') entry.open = row._count.id
      if (row.status === 'IN_PROGRESS') entry.inProgress = row._count.id
      // RESOLVED y CLOSED cuentan como resueltos
      if (row.status === 'RESOLVED' || row.status === 'CLOSED') entry.resolved += row._count.id
      rawStatsMap.set(row.categoryId, entry)
    }

    const rawCurrentMap = new Map<string, number>()
    for (const row of currentTicketGroups) {
      if (row.categoryId) rawCurrentMap.set(row.categoryId, row._count.id)
    }

    // Agregar stats de todos los descendientes al root
    const statsMap = new Map<string, { open: number; inProgress: number; resolved: number }>()
    const currentMap = new Map<string, number>()

    for (const [rootId, descendantIds] of rootToAllIds.entries()) {
      const agg = { open: 0, inProgress: 0, resolved: 0 }
      let current = 0
      for (const descId of descendantIds) {
        const s = rawStatsMap.get(descId)
        if (s) {
          agg.open += s.open
          agg.inProgress += s.inProgress
          agg.resolved += s.resolved
        }
        current += rawCurrentMap.get(descId) ?? 0
      }
      statsMap.set(rootId, agg)
      currentMap.set(rootId, current)
    }

    // Combinar datos usando los mapas
    const categories = assignments.map(assignment => {
      const s = statsMap.get(assignment.categoryId) ?? { open: 0, inProgress: 0, resolved: 0 }
      const currentTickets = currentMap.get(assignment.categoryId) ?? 0

      const levelNames = ['', 'Nivel 1', 'Nivel 2', 'Nivel 3']
      const levelName =
        levelNames[assignment.categories.level] || `Nivel ${assignment.categories.level}`

      return {
        id: assignment.id,
        categoryId: assignment.categoryId,
        name: assignment.categories.name,
        description: assignment.categories.description || '',
        color: assignment.categories.color || '#6B7280',
        categoryLevel: assignment.categories.level,
        levelName,
        parentId: assignment.categories.parentId,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign,
        currentTickets,
        utilization: assignment.maxTickets
          ? Math.round((currentTickets / assignment.maxTickets) * 100)
          : 0,
        stats: {
          open: s.open,
          inProgress: s.inProgress,
          resolved: s.resolved,
          total: s.open + s.inProgress + s.resolved,
        },
      }
    })

    // Registrar auditoría
    await AuditServiceComplete.logAction({
      userId: technicianId,
      action: AuditActionsComplete.CATEGORY_VIEW,
      entityType: 'system',
      entityId: technicianId,
      details: {
        categoriesCount: categories.length,
        totalCurrentTickets: categories.reduce((sum, c) => sum + c.currentTickets, 0),
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    })

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    console.error('[API-TECHNICIAN-CATEGORIES] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener categorías' },
      { status: 500 }
    )
  }
}
