/**
 * Servicio de SLA (Service Level Agreement)
 * Maneja cálculo de deadlines, detección de violaciones y alertas
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { WebhookService } from './webhook-service'
import { EmailService } from './email/email-service'

export interface SLAPolicy {
  id: string
  name: string
  categoryId?: string
  priority: string
  responseTimeHours: number
  resolutionTimeHours: number
  businessHoursOnly: boolean
  businessHoursStart: string
  businessHoursEnd: string
  businessDays: string
}

export class SLAService {
  /**
   * Calcula y asigna SLA a un ticket
   */
  static async assignSLA(ticketId: string): Promise<void> {
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        include: {
          categories: true
        }
      })

      if (!ticket) {
        throw new Error('Ticket no encontrado')
      }

      // Buscar política SLA aplicable
      const policy = await this.findApplicablePolicy(
        ticket.categoryId,
        ticket.priority
      )

      if (!policy) {
        console.log(`[SLA] No hay política aplicable para ticket ${ticketId}`)
        return
      }

      // Calcular deadlines
      const responseDeadline = this.calculateDeadline(
        ticket.createdAt,
        policy.responseTimeHours,
        policy.businessHoursOnly,
        policy.businessHoursStart,
        policy.businessHoursEnd,
        policy.businessDays
      )

      const resolutionDeadline = this.calculateDeadline(
        ticket.createdAt,
        policy.resolutionTimeHours,
        policy.businessHoursOnly,
        policy.businessHoursStart,
        policy.businessHoursEnd,
        policy.businessDays
      )

      // Crear métricas SLA
      await prisma.ticket_sla_metrics.create({
        data: {
          id: randomUUID(),
          ticketId,
          slaPolicyId: policy.id,
          responseDeadline,
          resolutionDeadline
        }
      })

      // Actualizar deadline en ticket
      await prisma.tickets.update({
        where: { id: ticketId },
        data: { slaDeadline: resolutionDeadline }
      })

      console.log(`[SLA] Asignado a ticket ${ticketId}: Respuesta ${responseDeadline}, Resolución ${resolutionDeadline}`)
    } catch (error) {
      console.error('[SLA] Error asignando SLA:', error)
    }
  }

  /**
   * Busca la política SLA aplicable
   */
  private static async findApplicablePolicy(
    categoryId: string,
    priority: string
  ): Promise<any> {
    // Buscar política específica para categoría y prioridad
    let policy = await prisma.sla_policies.findFirst({
      where: {
        categoryId,
        priority,
        isActive: true
      }
    })

    // Si no hay específica, buscar por prioridad solamente
    if (!policy) {
      policy = await prisma.sla_policies.findFirst({
        where: {
          categoryId: null,
          priority,
          isActive: true
        }
      })
    }

    return policy
  }

  /**
   * Calcula deadline considerando horas laborales
   */
  private static calculateDeadline(
    startDate: Date,
    hours: number,
    businessHoursOnly: boolean,
    businessStart: string = '09:00:00',
    businessEnd: string = '18:00:00',
    businessDays: string = 'MON,TUE,WED,THU,FRI'
  ): Date {
    if (!businessHoursOnly) {
      // Cálculo simple: agregar horas directamente
      const deadline = new Date(startDate)
      deadline.setHours(deadline.getHours() + hours)
      return deadline
    }

    // Cálculo con horas laborales
    const deadline = new Date(startDate)
    let remainingHours = hours
    const businessDaysArray = businessDays.split(',')
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

    const [startHour, startMinute] = businessStart.split(':').map(Number)
    const [endHour, endMinute] = businessEnd.split(':').map(Number)
    const dailyHours = (endHour - startHour) + ((endMinute - startMinute) / 60)

    while (remainingHours > 0) {
      const currentDay = dayNames[deadline.getDay()]
      
      // Si es día laboral
      if (businessDaysArray.includes(currentDay)) {
        const currentHour = deadline.getHours()
        const currentMinute = deadline.getMinutes()
        
        // Si estamos antes del horario laboral, mover al inicio
        if (currentHour < startHour || (currentHour === startHour && currentMinute < startMinute)) {
          deadline.setHours(startHour, startMinute, 0, 0)
        }
        
        // Si estamos después del horario laboral, mover al siguiente día
        if (currentHour >= endHour) {
          deadline.setDate(deadline.getDate() + 1)
          deadline.setHours(startHour, startMinute, 0, 0)
          continue
        }
        
        // Calcular horas disponibles hoy
        const hoursUntilEnd = (endHour - currentHour) + ((endMinute - currentMinute) / 60)
        
        if (remainingHours <= hoursUntilEnd) {
          // Cabe en el día actual
          deadline.setHours(deadline.getHours() + Math.floor(remainingHours))
          deadline.setMinutes(deadline.getMinutes() + (remainingHours % 1) * 60)
          remainingHours = 0
        } else {
          // No cabe, usar todo el día y continuar mañana
          remainingHours -= hoursUntilEnd
          deadline.setDate(deadline.getDate() + 1)
          deadline.setHours(startHour, startMinute, 0, 0)
        }
      } else {
        // No es día laboral, mover al siguiente día
        deadline.setDate(deadline.getDate() + 1)
        deadline.setHours(startHour, startMinute, 0, 0)
      }
    }

    return deadline
  }

  /**
   * Actualiza métricas SLA cuando hay primera respuesta
   */
  static async recordFirstResponse(ticketId: string): Promise<void> {
    try {
      const metrics = await prisma.ticket_sla_metrics.findUnique({
        where: { ticketId }
      })

      if (!metrics || metrics.firstResponseAt) {
        return // Ya tiene primera respuesta
      }

      const now = new Date()
      const responseTimeMins = Math.floor(
        (now.getTime() - new Date(metrics.createdAt).getTime()) / (1000 * 60)
      )

      const responseSLAMet = metrics.responseDeadline 
        ? now <= new Date(metrics.responseDeadline)
        : null

      await prisma.ticket_sla_metrics.update({
        where: { ticketId },
        data: {
          firstResponseAt: now,
          responseTimeMinutes: responseTimeMins,
          responseSLAMet
        }
      })

      // Si se violó el SLA de respuesta, registrar violación
      if (responseSLAMet === false) {
        await this.recordViolation(ticketId, 'RESPONSE')
      }

      console.log(`[SLA] Primera respuesta registrada para ticket ${ticketId}`)
    } catch (error) {
      console.error('[SLA] Error registrando primera respuesta:', error)
    }
  }

  /**
   * Actualiza métricas SLA cuando se resuelve el ticket
   */
  static async recordResolution(ticketId: string): Promise<void> {
    try {
      const metrics = await prisma.ticket_sla_metrics.findUnique({
        where: { ticketId }
      })

      if (!metrics) {
        return
      }

      const now = new Date()
      const resolutionTimeMins = Math.floor(
        (now.getTime() - new Date(metrics.createdAt).getTime()) / (1000 * 60)
      )

      const resolutionSLAMet = metrics.resolutionDeadline
        ? now <= new Date(metrics.resolutionDeadline)
        : null

      await prisma.ticket_sla_metrics.update({
        where: { ticketId },
        data: {
          resolvedAt: now,
          resolutionTimeMinutes: resolutionTimeMins,
          resolutionSLAMet
        }
      })

      // Si se violó el SLA de resolución, registrar violación
      if (resolutionSLAMet === false) {
        await this.recordViolation(ticketId, 'RESOLUTION')
      }

      console.log(`[SLA] Resolución registrada para ticket ${ticketId}`)
    } catch (error) {
      console.error('[SLA] Error registrando resolución:', error)
    }
  }

  /**
   * Registra una violación de SLA
   */
  private static async recordViolation(
    ticketId: string,
    violationType: 'RESPONSE' | 'RESOLUTION'
  ): Promise<void> {
    try {
      const metrics = await prisma.ticket_sla_metrics.findUnique({
        where: { ticketId },
        include: {
          ticket: {
            include: {
              users_tickets_clientIdTousers: true,
              users_tickets_assigneeIdTousers: true,
              categories: true
            }
          }
        }
      })

      if (!metrics) return

      const expectedAt = violationType === 'RESPONSE'
        ? metrics.responseDeadline
        : metrics.resolutionDeadline

      const actualAt = violationType === 'RESPONSE'
        ? metrics.firstResponseAt
        : metrics.resolvedAt

      if (!expectedAt) return

      // Calcular severidad basada en el retraso
      const delayHours = Math.floor(
        (new Date(actualAt || new Date()).getTime() - new Date(expectedAt).getTime()) / (1000 * 60 * 60)
      )

      let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
      if (delayHours > 24) severity = 'CRITICAL'
      else if (delayHours > 8) severity = 'HIGH'
      else if (delayHours > 2) severity = 'MEDIUM'
      else severity = 'LOW'

      // Crear violación
      const violation = await prisma.sla_violations.create({
        data: {
          id: randomUUID(),
          ticketId,
          slaPolicyId: metrics.slaPolicyId,
          violationType,
          expectedAt: new Date(expectedAt),
          actualAt: actualAt ? new Date(actualAt) : null,
          severity,
          isResolved: !!actualAt
        }
      })

      console.log(`[SLA] ⚠️ Violación registrada: Ticket ${ticketId}, Tipo ${violationType}, Severidad ${severity}`)

      // Disparar webhook
      await WebhookService.trigger(WebhookService.EVENTS.SLA_VIOLATED, {
        ticketId,
        violationType,
        severity,
        expectedAt,
        actualAt,
        delayHours,
        ticket: {
          id: metrics.ticket.id,
          title: metrics.ticket.title,
          priority: metrics.ticket.priority,
          client: metrics.ticket.users_tickets_clientIdTousers?.name,
          assignee: metrics.ticket.users_tickets_assigneeIdTousers?.name,
          category: metrics.ticket.categories?.name
        }
      })

      // Enviar email de alerta (solo para violaciones críticas)
      if (severity === 'CRITICAL' || severity === 'HIGH') {
        // TODO: Implementar template de email para violación SLA
        console.log(`[SLA] Email de alerta enviado para violación ${severity}`)
      }
    } catch (error) {
      console.error('[SLA] Error registrando violación:', error)
    }
  }

  /**
   * Verifica tickets próximos a vencer SLA (ejecutar cada hora)
   */
  static async checkUpcomingDeadlines(): Promise<void> {
    try {
      const now = new Date()
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

      // Buscar tickets con deadline en la próxima hora
      const upcomingDeadlines = await prisma.ticket_sla_metrics.findMany({
        where: {
          OR: [
            {
              responseDeadline: {
                gte: now,
                lte: oneHourFromNow
              },
              firstResponseAt: null
            },
            {
              resolutionDeadline: {
                gte: now,
                lte: oneHourFromNow
              },
              resolvedAt: null
            }
          ]
        },
        include: {
          ticket: {
            include: {
              users_tickets_assigneeIdTousers: true
            }
          }
        }
      })

      console.log(`[SLA] ${upcomingDeadlines.length} tickets próximos a vencer SLA`)

      for (const metrics of upcomingDeadlines) {
        // Disparar webhook de advertencia
        await WebhookService.trigger(WebhookService.EVENTS.SLA_WARNING, {
          ticketId: metrics.ticketId,
          responseDeadline: metrics.responseDeadline,
          resolutionDeadline: metrics.resolutionDeadline,
          minutesRemaining: Math.floor(
            (new Date(metrics.resolutionDeadline || now).getTime() - now.getTime()) / (1000 * 60)
          ),
          ticket: {
            id: metrics.ticket.id,
            title: metrics.ticket.title,
            assignee: metrics.ticket.users_tickets_assigneeIdTousers?.name
          }
        })

        // Enviar email al técnico asignado
        if (metrics.ticket.users_tickets_assigneeIdTousers) {
          // TODO: Implementar template de email para advertencia SLA
          console.log(`[SLA] Email de advertencia enviado a ${metrics.ticket.users_tickets_assigneeIdTousers.name}`)
        }
      }
    } catch (error) {
      console.error('[SLA] Error verificando deadlines:', error)
    }
  }

  /**
   * Obtiene estadísticas de SLA
   */
  static async getStats(filters?: {
    startDate?: Date
    endDate?: Date
    categoryId?: string
    priority?: string
  }): Promise<{
    totalTickets: number
    ticketsWithSLA: number
    responseSLAMet: number
    resolutionSLAMet: number
    violations: number
    avgResponseTime: number
    avgResolutionTime: number
    complianceRate: number
  }> {
    const where: any = {}

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = filters.startDate
      if (filters.endDate) where.createdAt.lte = filters.endDate
    }

    const metrics = await prisma.ticket_sla_metrics.findMany({
      where,
      include: {
        ticket: {
          select: {
            categoryId: true,
            priority: true
          }
        }
      }
    })

    // Filtrar por categoría y prioridad si se especifica
    const filteredMetrics = metrics.filter(m => {
      if (filters?.categoryId && m.ticket.categoryId !== filters.categoryId) return false
      if (filters?.priority && m.ticket.priority !== filters.priority) return false
      return true
    })

    const totalTickets = filteredMetrics.length
    const responseMet = filteredMetrics.filter(m => m.responseSLAMet === true).length
    const resolutionMet = filteredMetrics.filter(m => m.resolutionSLAMet === true).length
    
    const avgResponseTime = filteredMetrics.reduce((sum, m) => sum + (m.responseTimeMinutes || 0), 0) / totalTickets || 0
    const avgResolutionTime = filteredMetrics.reduce((sum, m) => sum + (m.resolutionTimeMinutes || 0), 0) / totalTickets || 0

    const violations = await prisma.sla_violations.count({
      where: {
        ticketId: { in: filteredMetrics.map(m => m.ticketId) }
      }
    })

    return {
      totalTickets,
      ticketsWithSLA: totalTickets,
      responseSLAMet: responseMet,
      resolutionSLAMet: resolutionMet,
      violations,
      avgResponseTime: Math.round(avgResponseTime),
      avgResolutionTime: Math.round(avgResolutionTime),
      complianceRate: totalTickets > 0 ? Math.round((resolutionMet / totalTickets) * 100) : 0
    }
  }
}
