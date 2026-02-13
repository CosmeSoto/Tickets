import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Verificar que el usuario existe y es técnico
    const user = await prisma.users.findUnique({
      where: { id },
      select: { id: true, name: true, role: true }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'TECHNICIAN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'El usuario no es un técnico' },
        { status: 400 }
      )
    }

    // Obtener asignaciones de categorías
    const assignments = await prisma.technician_assignments.findMany({
      where: {
        technicianId: id,
        isActive: true
      },
      select: {
        id: true,
        categoryId: true,
        priority: true,
        maxTickets: true,
        autoAssign: true,
        isActive: true,
        createdAt: true,
        categories: {
          select: {
            id: true,
            name: true,
            level: true,
            color: true,
            description: true
          }
        }
      },
      orderBy: [
        { priority: 'asc' }
      ]
    })

    // Obtener tickets actuales por categoría
    const categoryIds = assignments.map(a => a.categoryId)
    
    const ticketsByCategory = await prisma.tickets.groupBy({
      by: ['categoryId'],
      where: {
        assigneeId: id,
        categoryId: {
          in: categoryIds
        },
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      },
      _count: {
        id: true
      }
    })

    // Crear mapa de tickets por categoría
    const ticketsMap = new Map<string, number>()
    ticketsByCategory.forEach(item => {
      ticketsMap.set(item.categoryId!, item._count.id)
    })

    // Calcular estadísticas generales
    const totalAssignments = assignments.length
    const activeAssignments = assignments.filter(a => a.isActive).length
    const totalMaxTickets = assignments.reduce((sum, a) => sum + (a.maxTickets || 10), 0)
    
    // Obtener tickets actuales del técnico
    const currentTicketsCount = await prisma.tickets.count({
      where: {
        assigneeId: id,
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    // Obtener estadísticas de tickets
    const ticketStats = await prisma.tickets.groupBy({
      by: ['status'],
      where: {
        assigneeId: id
      },
      _count: {
        id: true
      }
    })

    // Calcular tickets resueltos este mes
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const resolvedThisMonth = await prisma.tickets.count({
      where: {
        assigneeId: id,
        status: 'RESOLVED',
        updatedAt: {
          gte: startOfMonth
        }
      }
    })

    // Calcular tiempo promedio de resolución (últimos 30 días)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentResolvedTickets = await prisma.tickets.findMany({
      where: {
        assigneeId: id,
        status: 'RESOLVED',
        updatedAt: {
          gte: thirtyDaysAgo
        }
      },
      select: {
        createdAt: true,
        updatedAt: true
      }
    })

    const avgResolutionTime = recentResolvedTickets.length > 0
      ? recentResolvedTickets.reduce((sum, ticket) => {
          const diff = ticket.updatedAt.getTime() - ticket.createdAt.getTime()
          return sum + diff
        }, 0) / recentResolvedTickets.length
      : 0

    const avgResolutionHours = avgResolutionTime / (1000 * 60 * 60)

    // Calcular utilización promedio
    const avgUtilization = totalMaxTickets > 0 
      ? (currentTicketsCount / totalMaxTickets) * 100 
      : 0

    // Estadísticas por nivel
    const byLevel: { [key: number]: { count: number; maxTickets: number; currentTickets: number } } = {}
    
    for (const assignment of assignments) {
      const level = assignment.categories.level
      const currentTickets = ticketsMap.get(assignment.categoryId) || 0
      
      if (!byLevel[level]) {
        byLevel[level] = { count: 0, maxTickets: 0, currentTickets: 0 }
      }
      
      byLevel[level].count++
      byLevel[level].maxTickets += assignment.maxTickets || 10
      byLevel[level].currentTickets += currentTickets
    }

    // Función para obtener el nombre del nivel
    const getLevelName = (level: number): string => {
      switch (level) {
        case 1: return 'Principal'
        case 2: return 'Subcategoría'
        case 3: return 'Especialidad'
        case 4: return 'Detalle'
        default: return `Nivel ${level}`
      }
    }

    // Formatear asignaciones
    const formattedAssignments = assignments.map(assignment => {
      const currentTickets = ticketsMap.get(assignment.categoryId) || 0
      const utilization = assignment.maxTickets 
        ? (currentTickets / assignment.maxTickets) * 100 
        : 0

      return {
        id: assignment.id,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets || 10,
        autoAssign: assignment.autoAssign,
        isActive: assignment.isActive,
        createdAt: assignment.createdAt.toISOString(),
        currentTickets,
        utilization,
        category: {
          id: assignment.categories.id,
          name: assignment.categories.name,
          level: assignment.categories.level,
          color: assignment.categories.color,
          levelName: getLevelName(assignment.categories.level),
          description: assignment.categories.description
        }
      }
    })

    const stats = {
      totalAssignments,
      activeAssignments,
      totalMaxTickets,
      currentTickets: currentTicketsCount,
      avgUtilization,
      byLevel,
      performance: {
        resolvedThisMonth,
        avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
        totalResolved: ticketStats.find(s => s.status === 'RESOLVED')?._count.id || 0,
        totalClosed: ticketStats.find(s => s.status === 'CLOSED')?._count.id || 0,
        efficiency: totalMaxTickets > 0 ? Math.round((resolvedThisMonth / totalMaxTickets) * 100) : 0
      }
    }

    return NextResponse.json({
      success: true,
      assignments: formattedAssignments,
      stats,
      technician: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    })

  } catch (error) {
    console.error('Error fetching technician assignments:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al cargar asignaciones',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { categoryId, priority, maxTickets, autoAssign } = body

    // Validaciones
    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el usuario existe y es técnico
    const user = await prisma.users.findUnique({
      where: { id },
      select: { role: true }
    })

    if (!user || (user.role !== 'TECHNICIAN' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { success: false, error: 'Usuario no válido' },
        { status: 400 }
      )
    }

    // Verificar que la categoría existe
    const category = await prisma.categories.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Crear o actualizar asignación
    const assignment = await prisma.technician_assignments.upsert({
      where: {
        technicianId_categoryId: {
          technicianId: id,
          categoryId
        }
      },
      create: {
        id: `assign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        technicianId: id,
        categoryId,
        priority: priority || 1,
        maxTickets: maxTickets || 10,
        autoAssign: autoAssign !== undefined ? autoAssign : true,
        isActive: true,
        updatedAt: new Date()
      },
      update: {
        priority: priority || 1,
        maxTickets: maxTickets || 10,
        autoAssign: autoAssign !== undefined ? autoAssign : true,
        isActive: true,
        updatedAt: new Date()
      },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            level: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: assignment,
      message: 'Asignación creada/actualizada exitosamente'
    })

  } catch (error) {
    console.error('Error creating/updating assignment:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al crear/actualizar asignación',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: 'assignmentId es requerido' },
        { status: 400 }
      )
    }

    // Desactivar asignación en lugar de eliminarla
    await prisma.technician_assignments.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Asignación eliminada exitosamente'
    })

  } catch (error) {
    console.error('Error deleting assignment:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al eliminar asignación',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
