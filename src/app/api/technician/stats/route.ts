import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  console.log('[API-TECHNICIAN-STATS] Iniciando petición...')
  
  try {
    const session = await getServerSession(authOptions)
    console.log('[API-TECHNICIAN-STATS] Sesión obtenida:', session?.user?.id)
    
    if (!session?.user?.id) {
      console.log('[API-TECHNICIAN-STATS] No hay sesión válida')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const technicianId = session.user.id
    console.log('[API-TECHNICIAN-STATS] ID del técnico:', technicianId)

    // Obtener fechas para los rangos
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    console.log('[API-TECHNICIAN-STATS] Fechas calculadas:', { startOfToday, startOfWeek, startOfMonth })

    console.log('[API-TECHNICIAN-STATS] Consultando estadísticas...')
    
    // Estadísticas generales del técnico - una por una para identificar errores
    let resolvedToday = 0
    let resolvedThisWeek = 0
    let resolvedThisMonth = 0
    let activeTickets = 0
    let totalResolved = 0
    
    try {
      resolvedToday = await prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED',
          updatedAt: { gte: startOfToday }
        }
      })
      console.log('[API-TECHNICIAN-STATS] Resueltos hoy:', resolvedToday)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en resolvedToday:', error)
    }
    
    try {
      resolvedThisWeek = await prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED',
          updatedAt: { gte: startOfWeek }
        }
      })
      console.log('[API-TECHNICIAN-STATS] Resueltos esta semana:', resolvedThisWeek)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en resolvedThisWeek:', error)
    }
    
    try {
      resolvedThisMonth = await prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED',
          updatedAt: { gte: startOfMonth }
        }
      })
      console.log('[API-TECHNICIAN-STATS] Resueltos este mes:', resolvedThisMonth)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en resolvedThisMonth:', error)
    }
    
    try {
      activeTickets = await prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: { in: ['OPEN', 'IN_PROGRESS'] }
        }
      })
      console.log('[API-TECHNICIAN-STATS] Tickets activos:', activeTickets)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en activeTickets:', error)
    }
    
    try {
      totalResolved = await prisma.tickets.count({
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED'
        }
      })
      console.log('[API-TECHNICIAN-STATS] Total resueltos:', totalResolved)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en totalResolved:', error)
    }

    // Calcular tiempo promedio de resolución manualmente
    let avgHours = 0
    try {
      console.log('[API-TECHNICIAN-STATS] Calculando tiempo promedio...')
      const resolvedTickets = await prisma.tickets.findMany({
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED',
          updatedAt: { gte: startOfMonth }
        },
        select: {
          createdAt: true,
          updatedAt: true
        }
      })
      
      console.log('[API-TECHNICIAN-STATS] Tickets para promedio:', resolvedTickets.length)

      avgHours = resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, ticket) => {
            const diff = ticket.updatedAt.getTime() - ticket.createdAt.getTime()
            return sum + (diff / (1000 * 60 * 60)) // Convertir a horas
          }, 0) / resolvedTickets.length
        : 0
      
      console.log('[API-TECHNICIAN-STATS] Promedio calculado:', avgHours)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error calculando promedio:', error)
    }

    // Estadísticas por categoría
    let categoryStatsWithNames: any[] = []
    try {
      console.log('[API-TECHNICIAN-STATS] Obteniendo stats por categoría...')
      const categoryStats = await prisma.tickets.groupBy({
        by: ['categoryId'],
        where: {
          assigneeId: technicianId,
          status: 'RESOLVED',
          updatedAt: { gte: startOfMonth }
        },
        _count: {
          id: true
        }
      })
      
      console.log('[API-TECHNICIAN-STATS] Stats por categoría:', categoryStats.length)

      // Obtener nombres de categorías
      const categoryIds = categoryStats.map(stat => stat.categoryId).filter(Boolean) as string[]
      
      if (categoryIds.length > 0) {
        const categories = await prisma.categories.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true }
        })

        categoryStatsWithNames = categoryStats.map(stat => {
          const category = categories.find(c => c.id === stat.categoryId)
          return {
            categoryId: stat.categoryId,
            categoryName: category?.name || 'Sin categoría',
            resolved: stat._count.id
          }
        })
      }
      
      console.log('[API-TECHNICIAN-STATS] Stats con nombres:', categoryStatsWithNames.length)
    } catch (error) {
      console.error('[API-TECHNICIAN-STATS] Error en categoryStats:', error)
    }

    // Formatear tiempo en horas
    const formatHours = (hours: number) => {
      if (hours < 1) return `${Math.round(hours * 60)}m`
      return `${Math.round(hours)}h`
    }

    // Calcular estadísticas adicionales
    const todayAssigned = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        createdAt: { gte: startOfToday }
      }
    })

    const weekAssigned = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        createdAt: { gte: startOfWeek }
      }
    })

    const monthAssigned = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        createdAt: { gte: startOfMonth }
      }
    })

    // Calcular productividad (resueltos vs asignados)
    const productivity = weekAssigned > 0 
      ? Math.round((resolvedThisWeek / weekAssigned) * 100) 
      : 0

    // Calcular eficiencia (resueltos vs activos + resueltos)
    const efficiency = (activeTickets + resolvedThisMonth) > 0
      ? Math.round((resolvedThisMonth / (activeTickets + resolvedThisMonth)) * 100)
      : 0

    // Obtener total de técnicos para ranking
    const totalTechnicians = await prisma.users.count({
      where: { role: 'TECHNICIAN' }
    })

    const stats = {
      today: {
        resolved: resolvedToday,
        assigned: todayAssigned,
        avgResponseTime: formatHours(avgHours * 0.3), // Estimación
        avgResolutionTime: formatHours(avgHours)
      },
      week: {
        resolved: resolvedThisWeek,
        assigned: weekAssigned,
        avgSatisfaction: 4.2, // TODO: Implementar sistema de calificaciones
        productivity
      },
      month: {
        resolved: resolvedThisMonth,
        assigned: monthAssigned,
        totalHours: Math.round(avgHours * resolvedThisMonth),
        efficiency
      },
      performance: {
        responseTimeRank: 1, // TODO: Implementar ranking real
        resolutionTimeRank: 1,
        satisfactionRank: 1,
        totalTechnicians
      }
    }

    // Formatear categoryStats para incluir pending y avgTime
    const formattedCategoryStats = categoryStatsWithNames.map(cat => ({
      name: cat.categoryName,
      resolved: cat.resolved,
      pending: 0, // TODO: Calcular tickets pendientes por categoría
      avgTime: formatHours(avgHours),
      color: '#3B82F6' // TODO: Obtener color real de la categoría
    }))

    const response = {
      success: true,
      stats,
      categoryStats: formattedCategoryStats
    }

    return NextResponse.json(response)
    
  } catch (error: any) {
    console.error('[API-TECHNICIAN-STATS] Error general:', error)
    console.error('[API-TECHNICIAN-STATS] Error stack:', error?.stack)
    console.error('[API-TECHNICIAN-STATS] Error message:', error?.message)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener estadísticas',
        details: error?.message || 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
