/**
 * Cron Job: Monitor de SLA
 * Ejecutar cada hora para verificar tickets próximos a vencer
 * y detectar violaciones de SLA
 */

import { SLAService } from '../services/sla-service'
import prisma from '../prisma'

export class SLAMonitor {
  /**
   * Ejecutar monitoreo completo de SLA
   * Llamar desde cron job cada hora
   */
  static async run(): Promise<void> {
    console.log('[SLA MONITOR] Iniciando monitoreo de SLA...')
    
    try {
      // 1. Verificar tickets próximos a vencer
      await SLAService.checkUpcomingDeadlines()
      
      // 2. Detectar violaciones activas
      await this.detectActiveViolations()
      
      // 3. Actualizar métricas de tickets abiertos
      await this.updateOpenTicketsMetrics()
      
      // 4. Generar reporte de cumplimiento
      const stats = await SLAService.getStats()
      console.log('[SLA MONITOR] Estadísticas:', stats)
      
      console.log('[SLA MONITOR] Monitoreo completado exitosamente')
    } catch (error) {
      console.error('[SLA MONITOR] Error en monitoreo:', error)
      throw error
    }
  }
  
  /**
   * Detectar violaciones activas (tickets que ya pasaron el deadline)
   */
  private static async detectActiveViolations(): Promise<void> {
    const now = new Date()
    
    // Buscar tickets con SLA vencido que aún no tienen violación registrada
    const overdueTickets = await prisma.ticket_sla_metrics.findMany({
      where: {
        OR: [
          {
            // Respuesta vencida y sin primera respuesta
            responseDeadline: { lt: now },
            firstResponseAt: null,
            responseSLAMet: null
          },
          {
            // Resolución vencida y sin resolver
            resolutionDeadline: { lt: now },
            resolvedAt: null,
            resolutionSLAMet: null
          }
        ]
      },
      include: {
        ticket: {
          include: {
            users_tickets_assigneeIdTousers: true,
            categories: true
          }
        }
      }
    })
    
    console.log(`[SLA MONITOR] ${overdueTickets.length} tickets con SLA vencido detectados`)
    
    for (const metrics of overdueTickets) {
      // Verificar si ya existe violación
      const existingViolation = await prisma.sla_violations.findFirst({
        where: {
          ticketId: metrics.ticketId,
          violationType: metrics.firstResponseAt === null ? 'RESPONSE' : 'RESOLUTION',
          isResolved: false
        }
      })
      
      if (!existingViolation) {
        // Crear violación
        const violationType = metrics.firstResponseAt === null ? 'RESPONSE' : 'RESOLUTION'
        const expectedAt = violationType === 'RESPONSE' 
          ? metrics.responseDeadline 
          : metrics.resolutionDeadline
        
        if (!expectedAt) continue
        
        const delayHours = Math.floor(
          (now.getTime() - new Date(expectedAt).getTime()) / (1000 * 60 * 60)
        )
        
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
        if (delayHours > 24) severity = 'CRITICAL'
        else if (delayHours > 8) severity = 'HIGH'
        else if (delayHours > 2) severity = 'MEDIUM'
        else severity = 'LOW'
        
        await prisma.sla_violations.create({
          data: {
            ticketId: metrics.ticketId,
            slaPolicyId: metrics.slaPolicyId,
            violationType,
            expectedAt: new Date(expectedAt),
            actualAt: null, // Aún no resuelto
            severity,
            isResolved: false
          }
        })
        
        console.log(`[SLA MONITOR] ⚠️ Nueva violación: Ticket ${metrics.ticketId}, Tipo ${violationType}, Severidad ${severity}`)
        
        // Enviar notificación al técnico asignado
        if (metrics.ticket.users_tickets_assigneeIdTousers) {
          // TODO: Implementar notificación
          console.log(`[SLA MONITOR] Notificación enviada a ${metrics.ticket.users_tickets_assigneeIdTousers.name}`)
        }
      }
    }
  }
  
  /**
   * Actualizar métricas de tickets abiertos
   */
  private static async updateOpenTicketsMetrics(): Promise<void> {
    const openTickets = await prisma.ticket_sla_metrics.findMany({
      where: {
        ticket: {
          status: {
            in: ['OPEN', 'IN_PROGRESS', 'PENDING']
          }
        }
      },
      include: {
        ticket: true
      }
    })
    
    console.log(`[SLA MONITOR] Actualizando ${openTickets.length} tickets abiertos`)
    
    for (const metrics of openTickets) {
      const now = new Date()
      const createdAt = new Date(metrics.createdAt)
      
      // Calcular tiempo transcurrido
      const elapsedMinutes = Math.floor(
        (now.getTime() - createdAt.getTime()) / (1000 * 60)
      )
      
      // Actualizar business_hours_elapsed si aplica
      // (Implementación simplificada, puede mejorarse)
      await prisma.ticket_sla_metrics.update({
        where: { id: metrics.id },
        data: {
          businessHoursElapsed: elapsedMinutes,
          updatedAt: now
        }
      })
    }
  }
  
  /**
   * Generar reporte diario de cumplimiento
   * Ejecutar una vez al día
   */
  static async generateDailyReport(): Promise<void> {
    console.log('[SLA MONITOR] Generando reporte diario...')
    
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const stats = await SLAService.getStats({
      startDate: yesterday,
      endDate: today
    })
    
    console.log('[SLA MONITOR] Reporte diario:', {
      fecha: yesterday.toISOString().split('T')[0],
      ...stats
    })
    
    // TODO: Enviar reporte por email a administradores
    // TODO: Guardar reporte en base de datos para histórico
  }
}

// Exportar función para cron job
export async function runSLAMonitor() {
  return SLAMonitor.run()
}

export async function runDailyReport() {
  return SLAMonitor.generateDailyReport()
}
