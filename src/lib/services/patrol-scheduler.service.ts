/**
 * Servicio de programación y mantenimiento de patrullas.
 *
 * Responsabilidades:
 * - Generar instancias patrol (PENDING) a partir de un schedule
 * - Detectar y marcar patrullas MISSED cuando pasa el grace period
 * - Notificar supervisores sobre patrullas perdidas
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { NotificationType, PatrolRecurrence } from '@prisma/client'

export class PatrolSchedulerService {
  // ── Generación de patrullas ─────────────────────────────────────────────────

  /**
   * Genera instancias patrol (PENDING) para un schedule dado.
   * Calcula las ocurrencias dentro del horizonte de días especificado.
   * Usa skipDuplicates para ser idempotente (seguro de llamar múltiples veces).
   *
   * @param scheduleId   - ID del schedule
   * @param horizonDays  - Días hacia adelante para generar patrullas (default 30)
   * @returns Número de patrullas creadas
   */
  static async generatePatrols(scheduleId: string, horizonDays = 30): Promise<number> {
    const schedule = await prisma.patrol_schedules.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        familyId: true,
        routeId: true,
        guardId: true,
        scheduledStart: true,
        scheduledEnd: true,
        recurrence: true,
        recurrenceDays: true,
        isActive: true,
      },
    })

    if (!schedule || !schedule.isActive) return 0

    const occurrences = this.calculateOccurrences(schedule, horizonDays)

    if (occurrences.length === 0) return 0

    const result = await prisma.patrols.createMany({
      data: occurrences.map(({ start, end }) => ({
        id: randomUUID(),
        familyId: schedule.familyId,
        scheduleId: schedule.id,
        routeId: schedule.routeId,
        guardId: schedule.guardId,
        scheduledStart: start,
        scheduledEnd: end,
      })),
      skipDuplicates: true,
    })

    return result.count
  }

  /**
   * Calcula las fechas de ocurrencia para un schedule dentro del horizonte.
   */
  private static calculateOccurrences(
    schedule: {
      scheduledStart: Date
      scheduledEnd: Date
      recurrence: PatrolRecurrence
      recurrenceDays: number[]
    },
    horizonDays: number
  ): Array<{ start: Date; end: Date }> {
    const occurrences: Array<{ start: Date; end: Date }> = []
    const horizonEnd = new Date()
    horizonEnd.setDate(horizonEnd.getDate() + horizonDays)

    const durationMs = schedule.scheduledEnd.getTime() - schedule.scheduledStart.getTime()

    switch (schedule.recurrence) {
      case PatrolRecurrence.NONE: {
        // Una sola ocurrencia
        if (schedule.scheduledStart <= horizonEnd) {
          occurrences.push({
            start: schedule.scheduledStart,
            end: schedule.scheduledEnd,
          })
        }
        break
      }

      case PatrolRecurrence.DAILY: {
        // Una ocurrencia por día desde scheduledStart hasta el horizonte
        const cursor = new Date(schedule.scheduledStart)
        while (cursor <= horizonEnd) {
          occurrences.push({
            start: new Date(cursor),
            end: new Date(cursor.getTime() + durationMs),
          })
          cursor.setDate(cursor.getDate() + 1)
        }
        break
      }

      case PatrolRecurrence.WEEKLY:
      case PatrolRecurrence.CUSTOM: {
        // Ocurrencias en los días de la semana especificados en recurrenceDays
        // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const days = new Set(schedule.recurrenceDays)
        if (days.size === 0) break

        const cursor = new Date(schedule.scheduledStart)
        // Retroceder al inicio de la semana del scheduledStart para no perder días
        while (cursor <= horizonEnd) {
          if (days.has(cursor.getDay())) {
            // Mantener la hora del scheduledStart original
            const start = new Date(cursor)
            start.setHours(
              schedule.scheduledStart.getHours(),
              schedule.scheduledStart.getMinutes(),
              schedule.scheduledStart.getSeconds(),
              0
            )
            if (start >= schedule.scheduledStart && start <= horizonEnd) {
              occurrences.push({
                start,
                end: new Date(start.getTime() + durationMs),
              })
            }
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        break
      }
    }

    return occurrences
  }

  // ── Detección de patrullas perdidas ─────────────────────────────────────────

  /**
   * Detecta patrullas PENDING que superaron el grace period sin iniciarse
   * y las marca como MISSED. Notifica al supervisor de cada familia.
   *
   * Diseñado para ejecutarse como cron job nocturno.
   *
   * @returns Número de patrullas marcadas como MISSED
   */
  static async detectMissedPatrols(): Promise<number> {
    const now = new Date()
    let missedCount = 0

    // Obtener configuraciones de familia para conocer el grace period
    const familyConfigs = await prisma.patrol_family_config.findMany({
      where: { patrolsEnabled: true },
      select: { familyId: true, gracePeriodMinutes: true },
    })

    for (const config of familyConfigs) {
      // Buscar patrullas PENDING cuyo scheduledStart + gracePeriod ya pasó
      const gracePeriodMs = config.gracePeriodMinutes * 60 * 1000
      const cutoff = new Date(now.getTime() - gracePeriodMs)

      const pendingPatrols = await prisma.patrols.findMany({
        where: {
          familyId: config.familyId,
          status: 'PENDING',
          scheduledStart: { lt: cutoff },
        },
        select: {
          id: true,
          guardId: true,
          familyId: true,
          route: { select: { name: true } },
          guard: { select: { name: true } },
          scheduledStart: true,
        },
      })

      if (pendingPatrols.length === 0) continue

      // Marcar todas como MISSED en una sola operación
      await prisma.patrols.updateMany({
        where: {
          id: { in: pendingPatrols.map(p => p.id) },
        },
        data: { status: 'MISSED' },
      })

      missedCount += pendingPatrols.length

      // Notificar a los supervisores de la familia
      await this.notifyMissed(pendingPatrols, config.familyId)
    }

    console.log(`[PatrolSchedulerService] ${missedCount} patrullas marcadas como MISSED`)
    return missedCount
  }

  /**
   * Envía notificaciones PATROL_MISSED a los supervisores de la familia.
   */
  private static async notifyMissed(
    patrols: Array<{
      id: string
      guardId: string
      familyId: string
      route: { name: string }
      guard: { name: string }
      scheduledStart: Date
    }>,
    familyId: string
  ): Promise<void> {
    // Obtener supervisores (ADMIN y TECHNICIAN con patrolsEnabled) de la familia
    const supervisors = await prisma.users.findMany({
      where: {
        isActive: true,
        patrolsEnabled: true,
        role: { in: ['ADMIN', 'TECHNICIAN'] },
        OR: [
          { adminFamilyAssignments: { some: { familyId, isActive: true } } },
          { technicianFamilyAssignments: { some: { familyId, isActive: true } } },
        ],
      },
      select: { id: true },
    })

    if (supervisors.length === 0) return

    for (const patrol of patrols) {
      const scheduledTime = patrol.scheduledStart.toLocaleString('es-EC', {
        timeZone: 'America/Guayaquil',
        dateStyle: 'short',
        timeStyle: 'short',
      })

      for (const supervisor of supervisors) {
        await NotificationService.push({
          userId: supervisor.id,
          type: NotificationType.PATROL_MISSED,
          title: 'Ronda no iniciada',
          message: `La ronda "${patrol.route.name}" asignada a ${patrol.guard.name} programada para ${scheduledTime} no fue iniciada.`,
          metadata: {
            patrolId: patrol.id,
            guardId: patrol.guardId,
            familyId: patrol.familyId,
          },
        })
      }
    }
  }
}
