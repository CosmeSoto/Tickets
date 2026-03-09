import prisma from '@/lib/prisma'
import { UserService } from './user-service'
import { randomUUID } from 'crypto'

export interface AssignmentCriteria {
  categoryId?: string
  priority?: string
  workloadBalance?: boolean
  skillMatch?: boolean
}

export class AssignmentService {
  /**
   * Asigna automáticamente un ticket al técnico más apropiado
   */
  static async autoAssignTicket(ticketId: string, criteria: AssignmentCriteria = {}) {
    try {
      // Obtener información del ticket con categoría y departamento
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          categories: {
            include: {
              departments: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              }
            }
          },
        },
      })

      if (!ticket) {
        throw new Error('Ticket no encontrado')
      }

      if (ticket.assigneeId) {
        throw new Error('El ticket ya está asignado')
      }

      // Obtener técnicos disponibles
      let availableTechnicians = await this.getAvailableTechnicians(criteria)

      if (availableTechnicians.length === 0) {
        throw new Error('No hay técnicos disponibles')
      }

      // 🎯 PRIORIZAR técnicos del departamento de la categoría
      if (ticket.categories.departmentId) {
        const techsFromDept = availableTechnicians.filter(
          t => t.departmentId === ticket.categories.departmentId
        )
        
        if (techsFromDept.length > 0) {
          availableTechnicians = techsFromDept
        }
      }

      // Calcular el mejor técnico
      const bestTechnician = await this.calculateBestTechnician(
        ticket,
        availableTechnicians,
        criteria
      )

      // Asignar el ticket
      const updatedTicket = await prisma.tickets.update({
        where: { id: ticketId },
        data: {
          assigneeId: bestTechnician.id,
          status: 'IN_PROGRESS',
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          users_tickets_assigneeIdTousers: { 
            select: { id: true, name: true, email: true } 
          },
          users_tickets_clientIdTousers: { 
            select: { id: true, name: true, email: true } 
          },
          categories: { 
            select: { id: true, name: true, color: true, departmentId: true } 
          },
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'auto_assigned',
          comment: `Ticket asignado automáticamente a ${bestTechnician.name}`,
          ticketId,
          userId: bestTechnician.id,
          createdAt: new Date()
        },
      })

      // Verificar si ya existe una asignación para este técnico y categoría
      const existingAssignment = await prisma.technician_assignments.findUnique({
        where: {
          technicianId_categoryId: {
            technicianId: bestTechnician.id,
            categoryId: ticket.categoryId,
          }
        }
      })

      // Solo crear si no existe (evitar duplicados por el constraint unique)
      if (!existingAssignment) {
        await prisma.technician_assignments.create({
          data: {
            id: randomUUID(),
            technicianId: bestTechnician.id,
            categoryId: ticket.categoryId,
            priority: 5, // Prioridad media por defecto
            maxTickets: 10,
            autoAssign: true,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }

      // ⭐ NUEVO: Enviar notificaciones de asignación
      const { NotificationService } = await import('./notification-service')
      await NotificationService.notifyTicketAssigned(ticketId, bestTechnician.id).catch(err => {
        console.error('[AUTO-ASSIGN] Error enviando notificaciones:', err)
      })

      return {
        ticket: updatedTicket,
        assignedTechnician: bestTechnician,
        reason: bestTechnician.assignmentReason,
      }
    } catch (error) {
      console.error('[CRITICAL] Error en asignación automática:', error)
      throw error
    }
  }

  /**
   * Obtiene técnicos disponibles según criterios
   */
  private static async getAvailableTechnicians(criteria: AssignmentCriteria) {
    const where: any = {
      role: 'TECHNICIAN',
      isActive: true,
    }

    const technicians = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
    })

    // Filtrar técnicos con especialización en la categoría si se especifica
    if (criteria.categoryId && criteria.skillMatch) {
      const specializedTechnicians = await prisma.technician_assignments.findMany({
        where: {
          categoryId: criteria.categoryId,
          isActive: true,
        },
        select: {
          technicianId: true,
        },
      })

      const specializedIds = specializedTechnicians.map(t => t.technicianId)

      if (specializedIds.length > 0) {
        return technicians.filter(t => specializedIds.includes(t.id))
      }
    }

    return technicians
  }

  /**
   * Calcula el mejor técnico para asignar el ticket
   */
  private static async calculateBestTechnician(
    ticket: any,
    technicians: any[],
    criteria: AssignmentCriteria
  ) {
    const scoredTechnicians = await Promise.all(
      technicians.map(async technician => {
        let score = 0
        const reasons: string[] = []

        // Factor 1: Departamento coincidente (50% del peso si aplica)
        if (ticket.categories.departmentId && technician.departmentId === ticket.categories.departmentId) {
          score += 0.5
          reasons.push(`Departamento: ${technician.department?.name}`)
        }

        // Factor 2: Carga de trabajo (30% del peso)
        if (criteria.workloadBalance !== false) {
          const workloadScore = this.calculateWorkloadScore(technician._count.tickets_tickets_assigneeIdTousers)
          score += workloadScore * 0.3
          reasons.push(`Carga: ${technician._count.tickets_tickets_assigneeIdTousers} tickets activos`)
        }

        // Factor 3: Especialización en categoría (15% del peso)
        if (criteria.skillMatch !== false && criteria.categoryId) {
          const skillScore = await this.calculateSkillScore(technician.id, criteria.categoryId)
          score += skillScore * 0.15
          if (skillScore > 0) {
            reasons.push('Especializado en esta categoría')
          }
        }

        // Factor 4: Disponibilidad temporal (5% del peso)
        const availabilityScore = await this.calculateAvailabilityScore(technician.id)
        score += availabilityScore * 0.05
        if (availabilityScore > 0.5) {
          reasons.push('Alta disponibilidad')
        }

        return {
          ...technician,
          score,
          assignmentReason: reasons.join(', ') || 'Asignación por disponibilidad',
        }
      })
    )

    // Ordenar por puntuación y devolver el mejor
    scoredTechnicians.sort((a, b) => b.score - a.score)
    
    return scoredTechnicians[0]
  }

  /**
   * Calcula puntuación basada en carga de trabajo (menos carga = mayor puntuación)
   */
  private static calculateWorkloadScore(activeTickets: number): number {
    // Máximo 10 tickets activos para puntuación completa
    const maxTickets = 10
    return Math.max(0, (maxTickets - activeTickets) / maxTickets)
  }

  /**
   * Calcula puntuación basada en especialización en categoría
   */
  private static async calculateSkillScore(
    technicianId: string,
    categoryId: string
  ): Promise<number> {
    // Verificar si tiene asignación activa en esta categoría
    const assignment = await prisma.technician_assignments.findFirst({
      where: {
        technicianId,
        categoryId,
        isActive: true,
      },
    })

    if (assignment) return 1.0

    // Verificar experiencia previa en la categoría
    const experienceCount = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        categoryId,
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
    })

    // Puntuación basada en experiencia (máximo 5 tickets para puntuación completa)
    return Math.min(1.0, experienceCount / 5)
  }

  /**
   * Calcula puntuación basada en manejo de tickets de alta prioridad
   */
  private static async calculatePriorityHandlingScore(technicianId: string): Promise<number> {
    const highPriorityResolved = await prisma.tickets.count({
      where: {
        assigneeId: technicianId,
        priority: { in: ['HIGH', 'URGENT'] },
        status: { in: ['RESOLVED', 'CLOSED'] },
      },
    })

    // Puntuación basada en tickets de alta prioridad resueltos (máximo 10 para puntuación completa)
    return Math.min(1.0, highPriorityResolved / 10)
  }

  /**
   * Calcula puntuación basada en disponibilidad (últimas horas de actividad)
   */
  private static async calculateAvailabilityScore(technicianId: string): Promise<number> {
    const user = await prisma.users.findUnique({
      where: { id: technicianId },
      select: { lastLogin: true },
    })

    if (!user?.lastLogin) return 0.5 // Puntuación neutral si no hay datos

    const now = new Date()
    const lastLogin = new Date(user.lastLogin)
    const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60)

    // Puntuación alta si se conectó en las últimas 8 horas
    if (hoursSinceLogin <= 8) return 1.0
    if (hoursSinceLogin <= 24) return 0.7
    if (hoursSinceLogin <= 72) return 0.4
    return 0.2
  }

  /**
   * Obtiene estadísticas de asignación automática
   */
  static async getAssignmentStats() {
    const [totalAutoAssignments, successfulAssignments, avgAssignmentTime, technicianWorkloads] =
      await Promise.all([
        prisma.ticket_history.count({
          where: { action: 'auto_assigned' },
        }),
        prisma.tickets.count({
          where: {
            assigneeId: { not: null },
            status: { in: ['RESOLVED', 'CLOSED'] },
          },
        }),
        this.calculateAverageAssignmentTime(),
        this.getTechnicianWorkloads(),
      ])

    return {
      totalAutoAssignments,
      successfulAssignments,
      avgAssignmentTime,
      technicianWorkloads,
      successRate:
        totalAutoAssignments > 0 ? (successfulAssignments / totalAutoAssignments) * 100 : 0,
    }
  }

  /**
   * Calcula tiempo promedio de asignación
   */
  private static async calculateAverageAssignmentTime(): Promise<string> {
    const assignments = await prisma.ticket_history.findMany({
      where: { action: 'auto_assigned' },
      select: {
        createdAt: true,
        tickets: {
          select: { createdAt: true },
        },
      },
      take: 100, // Últimas 100 asignaciones
    })

    if (assignments.length === 0) return '0min'

    const totalMinutes = assignments.reduce((acc, assignment) => {
      const diff =
        new Date(assignment.createdAt).getTime() - new Date(assignment.tickets.createdAt).getTime()
      return acc + diff / (1000 * 60)
    }, 0)

    const avgMinutes = totalMinutes / assignments.length
    const hours = Math.floor(avgMinutes / 60)
    const minutes = Math.floor(avgMinutes % 60)

    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`
  }

  /**
   * Obtiene cargas de trabajo de técnicos
   */
  private static async getTechnicianWorkloads() {
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tickets_tickets_assigneeIdTousers: {
              where: {
                status: { in: ['OPEN', 'IN_PROGRESS'] },
              },
            },
          },
        },
      },
      orderBy: {
        tickets_tickets_assigneeIdTousers: {
          _count: 'desc',
        },
      },
    })

    return technicians.map(tech => ({
      id: tech.id,
      name: tech.name,
      activeTickets: tech._count.tickets_tickets_assigneeIdTousers,
      workloadLevel: this.getWorkloadLevel(tech._count.tickets_tickets_assigneeIdTousers),
    }))
  }

  /**
   * Determina el nivel de carga de trabajo
   */
  private static getWorkloadLevel(activeTickets: number): string {
    if (activeTickets <= 3) return 'Baja'
    if (activeTickets <= 6) return 'Media'
    if (activeTickets <= 10) return 'Alta'
    return 'Sobrecargado'
  }

  /**
   * Reasigna un ticket a otro técnico
   */
  static async reassignTicket(ticketId: string, newTechnicianId: string, userId: string) {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        users_tickets_assigneeIdTousers: { select: { name: true } },
      },
    })

    if (!ticket) {
      throw new Error('Ticket no encontrado')
    }

    const newTechnician = await prisma.users.findUnique({
      where: { id: newTechnicianId },
      select: { name: true, role: true },
    })

    if (!newTechnician || newTechnician.role !== 'TECHNICIAN') {
      throw new Error('Técnico no válido')
    }

    const updatedTicket = await prisma.tickets.update({
      where: { id: ticketId },
      data: { assigneeId: newTechnicianId },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        users_tickets_assigneeIdTousers: { 
          select: { id: true, name: true, email: true } 
        },
        users_tickets_clientIdTousers: { 
          select: { id: true, name: true, email: true } 
        },
        categories: { 
          select: { id: true, name: true, color: true } 
        },
      },
    })

    // Crear entrada en el historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'reassigned',
        comment: `Ticket reasignado a ${newTechnician.name}`,
        ticketId,
        userId,
        createdAt: new Date()
      },
    })

    return updatedTicket
  }
}
