/**
 * GET   /api/patrols/[id]  — Detalle de patrulla con checkpoints y progreso
 * PATCH /api/patrols/[id]  — Inicia o finaliza patrulla
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'
import { NotificationType } from '@prisma/client'
import { getPatrolSupervisors } from '@/lib/patrol/patrol-helpers'
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'

/** Admin/técnico: patrullas solo del área (familia) asignada. */
async function canViewPatrolAsStaff(
  user: { id: string; role: string; isSuperAdmin?: boolean },
  familyId: string
): Promise<boolean> {
  return checkPatrolFamilyAccess(user.id, familyId, user.role, user.isSuperAdmin === true)
}

const patchPatrolSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('start'),
    startPhotoBase64: z.string().optional(),
    capturedAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('end'),
    endPhotoBase64: z.string().optional(),
    capturedAt: z.string().datetime().optional(),
  }),
  z.object({
    action: z.literal('cancel'),
  }),
])

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const patrol = await prisma.patrols.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        scheduleId: true,
        routeId: true,
        agentId: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        startedAt: true,
        completedAt: true,
        completionPercentage: true,
        missedCheckpointIds: true,
        startPhotoId: true,
        endPhotoId: true,
        createdAt: true,
        updatedAt: true,
        agent: { select: { id: true, name: true, email: true } },
        route: {
          select: {
            id: true,
            name: true,
            estimatedDurationMinutes: true,
            routeCheckpoints: {
              select: {
                order: true,
                isRequired: true,
                checkpoint: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                    latitude: true,
                    longitude: true,
                    qrType: true,
                    isSensitive: true,
                    isActive: true,
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        checkIns: {
          where: { validationResult: 'VALID' },
          select: {
            id: true,
            checkpointId: true,
            validationResult: true,
            method: true,
            deviceTimestamp: true,
            serverTimestamp: true,
            gpsLat: true,
            gpsLng: true,
            distanceFromCheckpointMeters: true,
            isOffline: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!patrol) return NextResponse.json({ error: 'Patrulla no encontrada' }, { status: 404 })

    const isAgent = patrol.agentId === session.user.id
    const sessionUser = session.user as { isSuperAdmin?: boolean }
    if (!isAgent) {
      if (session.user.role === 'CLIENT') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      if (session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN') {
        const ok = await canViewPatrolAsStaff(
          { id: session.user.id, role: session.user.role, isSuperAdmin: sessionUser.isSuperAdmin },
          patrol.familyId
        )
        if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      } else {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const familyCfg = await prisma.patrol_family_config.findUnique({
      where: { familyId: patrol.familyId },
      select: {
        requirePhotoOnStart: true,
        requirePhotoOnEnd: true,
        patrolIncidentCategoryId: true,
      },
    })

    // Calcular progreso en tiempo real
    const requiredCheckpoints = patrol.route.routeCheckpoints.filter(rc => rc.isRequired)
    const visitedCheckpointIds = new Set(patrol.checkIns.map(ci => ci.checkpointId))
    const visitedRequired = requiredCheckpoints.filter(rc =>
      visitedCheckpointIds.has(rc.checkpoint.id)
    ).length

    const progress = {
      visitedRequired,
      totalRequired: requiredCheckpoints.length,
      completionPercentage: calculateCompletionPercentage(
        visitedRequired,
        requiredCheckpoints.length
      ),
    }

    return NextResponse.json({
      success: true,
      data: {
        ...patrol,
        progress,
        familyConfig: {
          requirePhotoOnStart: familyCfg?.requirePhotoOnStart ?? false,
          requirePhotoOnEnd: familyCfg?.requirePhotoOnEnd ?? false,
          patrolIncidentCategoryId: familyCfg?.patrolIncidentCategoryId ?? null,
        },
      },
    })
  } catch (error) {
    console.error('[patrol/[id]] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const patrol = await prisma.patrols.findUnique({
      where: { id },
      select: {
        id: true,
        agentId: true,
        familyId: true,
        status: true,
        routeId: true,
        scheduleId: true,
        scheduledStart: true,
        scheduledEnd: true,
        route: {
          select: {
            routeCheckpoints: {
              select: { checkpointId: true, isRequired: true },
            },
          },
        },
      },
    })

    if (!patrol) return NextResponse.json({ error: 'Patrulla no encontrada' }, { status: 404 })

    const body = await request.json()
    const data = patchPatrolSchema.parse(body)

    // Cancelar: ADMIN con acceso a la familia (antes del gate de agente)
    if (data.action === 'cancel') {
      const sessionUser = session.user as { isSuperAdmin?: boolean }
      if (session.user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Solo los administradores pueden cancelar rondas' },
          { status: 403 }
        )
      }

      const ok = await canViewPatrolAsStaff(
        { id: session.user.id, role: session.user.role, isSuperAdmin: sessionUser.isSuperAdmin },
        patrol.familyId
      )
      if (!ok) {
        return NextResponse.json({ error: 'No autorizado para esta área' }, { status: 403 })
      }

      if (patrol.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Solo se pueden cancelar rondas en estado PENDIENTE' },
          { status: 409 }
        )
      }

      await prisma.patrols.update({
        where: { id },
        data: { status: 'MISSED' },
      })

      await AuditServiceComplete.log({
        action: 'PATROL_CANCELLED_BY_ADMIN',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { agentId: patrol.agentId, familyId: patrol.familyId },
        request,
      })

      return NextResponse.json({ success: true, status: 'MISSED' })
    }

    // Iniciar/finalizar: solo el agente asignado
    if (patrol.agentId !== session.user.id) {
      return NextResponse.json(
        { error: 'Solo el agente asignado puede operar esta patrulla' },
        { status: 403 }
      )
    }

    // Obtener config de familia y override de la programación en paralelo
    const [familyConfig, scheduleConfig] = await Promise.all([
      prisma.patrol_family_config.findUnique({
        where: { familyId: patrol.familyId },
        select: {
          requirePhotoOnStart: true,
          requirePhotoOnEnd: true,
          alertCompletionThreshold: true,
          gracePeriodMinutes: true,
          strictTimeValidation: true,
        },
      }),
      patrol.scheduleId
        ? prisma.patrol_schedules.findUnique({
            where: { id: patrol.scheduleId },
            select: { overrideTimeValidation: true },
          })
        : Promise.resolve(null),
    ])

    if (data.action === 'start') {
      if (patrol.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'La patrulla no está en estado PENDING' },
          { status: 409 }
        )
      }

      // Jerarquía de validación de horario:
      // 1. overrideTimeValidation de la programación (si no es null) → tiene prioridad
      // 2. strictTimeValidation de la familia → default
      const gracePeriodMinutes = familyConfig?.gracePeriodMinutes ?? 5
      const strictTimeValidation =
        scheduleConfig?.overrideTimeValidation !== null &&
        scheduleConfig?.overrideTimeValidation !== undefined
          ? scheduleConfig.overrideTimeValidation
          : (familyConfig?.strictTimeValidation ?? true)

      if (strictTimeValidation) {
        const now = new Date()
        const earliestStart = new Date(
          patrol.scheduledStart.getTime() - gracePeriodMinutes * 60 * 1000
        )
        const latestStart = new Date(
          patrol.scheduledStart.getTime() + gracePeriodMinutes * 60 * 1000
        )

        if (now < earliestStart) {
          const minutesUntilStart = Math.ceil(
            (patrol.scheduledStart.getTime() - now.getTime()) / 60000
          )
          const h = Math.floor(minutesUntilStart / 60)
          const m = minutesUntilStart % 60
          const timeLabel = h > 0 && m > 0 ? `${h}h ${m}min` : h > 0 ? `${h}h` : `${m} minutos`
          return NextResponse.json(
            {
              error: `Aún no puedes iniciar esta ronda. Faltan ${timeLabel} para el horario programado.`,
              code: 'TOO_EARLY',
            },
            { status: 422 }
          )
        }

        if (now > latestStart) {
          return NextResponse.json(
            {
              error: 'El horario programado para esta ronda ya finalizó.',
              code: 'TOO_LATE',
            },
            { status: 422 }
          )
        }
      }

      if (familyConfig?.requirePhotoOnStart && !data.startPhotoBase64) {
        return NextResponse.json(
          { error: 'Se requiere foto de inicio', code: 'PHOTO_REQUIRED' },
          { status: 422 }
        )
      }

      let startPhotoId: string | null = null
      if (data.startPhotoBase64) {
        const photo = await PatrolPhotoService.savePhoto(
          data.startPhotoBase64,
          null,
          patrol.id,
          data.capturedAt ? new Date(data.capturedAt) : new Date()
        )
        startPhotoId = photo.id
      }

      await prisma.patrols.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          ...(startPhotoId ? { startPhotoId } : {}),
        },
      })

      await AuditServiceComplete.log({
        action: 'PATROL_STARTED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { routeId: patrol.routeId, hasStartPhoto: !!startPhotoId },
        request,
      })

      return NextResponse.json({ success: true, status: 'IN_PROGRESS' })
    }

    if (data.action === 'end') {
      if (patrol.status !== 'IN_PROGRESS') {
        return NextResponse.json({ error: 'La patrulla no está en progreso' }, { status: 409 })
      }

      if (familyConfig?.requirePhotoOnEnd && !data.endPhotoBase64) {
        return NextResponse.json(
          { error: 'Se requiere foto de cierre', code: 'PHOTO_REQUIRED' },
          { status: 422 }
        )
      }

      let endPhotoId: string | null = null
      if (data.endPhotoBase64) {
        const photo = await PatrolPhotoService.savePhoto(
          data.endPhotoBase64,
          null,
          patrol.id,
          data.capturedAt ? new Date(data.capturedAt) : new Date()
        )
        endPhotoId = photo.id
      }

      // Calcular completitud
      const requiredCheckpointIds = patrol.route.routeCheckpoints
        .filter(rc => rc.isRequired)
        .map(rc => rc.checkpointId)

      const validCheckIns = await prisma.patrol_check_ins.findMany({
        where: { patrolId: id, validationResult: 'VALID' },
        select: { checkpointId: true },
      })

      const visitedIds = new Set(validCheckIns.map(ci => ci.checkpointId))
      const visitedRequired = requiredCheckpointIds.filter(cid => visitedIds.has(cid)).length
      const completionPct = calculateCompletionPercentage(
        visitedRequired,
        requiredCheckpointIds.length
      )
      const missedIds = requiredCheckpointIds.filter(cid => !visitedIds.has(cid))
      const finalStatus = missedIds.length === 0 ? 'COMPLETED' : 'INCOMPLETE'

      await prisma.patrols.update({
        where: { id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          completionPercentage: completionPct,
          missedCheckpointIds: missedIds,
          ...(endPhotoId ? { endPhotoId } : {}),
        },
      })

      // Notificar si completitud por debajo del umbral
      const threshold = familyConfig?.alertCompletionThreshold ?? 80
      if (completionPct < threshold) {
        const supervisors = await getPatrolSupervisors(patrol.familyId)

        await Promise.allSettled(
          supervisors.map(s =>
            NotificationService.push({
              userId: s.id,
              type: NotificationType.PATROL_INCOMPLETE,
              title: 'Ronda incompleta',
              message: `La patrulla finalizó con ${completionPct}% de completitud (umbral: ${threshold}%). ${missedIds.length} checkpoint(s) requerido(s) no visitado(s).`,
              metadata: { patrolId: id, completionPct, missedCheckpointIds: missedIds },
            })
          )
        )
      }

      await AuditServiceComplete.log({
        action: 'PATROL_ENDED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { status: finalStatus, completionPct, missedCount: missedIds.length },
        request,
      })

      return NextResponse.json({
        success: true,
        status: finalStatus,
        completionPercentage: completionPct,
      })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('[patrol/[id]] PATCH:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
