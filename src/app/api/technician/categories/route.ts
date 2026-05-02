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
    // Mostramos TODOS los tickets de la categoría (no solo los del técnico)
    // para que el técnico vea el volumen real de trabajo de su área
    const categoryIds = assignments.map(a => a.categoryId)

    const [ticketGroups, currentTicketGroups] = await Promise.all([
      // Todos los tickets de estas categorías, agrupados por categoría+status
      prisma.tickets.groupBy({
        by: ['categoryId', 'status'],
        where: {
          categoryId: { in: categoryIds },
          status: { in: ['OPEN', 'IN_PROGRESS', 'RESOLVED'] },
        },
        _count: { id: true },
      }),
      // Tickets activos (OPEN + IN_PROGRESS) por categoría para currentTickets del técnico
      prisma.tickets.groupBy({
        by: ['categoryId'],
        where: {
          categoryId: { in: categoryIds },
          assigneeId: technicianId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        _count: { id: true },
      }),
    ])

    // Construir mapas para lookup O(1)
    const statsMap = new Map<string, { open: number; inProgress: number; resolved: number }>()
    for (const row of ticketGroups) {
      if (!row.categoryId) continue
      const entry = statsMap.get(row.categoryId) ?? { open: 0, inProgress: 0, resolved: 0 }
      if (row.status === 'OPEN') entry.open = row._count.id
      if (row.status === 'IN_PROGRESS') entry.inProgress = row._count.id
      if (row.status === 'RESOLVED') entry.resolved = row._count.id
      statsMap.set(row.categoryId, entry)
    }

    const currentMap = new Map<string, number>()
    for (const row of currentTicketGroups) {
      if (row.categoryId) currentMap.set(row.categoryId, row._count.id)
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
      categories,
    })
  } catch (error) {
    console.error('[API-TECHNICIAN-CATEGORIES] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener categorías' },
      { status: 500 }
    )
  }
}
