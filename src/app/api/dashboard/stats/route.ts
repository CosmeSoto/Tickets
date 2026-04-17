import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

// Función para calcular tiempo promedio de resolución
function calculateAvgResolutionTime(tickets: any[]): string {
  if (tickets.length === 0) return '0h'
  
  const totalMinutes = tickets.reduce((acc, ticket) => {
    if (ticket.resolvedAt && ticket.createdAt) {
      const diff = new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()
      return acc + (diff / (1000 * 60)) // convertir a minutos
    }
    return acc
  }, 0)
  
  const avgMinutes = totalMinutes / tickets.length
  const hours = Math.floor(avgMinutes / 60)
  const minutes = Math.floor(avgMinutes % 60)
  
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}

// Función para calcular tiempo promedio de primera respuesta
async function calculateAvgResponseTime(): Promise<string> {
  try {
    const ticketsWithComments = await prisma.tickets.findMany({
      where: {
        comments: {
          some: {}
        }
      },
      select: {
        id: true,
        createdAt: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true }
        }
      }
    })

    if (ticketsWithComments.length === 0) return '2h'

    const totalMinutes = ticketsWithComments.reduce((acc, ticket) => {
      if (ticket.comments[0]) {
        const diff = ticket.comments[0].createdAt.getTime() - ticket.createdAt.getTime()
        return acc + (diff / (1000 * 60))
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

// Función para generar actividad reciente
async function getRecentActivity(role: string, userId: string) {
  const activities: any[] = []
  
  if (role === 'ADMIN') {
    // Actividad reciente para admin
    const recentTickets = await prisma.tickets.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        users_tickets_clientIdTousers: { select: { name: true } },
        users_tickets_assigneeIdTousers: { select: { name: true } }
      }
    })
    
    recentTickets.forEach(ticket => {
      activities.push({
        id: `ticket_${ticket.id}`,
        type: 'ticket_created',
        title: `Nuevo ticket: ${ticket.title}`,
        description: `Creado por ${ticket.users_tickets_clientIdTousers?.name || 'Usuario'}`,
        time: formatTimeAgo(ticket.createdAt),
        user: ticket.users_tickets_clientIdTousers?.name || 'Sistema',
        ticketId: ticket.id
      })
    })
  }
  
  return activities.slice(0, 5)
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

// Función para obtener métricas por familia
async function getFamilyMetrics() {
  try {
    const families = await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const metrics = await Promise.all(
      families.map(async (family) => {
        const [openTickets, inProgressTickets, technicianCount] = await Promise.all([
          prisma.tickets.count({ where: { familyId: family.id, status: 'OPEN' } }),
          prisma.tickets.count({ where: { familyId: family.id, status: 'IN_PROGRESS' } }),
          prisma.technician_family_assignments.count({ where: { familyId: family.id, isActive: true } }),
        ])
        return { familyId: family.id, familyName: family.name, openTickets, inProgressTickets, technicianCount }
      })
    )
    return metrics
  } catch {
    return []
  }
}

// Función para obtener alertas proactivas
async function getProactiveAlerts() {
  const alerts: any[] = []
  const now = new Date()

  try {
    // 1. Alertas de SLA — violaciones activas sin resolver
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
    slaViolations.forEach((sv) => {
      alerts.push({
        type: 'SLA_EXPIRING',
        severity: 'WARNING',
        message: `Ticket "${sv.ticket?.title}" tiene una violación de SLA activa`,
        ticketId: sv.ticket?.id,
        familyId: sv.ticket?.familyId,
      })
    })

    // 2. Familias sin técnicos activos
    const familiesWithoutTechnicians = await prisma.families.findMany({
      where: {
        isActive: true,
        ticketFamilyConfig: { ticketsEnabled: true },
        technicianFamilyAssignments: { none: { isActive: true } },
      },
      select: { id: true, name: true },
    })
    familiesWithoutTechnicians.forEach((family) => {
      alerts.push({
        type: 'NO_TECHNICIANS',
        severity: 'CRITICAL',
        message: `La familia "${family.name}" no tiene técnicos activos asignados`,
        familyId: family.id,
      })
    })

    // 3. Técnicos sobrecargados (> 15 tickets activos)
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
    overloadedTechnicians.forEach((tech) => {
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || session.user.role
    const userId = session.user.id

    // Caché por rol + userId: 2 minutos para admin/técnico, 3 para cliente
    const ttl = role === 'CLIENT' ? 180 : 120
    const cacheKey = buildCacheKey('dashboard', { role, uid: userId })

    // Intentar servir desde caché
    try {
      const { getCached } = await import('@/lib/redis')
      const cached = await getCached<any>(cacheKey)
      if (cached) return NextResponse.json(cached)
    } catch { /* Redis no disponible — continuar sin caché */ }

    let stats: any = {}

    if (role === 'ADMIN') {
      const now = new Date()
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
        avgFirstResponseTime
      ] = await Promise.all([
        prisma.users.count(),
        prisma.tickets.count(),
        prisma.tickets.count({ where: { status: 'OPEN' } }),
        prisma.tickets.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.tickets.count({ where: { status: 'RESOLVED' } }),
        prisma.tickets.count({ where: { status: 'CLOSED' } }),
        // Tickets urgentes: prioridad HIGH y aún no resueltos
        prisma.tickets.count({ 
          where: { 
            priority: 'HIGH',
            status: { in: ['OPEN', 'IN_PROGRESS'] }
          } 
        }),
        // Tickets vencidos: más de 4h para HIGH, 8h para MEDIUM, 24h para LOW
        prisma.tickets.count({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            OR: [
              {
                priority: 'HIGH',
                createdAt: { lt: new Date(now.getTime() - 4 * 60 * 60 * 1000) }
              },
              {
                priority: 'MEDIUM',
                createdAt: { lt: new Date(now.getTime() - 8 * 60 * 60 * 1000) }
              },
              {
                priority: 'LOW',
                createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
              }
            ]
          }
        }),
        prisma.tickets.count({ 
          where: { 
            createdAt: { 
              gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            } 
          } 
        }),
        prisma.tickets.count({ 
          where: { 
            createdAt: { 
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            } 
          } 
        }),
        prisma.tickets.findMany({
          where: { 
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { not: null }
          },
          select: { createdAt: true, resolvedAt: true }
        }),
        // Estadísticas de planes de resolución
        prisma.resolution_plans.aggregate({
          _count: { id: true },
          _avg: { 
            estimatedHours: true,
            actualHours: true,
            completedTasks: true,
            totalTasks: true
          }
        }),
        // Calcular tiempo promedio de primera respuesta
        calculateAvgResponseTime()
      ])
      
      const avgResolutionTime = calculateAvgResolutionTime(resolvedTicketsWithTime)
      const resolutionRate = totalTickets > 0 ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100) : 0
      
      // Calcular eficiencia de planes (tiempo real vs estimado)
      const planEfficiency = plansStats._avg.estimatedHours && plansStats._avg.actualHours
        ? Math.round((plansStats._avg.estimatedHours / plansStats._avg.actualHours) * 100)
        : 100
      
      // Calcular tasa de completitud de tareas
      const taskCompletionRate = plansStats._avg.totalTasks && plansStats._avg.completedTasks
        ? Math.round((plansStats._avg.completedTasks / plansStats._avg.totalTasks) * 100)
        : 0
      
      stats = {
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
        systemHealth: resolutionRate >= 85 ? 'excellent' : resolutionRate >= 70 ? 'good' : 'needs_attention',
        // Métricas de planes de resolución
        resolutionPlans: {
          total: plansStats._count.id,
          avgEstimatedHours: Math.round((plansStats._avg.estimatedHours || 0) * 10) / 10,
          avgActualHours: Math.round((plansStats._avg.actualHours || 0) * 10) / 10,
          efficiency: planEfficiency,
          taskCompletionRate
        },
        recentActivity: await getRecentActivity(role, userId),
        familyMetrics: await getFamilyMetrics(),
        proactiveAlerts: await getProactiveAlerts(),
      }

      // Familias asignadas al admin (o todas si es super admin)
      const isSuperAdmin = (session.user as any).isSuperAdmin === true
      if (isSuperAdmin) {
        const allFamilies = await prisma.families.findMany({
          where: { isActive: true },
          select: { id: true, name: true, code: true, color: true, icon: true }
        })
        stats.assignedFamilies = allFamilies
        stats.isSuperAdmin = true
      } else {
        const adminFamilies = await prisma.admin_family_assignments.findMany({
          where: { adminId: userId, isActive: true },
          select: {
            family: { select: { id: true, name: true, code: true, color: true, icon: true } }
          }
        })
        stats.assignedFamilies = adminFamilies.map(a => a.family)
        stats.isSuperAdmin = false
      }
    } else if (role === 'TECHNICIAN') {
      // Estadísticas profesionales para técnico
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
        avgFirstResponseTime
      ] = await Promise.all([
        prisma.tickets.count({ where: { assigneeId: userId } }),
        prisma.tickets.count({ where: { assigneeId: userId, status: { in: ['RESOLVED', 'CLOSED'] } } }),
        prisma.tickets.count({ where: { assigneeId: userId, status: 'IN_PROGRESS' } }),
        prisma.tickets.count({ 
          where: { 
            assigneeId: userId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { 
              gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            } 
          } 
        }),
        prisma.tickets.count({ 
          where: { 
            assigneeId: userId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { 
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
            } 
          } 
        }),
        prisma.tickets.count({ where: { assigneeId: userId, priority: 'HIGH' } }),
        prisma.tickets.findMany({
          where: { 
            assigneeId: userId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { not: null }
          },
          select: { createdAt: true, resolvedAt: true }
        }),
        prisma.ticket_ratings.findMany({
          where: { 
            tickets: { assigneeId: userId }
          },
          select: { rating: true }
        }),
        // Estadísticas de mis planes de resolución
        (async () => {
          const myTickets = await prisma.tickets.findMany({
            where: { assigneeId: userId },
            select: { id: true }
          })
          const myTicketIds = myTickets.map(t => t.id)
          
          if (myTicketIds.length === 0) {
            return {
              _count: { id: 0 },
              _avg: {
                estimatedHours: null,
                actualHours: null,
                completedTasks: null,
                totalTasks: null
              }
            }
          }
          
          return prisma.resolution_plans.aggregate({
            where: {
              ticketId: { in: myTicketIds }
            },
            _count: { id: true },
            _avg: { 
              estimatedHours: true,
              actualHours: true,
              completedTasks: true,
              totalTasks: true
            }
          })
        })(),
        // Calcular mi tiempo promedio de primera respuesta
        calculateAvgResponseTime()
      ])
      
      const avgResolutionTime = calculateAvgResolutionTime(resolvedTicketsWithTime)
      const avgRating = ratings.length > 0 
        ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length 
        : 0
      
      // Calcular eficiencia de mis planes
      const myPlanEfficiency = myPlansStats._avg.estimatedHours && myPlansStats._avg.actualHours
        ? Math.round((myPlansStats._avg.estimatedHours / myPlansStats._avg.actualHours) * 100)
        : 100
      
      // Calcular mi tasa de completitud de tareas
      const myTaskCompletionRate = myPlansStats._avg.totalTasks && myPlansStats._avg.completedTasks
        ? Math.round((myPlansStats._avg.completedTasks / myPlansStats._avg.totalTasks) * 100)
        : 0
      
      stats = {
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
        // Métricas de mis planes de resolución
        myResolutionPlans: {
          total: myPlansStats._count.id,
          avgEstimatedHours: Math.round((myPlansStats._avg.estimatedHours || 0) * 10) / 10,
          avgActualHours: Math.round((myPlansStats._avg.actualHours || 0) * 10) / 10,
          efficiency: myPlanEfficiency,
          taskCompletionRate: myTaskCompletionRate
        }
      }

      // Agregar familias asignadas al técnico
      const techFamilies = await prisma.technician_family_assignments.findMany({
        where: { technicianId: userId, isActive: true },
        select: {
          family: { select: { id: true, name: true, code: true, color: true, icon: true } }
        }
      })
      stats.assignedFamilies = techFamilies.map(a => a.family)
      stats.isInventoryManager = (session.user as any).canManageInventory === true

      // Si es gestor de inventario, agregar familias de inventario
      if (stats.isInventoryManager) {
        const invFamilies = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: {
            family: { select: { id: true, name: true, code: true, color: true, icon: true } }
          }
        })
        stats.inventoryFamilies = invFamilies.map(a => a.family)
      }
    } else if (role === 'CLIENT') {
      // Estadísticas profesionales para cliente
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        thisMonthTickets,
        resolvedTicketsWithTime,
        ratings,
        assignedEquipment,
        pendingMaintenance,
      ] = await Promise.all([
        prisma.tickets.count({ where: { clientId: userId } }),
        prisma.tickets.count({ where: { clientId: userId, status: 'OPEN' } }),
        prisma.tickets.count({ where: { clientId: userId, status: 'IN_PROGRESS' } }),
        prisma.tickets.count({ where: { clientId: userId, status: { in: ['RESOLVED', 'CLOSED'] } } }),
        prisma.tickets.count({ 
          where: { 
            clientId: userId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          } 
        }),
        prisma.tickets.findMany({
          where: { 
            clientId: userId,
            status: { in: ['RESOLVED', 'CLOSED'] },
            resolvedAt: { not: null }
          },
          select: { createdAt: true, resolvedAt: true }
        }),
        prisma.ticket_ratings.findMany({
          where: { tickets: { clientId: userId } },
          select: { rating: true }
        }),
        // Equipos asignados al cliente
        prisma.equipment_assignments.count({
          where: { receiverId: userId, isActive: true }
        }),
        // Mantenimientos pendientes: primero obtenemos los equipos del cliente
        prisma.equipment_assignments.findMany({
          where: { receiverId: userId, isActive: true },
          select: { equipmentId: true }
        }).then(async (assignments) => {
          if (assignments.length === 0) return 0
          return prisma.maintenance_records.count({
            where: {
              equipmentId: { in: assignments.map(a => a.equipmentId) },
              status: { in: ['REQUESTED', 'SCHEDULED', 'ACCEPTED'] }
            }
          })
        }),
      ])
      
      const avgResolutionTime = calculateAvgResolutionTime(resolvedTicketsWithTime)
      const avgRating = ratings.length > 0 
        ? ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length 
        : 0
      
      // Contar tickets que pueden ser calificados (RESOLVED o CLOSED sin calificación)
      const ticketsToRate = await prisma.tickets.count({
        where: {
          clientId: userId,
          status: { in: ['RESOLVED', 'CLOSED'] },
          ticket_ratings: null
        }
      })
      
      // Calcular tiempo de respuesta real
      const responseTime = await calculateAvgResponseTime()
      
      stats = {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        thisMonthTickets,
        avgResolutionTime,
        satisfactionRating: Math.round(avgRating * 10) / 10,
        totalRatings: ratings.length,
        ticketsToRate,
        responseTime,
        assignedEquipment,
        pendingMaintenance,
        supportQuality: avgRating >= 4.5 ? 'excellent' : avgRating >= 4 ? 'good' : 'fair'
      }

      // Familias del cliente: las de sus tickets + familias de inventario si es gestor
      const canManageInv = (session.user as any).canManageInventory === true
      stats.isInventoryManager = canManageInv
      if (canManageInv) {
        const invFamilies = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: {
            family: { select: { id: true, name: true, code: true, color: true, icon: true } }
          }
        })
        stats.inventoryFamilies = invFamilies.map(a => a.family)
        stats.assignedFamilies = invFamilies.map(a => a.family)
      } else {
        // Familias de los tickets del cliente
        const clientTicketFamilies = await prisma.tickets.findMany({
          where: { clientId: userId, familyId: { not: null } },
          select: { familyId: true, family: { select: { id: true, name: true, code: true, color: true, icon: true } } },
          distinct: ['familyId']
        })
        stats.assignedFamilies = clientTicketFamilies
          .filter(t => t.family)
          .map(t => t.family!)
      }
    }

    // Guardar en caché antes de responder
    try {
      const { setCache } = await import('@/lib/redis')
      await setCache(cacheKey, stats, ttl)
    } catch { /* Redis no disponible */ }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}