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
        agentId: true,
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
        agentId: schedule.agentId,
        scheduledStart: start,
        scheduledEnd: end,
      })),
      skipDuplicates: true,
    })

    return result.count
  }

  /**
   * Calcula las fechas de ocurrencia para un schedule dentro del horizonte.
   *
   * Toda la aritmética de fechas usa métodos UTC explícitos para garantizar
   * comportamiento correcto independientemente del timezone del servidor.
   *
   * Para recurrencia NONE: scheduledStart/End son la fecha exacta de la patrulla.
   * Para DAILY/WEEKLY/CUSTOM: scheduledStart define la hora de inicio de cada patrulla,
   *   scheduledEnd define la hora de fin de cada patrulla (la duración).
   *   El límite de generación es el horizonte de días (no scheduledEnd).
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

    // Horizonte: ahora + horizonDays días (en UTC)
    const horizonEnd = new Date()
    horizonEnd.setUTCDate(horizonEnd.getUTCDate() + horizonDays)
    horizonEnd.setUTCHours(23, 59, 59, 999)

    // Duración de cada patrulla individual
    const durationMs = schedule.scheduledEnd.getTime() - schedule.scheduledStart.getTime()

    // Hora y minutos UTC del scheduledStart (se aplican a cada ocurrencia)
    const startUTCHours = schedule.scheduledStart.getUTCHours()
    const startUTCMinutes = schedule.scheduledStart.getUTCMinutes()

    switch (schedule.recurrence) {
      case PatrolRecurrence.NONE: {
        // Una sola ocurrencia — usar las fechas exactas del schedule
        occurrences.push({
          start: new Date(schedule.scheduledStart),
          end: new Date(schedule.scheduledEnd),
        })
        break
      }

      case PatrolRecurrence.DAILY: {
        // Una ocurrencia por día desde scheduledStart (o desde hoy si ya pasó) hasta el horizonte.
        // Usamos UTC para avanzar el cursor día a día sin drift de DST.
        const cursor = new Date(schedule.scheduledStart)

        // Si scheduledStart ya pasó, empezar desde hoy con la misma hora UTC
        const now = new Date()
        if (cursor < now) {
          cursor.setUTCFullYear(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
          // Mantener la hora UTC original del scheduledStart
          cursor.setUTCHours(startUTCHours, startUTCMinutes, 0, 0)
          // Si la hora de hoy ya pasó, empezar mañana
          if (cursor <= now) {
            cursor.setUTCDate(cursor.getUTCDate() + 1)
          }
        }

        while (cursor <= horizonEnd) {
          occurrences.push({
            start: new Date(cursor),
            end: new Date(cursor.getTime() + durationMs),
          })
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }
        break
      }

      case PatrolRecurrence.WEEKLY:
      case PatrolRecurrence.CUSTOM: {
        // Ocurrencias en los días UTC de la semana especificados en recurrenceDays.
        // recurrenceDays usa getUTCDay(): 0=Dom, 1=Lun, ..., 6=Sáb (en UTC).
        const days = new Set(schedule.recurrenceDays)
        if (days.size === 0) break

        // Empezar desde el inicio del día UTC del scheduledStart
        // Si scheduledStart ya pasó, empezar desde hoy
        const now = new Date()
        const cursor = new Date(schedule.scheduledStart)
        cursor.setUTCHours(0, 0, 0, 0)

        // Si el inicio del schedule ya pasó, avanzar al día de hoy
        const todayUTC = new Date()
        todayUTC.setUTCHours(0, 0, 0, 0)
        if (cursor < todayUTC) {
          cursor.setUTCFullYear(
            todayUTC.getUTCFullYear(),
            todayUTC.getUTCMonth(),
            todayUTC.getUTCDate()
          )
        }

        while (cursor <= horizonEnd) {
          if (days.has(cursor.getUTCDay())) {
            // Aplicar la hora UTC del scheduledStart original al día actual
            const start = new Date(cursor)
            start.setUTCHours(startUTCHours, startUTCMinutes, 0, 0)

            // Solo incluir si la fecha de inicio es en el futuro (o igual al scheduledStart original)
            if (start >= schedule.scheduledStart && start > now && start <= horizonEnd) {
              occurrences.push({
                start,
                end: new Date(start.getTime() + durationMs),
              })
            }
          }
          cursor.setUTCDate(cursor.getUTCDate() + 1)
        }
        break
      }
    }

    return occurrences
  }

  // ── Regeneración periódica de patrullas ────────────────────────────────────

  /**
   * Regenera patrullas futuras para todos los schedules activos con recurrencia.
   * Diseñado para ejecutarse como cron job nocturno.
   * Usa skipDuplicates para ser idempotente — no crea duplicados.
   *
   * @returns Número total de patrullas nuevas generadas
   */
  static async regenerateActiveSchedules(): Promise<number> {
    const activeSchedules = await prisma.patrol_schedules.findMany({
      where: {
        isActive: true,
        recurrence: { not: 'NONE' },
      },
      select: { id: true },
    })

    let totalGenerated = 0
    for (const schedule of activeSchedules) {
      try {
        const count = await this.generatePatrols(schedule.id, 30)
        totalGenerated += count
      } catch (err) {
        console.error(`[PatrolSchedulerService] Error regenerando schedule ${schedule.id}:`, err)
      }
    }

    console.log(
      `[PatrolSchedulerService] ${totalGenerated} patrullas generadas para ${activeSchedules.length} schedules activos`
    )
    return totalGenerated
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
          agentId: true,
          familyId: true,
          route: { select: { name: true } },
          agent: { select: { name: true } },
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
      agentId: string
      familyId: string
      route: { name: string }
      agent: { name: string }
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
          message: `La ronda "${patrol.route.name}" asignada a ${patrol.agent.name} programada para ${scheduledTime} no fue iniciada.`,
          metadata: {
            patrolId: patrol.id,
            agentId: patrol.agentId,
            familyId: patrol.familyId,
          },
        })
      }
    }
  }
}
