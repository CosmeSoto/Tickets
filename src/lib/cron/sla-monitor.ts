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
    
    const overdueTickets = await prisma.ticket_sla_metrics.findMany({
      where: {
        OR: [
          { responseDeadline: { lt: now }, firstResponseAt: null, responseSLAMet: null },
          { resolutionDeadline: { lt: now }, resolvedAt: null, resolutionSLAMet: null }
        ]
      },
      select: {
        id: true,
        ticketId: true,
        slaPolicyId: true,
        firstResponseAt: true,
        responseDeadline: true,
        resolutionDeadline: true,
        createdAt: true,
        ticket: {
          select: {
            assigneeId: true,
            users_tickets_assigneeIdTousers: { select: { id: true, name: true } }
          }
        }
      }
    })
    
    if (overdueTickets.length === 0) return
    console.log(`[SLA MONITOR] ${overdueTickets.length} tickets con SLA vencido detectados`)

    // Batch: obtener todas las violaciones existentes en una sola query
    const ticketIds = overdueTickets.map(m => m.ticketId)
    const existingViolations = await prisma.sla_violations.findMany({
      where: { ticketId: { in: ticketIds }, isResolved: false },
      select: { ticketId: true, violationType: true }
    })
    const violationSet = new Set(
      existingViolations.map(v => `${v.ticketId}:${v.violationType}`)
    )

    // Preparar creaciones en batch
    const toCreate: Parameters<typeof prisma.sla_violations.createMany>[0]['data'] = []

    for (const metrics of overdueTickets) {
      const violationType = metrics.firstResponseAt === null ? 'RESPONSE' : 'RESOLUTION'
      const key = `${metrics.ticketId}:${violationType}`
      if (violationSet.has(key)) continue

      const expectedAt = violationType === 'RESPONSE'
        ? metrics.responseDeadline
        : metrics.resolutionDeadline
      if (!expectedAt) continue

      const delayHours = Math.floor((now.getTime() - new Date(expectedAt).getTime()) / 3_600_000)
      const severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
        delayHours > 24 ? 'CRITICAL' : delayHours > 8 ? 'HIGH' : delayHours > 2 ? 'MEDIUM' : 'LOW'

      toCreate.push({
        ticketId: metrics.ticketId,
        slaPolicyId: metrics.slaPolicyId,
        violationType,
        expectedAt: new Date(expectedAt),
        actualAt: null,
        severity,
        isResolved: false,
      })
    }

    if (toCreate.length > 0) {
      await prisma.sla_violations.createMany({ data: toCreate, skipDuplicates: true })
      console.log(`[SLA MONITOR] ${toCreate.length} nuevas violaciones registradas`)
    }
  }
  
  /**
   * Actualizar métricas de tickets abiertos
   */
  private static async updateOpenTicketsMetrics(): Promise<void> {
    const now = new Date()

    // Batch update: una sola query en lugar de N queries individuales
    const result = await prisma.ticket_sla_metrics.updateMany({
      where: {
        ticket: { status: { in: ['OPEN', 'IN_PROGRESS', 'PENDING'] } }
      },
      data: { updatedAt: now }
    })

    console.log(`[SLA MONITOR] ${result.count} métricas de tickets abiertos actualizadas`)
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
