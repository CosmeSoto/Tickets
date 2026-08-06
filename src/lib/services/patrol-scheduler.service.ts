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
import { getPatrolSupervisors } from '@/lib/patrol/patrol-helpers'
import { getAppTimezone } from '@/lib/utils/date-utils'

export class PatrolSchedulerService {
  // ── Generación de patrullas ─────────────────────────────────────────────────

  /**
   * Genera instancias patrol (PENDING) para un schedule dado.
   * Calcula las ocurrencias dentro del horizonte de días especificado.
   * Usa skipDuplicates para ser idempotente (seguro de llamar múltiples veces).
   *
   * @param scheduleId           - ID del schedule
   * @param horizonDays          - Días hacia adelante para generar patrullas (default 30)
   * @param repeatIntervalMinutes - Repetición intra-turno: cada cuántos minutos se repite
   *                               la ronda dentro del bloque diario. null = sin repetición.
   * @returns Número de patrullas creadas
   */
  static async generatePatrols(
    scheduleId: string,
    horizonDays = 30,
    repeatIntervalMinutes: number | null = null
  ): Promise<number> {
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

    // Si hay intervalo intra-turno, expandir cada ocurrencia en sub-ocurrencias
    const allOccurrences =
      repeatIntervalMinutes && repeatIntervalMinutes >= 10
        ? this.expandWithRepeatInterval(occurrences, repeatIntervalMinutes)
        : occurrences

    const result = await prisma.patrols.createMany({
      data: allOccurrences.map(({ start, end }) => ({
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
   * Toda la aritmética de fechas usa la zona horaria de América/Guayaquil (UTC-5 fijo,
   * sin DST) para que los "días de semana" y las horas coincidan con lo que el usuario
   * ve en el formulario. Los resultados se devuelven como objetos Date (UTC internamente)
   * y se persisten en BD como UTC, que es el comportamiento correcto de Prisma/Postgres.
   *
   * Para recurrencia NONE: scheduledStart/End son la fecha exacta de la patrulla.
   * Para DAILY/WEEKLY/CUSTOM: scheduledStart define la hora de inicio de cada patrulla;
   *   scheduledEnd define la hora de fin. El límite de generación es el horizonte de días.
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

    // Ecuador: UTC-5 fijo (sin DST)
    const TZ_OFFSET_MS = -5 * 60 * 60 * 1000

    /** Convierte un Date UTC a "milisegundos en hora local de Guayaquil" */
    const toLocal = (d: Date) => d.getTime() + TZ_OFFSET_MS

    /** Construye un Date UTC desde componentes de hora local de Guayaquil */
    const fromLocalComponents = (
      year: number,
      month: number,
      day: number,
      hours: number,
      minutes: number,
      seconds = 0,
      ms = 0
    ): Date => {
      // Calcular el timestamp UTC equivalente a esa hora en Guayaquil
      const utcMs = Date.UTC(year, month, day, hours, minutes, seconds, ms) - TZ_OFFSET_MS
      return new Date(utcMs)
    }

    // Horizonte: ahora + horizonDays días (en hora local)
    const horizonEnd = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000)

    // Duración de cada patrulla individual (en ms)
    let durationMs = schedule.scheduledEnd.getTime() - schedule.scheduledStart.getTime()
    if (schedule.recurrence !== PatrolRecurrence.NONE && durationMs > 24 * 60 * 60 * 1000) {
      // scheduledEnd tiene fecha incorrecta — recalcular usando solo la hora local
      const localStart = toLocal(schedule.scheduledStart)
      const localEnd = toLocal(schedule.scheduledEnd)
      const localStartHours = Math.floor((localStart % (24 * 3600 * 1000)) / (3600 * 1000))
      const localStartMinutes = Math.floor((localStart % (3600 * 1000)) / (60 * 1000))
      const localEndHours = Math.floor((localEnd % (24 * 3600 * 1000)) / (3600 * 1000))
      const localEndMinutes = Math.floor((localEnd % (3600 * 1000)) / (60 * 1000))

      const startDate = new Date(schedule.scheduledStart)
      const correctedEnd = fromLocalComponents(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        localEndHours,
        localEndMinutes
      )
      if (correctedEnd <= schedule.scheduledStart) {
        correctedEnd.setUTCDate(correctedEnd.getUTCDate() + 1)
      }
      durationMs = correctedEnd.getTime() - schedule.scheduledStart.getTime()
    }

    // Hora y minutos del scheduledStart en hora LOCAL de Guayaquil
    const localStartMs = toLocal(schedule.scheduledStart)
    const startLocalHours = Math.floor(
      (((localStartMs % (24 * 3600 * 1000)) + 24 * 3600 * 1000) % (24 * 3600 * 1000)) /
        (3600 * 1000)
    )
    const startLocalMinutes = Math.floor(
      (((localStartMs % (3600 * 1000)) + 3600 * 1000) % (3600 * 1000)) / (60 * 1000)
    )

    switch (schedule.recurrence) {
      case PatrolRecurrence.NONE: {
        occurrences.push({
          start: new Date(schedule.scheduledStart),
          end: new Date(schedule.scheduledEnd),
        })
        break
      }

      case PatrolRecurrence.DAILY: {
        const now = new Date()
        // Margen de 60 min: si la ronda de hoy empezó hace menos de 60 min, igual se incluye
        const graceCutoff = new Date(now.getTime() - 60 * 60 * 1000)

        // Calcular el día local de inicio del cursor
        const schedLocalMs = toLocal(schedule.scheduledStart)
        // Inicio del día local del scheduledStart
        const schedLocalDay = Math.floor(schedLocalMs / (24 * 3600 * 1000))
        const nowLocalDay = Math.floor(toLocal(now) / (24 * 3600 * 1000))

        // Comenzar desde el día local del schedule (o desde hoy si ya pasó)
        let cursorLocalDay = Math.max(schedLocalDay, nowLocalDay)

        // Construir la fecha UTC de la primera ocurrencia del cursor
        const buildDate = (localDay: number): Date => {
          // Convertir "día local desde epoch" a componentes fecha
          const ms = localDay * 24 * 3600 * 1000
          const tmp = new Date(ms + TZ_OFFSET_MS) // aproximación para extraer componentes
          const year = tmp.getUTCFullYear()
          const month = tmp.getUTCMonth()
          const day = tmp.getUTCDate()
          return fromLocalComponents(year, month, day, startLocalHours, startLocalMinutes)
        }

        let candidate = buildDate(cursorLocalDay)

        // Si la primera candidata está antes del graceCutoff, avanzar al día siguiente
        if (candidate < graceCutoff) {
          cursorLocalDay++
          candidate = buildDate(cursorLocalDay)
        }

        // Solo generar desde scheduledStart en adelante
        if (candidate < schedule.scheduledStart) {
          candidate = new Date(schedule.scheduledStart)
        }

        while (candidate <= horizonEnd) {
          occurrences.push({
            start: new Date(candidate),
            end: new Date(candidate.getTime() + durationMs),
          })
          // Avanzar exactamente 1 día local (24h en UTC para este timezone sin DST)
          candidate = new Date(candidate.getTime() + 24 * 60 * 60 * 1000)
        }
        break
      }

      case PatrolRecurrence.WEEKLY:
      case PatrolRecurrence.CUSTOM: {
        const days = new Set(schedule.recurrenceDays)
        if (days.size === 0) break

        const now = new Date()
        // Margen de 60 min: si la ronda de hoy empezó hace menos de 60 min, igual se incluye
        const graceCutoff = new Date(now.getTime() - 60 * 60 * 1000)

        // Día local del scheduledStart y de hoy
        const schedLocalMs = toLocal(schedule.scheduledStart)
        const schedLocalDay = Math.floor(schedLocalMs / (24 * 3600 * 1000))
        const nowLocalDay = Math.floor(toLocal(now) / (24 * 3600 * 1000))

        // Empezar desde el día local del schedule (o desde hoy si ya pasó)
        let cursorLocalDay = Math.max(schedLocalDay, nowLocalDay)

        const buildDate = (localDay: number): Date => {
          const ms = localDay * 24 * 3600 * 1000
          const tmp = new Date(ms + TZ_OFFSET_MS)
          const year = tmp.getUTCFullYear()
          const month = tmp.getUTCMonth()
          const day = tmp.getUTCDate()
          return fromLocalComponents(year, month, day, startLocalHours, startLocalMinutes)
        }

        // El "día de la semana local" del día cursor
        const localDayOfWeek = (localDay: number): number => {
          // epoch en UTC es jueves (4); ajustar con offset local
          const ms = localDay * 24 * 3600 * 1000 + TZ_OFFSET_MS
          return new Date(ms).getUTCDay()
        }

        let iterations = 0
        while (iterations < 400) {
          // máx ~400 días de búsqueda
          iterations++
          const candidate = buildDate(cursorLocalDay)
          if (candidate > horizonEnd) break

          // Comprobar si el día de semana local coincide con los días seleccionados
          if (days.has(localDayOfWeek(cursorLocalDay))) {
            if (
              candidate >= schedule.scheduledStart &&
              candidate >= graceCutoff &&
              candidate <= horizonEnd
            ) {
              occurrences.push({
                start: new Date(candidate),
                end: new Date(candidate.getTime() + durationMs),
              })
            }
          }
          cursorLocalDay++
        }
        break
      }
    }

    return occurrences
  }

  /**
   * Expande una lista de ocurrencias aplicando repetición intra-turno.
   *
   * Dado un bloque [start → end] y un intervalo de N minutos, genera sub-bloques:
   *   [start, start+routeMins), [start+interval, start+interval+routeMins), ...
   *
   * La duración de cada sub-patrulla = min(intervalMinutes, bloqueTotalMinutes).
   * No se generan sub-ocurrencias que excedan el fin del bloque original.
   *
   * @param occurrences       - Lista base de ocurrencias [start, end]
   * @param intervalMinutes   - Cada cuántos minutos inicia una nueva sub-patrulla
   * @returns Lista expandida de ocurrencias
   */
  private static expandWithRepeatInterval(
    occurrences: Array<{ start: Date; end: Date }>,
    intervalMinutes: number
  ): Array<{ start: Date; end: Date }> {
    const intervalMs = intervalMinutes * 60 * 1000
    const expanded: Array<{ start: Date; end: Date }> = []

    for (const { start, end } of occurrences) {
      const blockDurationMs = end.getTime() - start.getTime()
      if (blockDurationMs <= 0) continue

      // Duración de cada sub-ronda = el intervalo (o el bloque entero si el intervalo es mayor)
      const subDurationMs = Math.min(intervalMs, blockDurationMs)

      let cursor = start.getTime()
      while (cursor + subDurationMs <= end.getTime()) {
        expanded.push({
          start: new Date(cursor),
          end: new Date(cursor + subDurationMs),
        })
        cursor += intervalMs
      }

      // Si el bloque es exactamente divisible no agregamos nada extra.
      // Si quedó un remanente >= 10 min al final del turno, agregarlo como última ronda.
      const remainingMs = end.getTime() - cursor
      if (remainingMs >= 10 * 60 * 1000) {
        expanded.push({ start: new Date(cursor), end: new Date(end) })
      }
    }

    return expanded
  }

  /**
   * Expone el cálculo de ocurrencias para validar solapamientos al crear/editar schedules.
   */
  static calculateOccurrencesForOverlap(
    schedule: {
      scheduledStart: Date
      scheduledEnd: Date
      recurrence: PatrolRecurrence
      recurrenceDays: number[]
    },
    horizonDays = 30
  ): Array<{ start: Date; end: Date }> {
    return PatrolSchedulerService.calculateOccurrences(schedule, horizonDays)
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

  // ── Recordatorios de rondas próximas ────────────────────────────────────────

  /**
   * Envía notificaciones de recordatorio a los agentes cuyas rondas están
   * próximas a iniciar (dentro del gracePeriodMinutes configurado por familia, default 5 min).
   *
   * Diseñado para ejecutarse cada 5 minutos vía cron.
   * Usa un campo de metadata para evitar enviar duplicados.
   *
   * @returns Número de recordatorios enviados
   */
  static async sendUpcomingReminders(): Promise<number> {
    const now = new Date()

    // Obtener configuraciones de familia para conocer el tiempo de recordatorio
    const familyConfigs = await prisma.patrol_family_config.findMany({
      where: { patrolsEnabled: true },
      select: { familyId: true, gracePeriodMinutes: true },
    })

    const maxReminderMinutes =
      familyConfigs.length > 0 ? Math.max(...familyConfigs.map(c => c.gracePeriodMinutes ?? 5)) : 5
    const reminderWindowMs = maxReminderMinutes * 60 * 1000
    const windowEnd = new Date(now.getTime() + reminderWindowMs)

    // Buscar patrullas PENDING que inician en los próximos N minutos
    const upcomingPatrols = await prisma.patrols.findMany({
      where: {
        status: 'PENDING',
        scheduledStart: { gte: now, lte: windowEnd },
      },
      select: {
        id: true,
        agentId: true,
        scheduledStart: true,
        route: { select: { name: true } },
        family: { select: { name: true } },
      },
    })

    if (upcomingPatrols.length === 0) return 0

    // Verificar cuáles ya recibieron recordatorio (evitar duplicados)
    const patrolIds = upcomingPatrols.map(p => p.id)
    const alreadyNotified =
      patrolIds.length > 0
        ? await prisma.notifications.findMany({
            where: {
              type: 'PATROL_ASSIGNED',
              OR: patrolIds.map(patrolId => ({
                metadata: { path: ['reminderFor'], equals: patrolId },
              })),
            },
            select: { metadata: true },
          })
        : []

    // Extraer IDs ya notificados del metadata
    const notifiedIds = new Set<string>()
    for (const n of alreadyNotified) {
      const meta = n.metadata as any
      if (meta?.reminderFor) notifiedIds.add(meta.reminderFor)
    }

    let sent = 0
    for (const patrol of upcomingPatrols) {
      if (notifiedIds.has(patrol.id)) continue

      const minutesUntilStart = Math.round(
        (patrol.scheduledStart.getTime() - now.getTime()) / 60000
      )
      const startTime = patrol.scheduledStart.toLocaleTimeString('es-EC', {
        timeZone: getAppTimezone(),
        timeStyle: 'short',
      })

      await NotificationService.push({
        userId: patrol.agentId,
        type: NotificationType.PATROL_ASSIGNED,
        title: '🔔 Ronda próxima a iniciar',
        message: `Tu ronda "${patrol.route.name}" inicia en ${minutesUntilStart} minutos (${startTime}). Prepárate para escanear los checkpoints.`,
        metadata: { patrolId: patrol.id, reminderFor: patrol.id, type: 'upcoming_reminder' },
      })
      sent++
    }

    if (sent > 0) {
      console.log(`[PatrolSchedulerService] ${sent} recordatorios enviados`)
    }
    return sent
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

  // ── Cierre automático de rondas IN_PROGRESS vencidas ──────────────────────

  /**
   * Cierra automáticamente patrullas IN_PROGRESS:
   * 1) Ventana vencida: scheduledEnd + gracePeriodMinutes
   * 2) Completas al 100% (si autoCompleteWhenAllRequired): red de seguridad del cron
   *
   * Estado final: INCOMPLETE si hay checkpoints no visitados, COMPLETED si todos visitados.
   * Diseñado para ejecutarse como cron job cada 5 minutos.
   */
  static async autoCloseExpiredPatrols(): Promise<number> {
    const now = new Date()
    let closedCount = 0

    const familyConfigs = await prisma.patrol_family_config.findMany({
      where: { patrolsEnabled: true },
      select: {
        familyId: true,
        gracePeriodMinutes: true,
        alertCompletionThreshold: true,
        autoCompleteWhenAllRequired: true,
        requirePhotoOnEnd: true,
      },
    })

    for (const config of familyConfigs) {
      const gracePeriodMs = (config.gracePeriodMinutes ?? 15) * 60 * 1000
      const cutoff = new Date(now.getTime() - gracePeriodMs)

      // Ventana vencida + (opcional) rondas ya al 100% como red de seguridad
      const expiredPatrols = await prisma.patrols.findMany({
        where: {
          familyId: config.familyId,
          status: 'IN_PROGRESS',
          scheduledEnd: { lt: cutoff },
        },
        select: {
          id: true,
          agentId: true,
          familyId: true,
          scheduledEnd: true,
          route: {
            select: {
              name: true,
              routeCheckpoints: {
                select: { checkpointId: true, isRequired: true },
              },
            },
          },
          agent: { select: { name: true } },
          checkIns: {
            where: { validationResult: 'VALID' },
            select: { checkpointId: true },
          },
        },
      })

      const completeCandidates =
        (config.autoCompleteWhenAllRequired ?? true) && !config.requirePhotoOnEnd
          ? await prisma.patrols.findMany({
              where: {
                familyId: config.familyId,
                status: 'IN_PROGRESS',
                completionPercentage: { gte: 100 },
                id: { notIn: expiredPatrols.map(p => p.id) },
              },
              select: {
                id: true,
                agentId: true,
                familyId: true,
                scheduledEnd: true,
                route: {
                  select: {
                    name: true,
                    routeCheckpoints: {
                      select: { checkpointId: true, isRequired: true },
                    },
                  },
                },
                agent: { select: { name: true } },
                checkIns: {
                  where: { validationResult: 'VALID' },
                  select: { checkpointId: true },
                },
              },
            })
          : []

      const patrolsToClose = [...expiredPatrols, ...completeCandidates]

      for (const patrol of patrolsToClose) {
        const requiredCheckpointIds = patrol.route.routeCheckpoints
          .filter(rc => rc.isRequired)
          .map(rc => rc.checkpointId)

        const visitedIds = new Set(patrol.checkIns.map(ci => ci.checkpointId))
        const visitedRequired = requiredCheckpointIds.filter(cid => visitedIds.has(cid)).length
        const missedIds = requiredCheckpointIds.filter(cid => !visitedIds.has(cid))

        const completionPct =
          requiredCheckpointIds.length === 0
            ? visitedIds.size > 0
              ? 100
              : 0
            : Math.round((visitedRequired / requiredCheckpointIds.length) * 100)

        // Red de seguridad: solo cerrar por % si realmente faltan 0 obligatorios
        const isExpired = expiredPatrols.some(p => p.id === patrol.id)
        if (!isExpired && missedIds.length > 0) continue

        const finalStatus = missedIds.length === 0 ? 'COMPLETED' : 'INCOMPLETE'

        try {
          await prisma.patrols.update({
            where: { id: patrol.id },
            data: {
              status: finalStatus,
              completedAt: now,
              completionPercentage: completionPct,
              missedCheckpointIds: missedIds,
            },
          })
          closedCount++

          const threshold = config.alertCompletionThreshold ?? 80
          if (completionPct < threshold) {
            await this.notifyAutoClose(patrol, config.familyId, completionPct, missedIds.length)
          }
        } catch (err) {
          console.error(`[PatrolSchedulerService] Error cerrando patrulla ${patrol.id}:`, err)
        }
      }
    }

    if (closedCount > 0) {
      console.log(
        `[PatrolSchedulerService] ${closedCount} patrullas IN_PROGRESS cerradas automáticamente`
      )
    }
    return closedCount
  }

  /**
   * Notifica a los supervisores cuando una patrulla se cierra automáticamente por vencimiento.
   */
  private static async notifyAutoClose(
    patrol: {
      id: string
      agentId: string
      familyId: string
      route: { name: string }
      agent: { name: string }
      scheduledEnd: Date
    },
    familyId: string,
    completionPct: number,
    missedCount: number
  ): Promise<void> {
    const supervisors = await getPatrolSupervisors(familyId)
    if (supervisors.length === 0) return

    const endTime = patrol.scheduledEnd.toLocaleString('es-EC', {
      timeZone: getAppTimezone(),
      dateStyle: 'short',
      timeStyle: 'short',
    })

    for (const supervisor of supervisors) {
      await NotificationService.push({
        userId: supervisor.id,
        type: NotificationType.PATROL_INCOMPLETE,
        title: 'Ronda cerrada automáticamente',
        message: `La ronda "${patrol.route.name}" del agente ${patrol.agent.name} fue cerrada automáticamente al vencer el horario (${endTime}). Completitud: ${completionPct}%. ${missedCount} checkpoint(s) no visitado(s).`,
        metadata: {
          patrolId: patrol.id,
          agentId: patrol.agentId,
          familyId: patrol.familyId,
          autoClosed: true,
          completionPct,
          missedCheckpoints: missedCount,
        },
      })
    }
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
    const supervisors = await getPatrolSupervisors(familyId)

    if (supervisors.length === 0) return

    for (const patrol of patrols) {
      const scheduledTime = patrol.scheduledStart.toLocaleString('es-EC', {
        timeZone: getAppTimezone(),
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
