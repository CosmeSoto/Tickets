import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const technicianId = session.user.id

    // Obtener categorías asignadas al técnico con estadísticas
    const assignments = await prisma.technician_assignments.findMany({
      where: {
        technicianId,
        isActive: true
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            description: true,
            level: true,
            parentId: true,
            color: true
          }
        },
        users: {
          select: {
            _count: {
              select: {
                tickets_tickets_assigneeIdTousers: {
                  where: {
                    status: { in: ['OPEN', 'IN_PROGRESS'] }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        priority: 'asc'
      }
    })

    // Obtener estadísticas de tickets por categoría
    const categoryIds = assignments.map(a => a.categoryId)
    
    const ticketStats = await Promise.all(
      categoryIds.map(async (categoryId) => {
        const [open, inProgress, resolved] = await Promise.all([
          prisma.tickets.count({
            where: {
              categoryId,
              assigneeId: technicianId,
              status: 'OPEN'
            }
          }),
          prisma.tickets.count({
            where: {
              categoryId,
              assigneeId: technicianId,
              status: 'IN_PROGRESS'
            }
          }),
          prisma.tickets.count({
            where: {
              categoryId,
              assigneeId: technicianId,
              status: 'RESOLVED'
            }
          })
        ])

        return {
          categoryId,
          open,
          inProgress,
          resolved,
          total: open + inProgress + resolved
        }
      })
    )

    // Combinar datos
    const categories = assignments.map(assignment => {
      const stats = ticketStats.find(s => s.categoryId === assignment.categoryId)
      const currentTickets = assignment.users._count.tickets_tickets_assigneeIdTousers

      // Determinar el nombre del nivel
      const levelNames = ['', 'Nivel 1', 'Nivel 2', 'Nivel 3']
      const levelName = levelNames[assignment.categories.level] || `Nivel ${assignment.categories.level}`

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
          open: stats?.open || 0,
          inProgress: stats?.inProgress || 0,
          resolved: stats?.resolved || 0,
          total: stats?.total || 0
        }
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
        totalCurrentTickets: categories.reduce((sum, c) => sum + c.currentTickets, 0)
      },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json({
      success: true,
      categories
    })
  } catch (error) {
    console.error('[API-TECHNICIAN-CATEGORIES] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener categorías' },
      { status: 500 }
    )
  }
}
