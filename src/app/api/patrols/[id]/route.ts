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
import { applyPatrolClose, computePatrolCloseFromProgress } from '@/lib/patrol/patrol-finalize'
import { NotificationType } from '@prisma/client'
import { getPatrolSupervisors, checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
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
  z.object({
    action: z.literal('force_close'),
    reason: z.string().trim().min(3).max(500),
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

    const [familyCfg, scheduleCfg] = await Promise.all([
      prisma.patrol_family_config.findUnique({
        where: { familyId: patrol.familyId },
        select: {
          requirePhotoOnStart: true,
          requirePhotoOnEnd: true,
          autoCompleteWhenAllRequired: true,
          patrolIncidentCategoryId: true,
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

    const gracePeriodMinutes = familyCfg?.gracePeriodMinutes ?? 5
    const strictTimeValidation =
      scheduleCfg?.overrideTimeValidation !== null &&
      scheduleCfg?.overrideTimeValidation !== undefined
        ? scheduleCfg.overrideTimeValidation
        : (familyCfg?.strictTimeValidation ?? true)

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
          autoCompleteWhenAllRequired: familyCfg?.autoCompleteWhenAllRequired ?? true,
          patrolIncidentCategoryId: familyCfg?.patrolIncidentCategoryId ?? null,
          gracePeriodMinutes,
          strictTimeValidation,
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

    const sessionUser = session.user as { isSuperAdmin?: boolean }

    // Cancelar: ADMIN con acceso a la familia (antes del gate de agente)
    if (data.action === 'cancel') {
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

    // Force-close: ADMIN/TECH con módulo + acceso — cierra IN_PROGRESS atascada
    if (data.action === 'force_close') {
      if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
        return NextResponse.json(
          { error: 'Solo supervisores pueden forzar el cierre de una ronda' },
          { status: 403 }
        )
      }

      const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
      if (denied) return denied

      const ok = await canViewPatrolAsStaff(
        { id: session.user.id, role: session.user.role, isSuperAdmin: sessionUser.isSuperAdmin },
        patrol.familyId
      )
      if (!ok) {
        return NextResponse.json({ error: 'No autorizado para esta área' }, { status: 403 })
      }

      if (patrol.status !== 'IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Solo se pueden cerrar forzadamente rondas en progreso' },
          { status: 409 }
        )
      }

      const closeResult = await computePatrolCloseFromProgress(id)
      await applyPatrolClose(id, closeResult)

      await AuditServiceComplete.log({
        action: 'PATROL_FORCE_CLOSED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: {
          agentId: patrol.agentId,
          familyId: patrol.familyId,
          reason: data.reason,
          status: closeResult.status,
          completionPercentage: closeResult.completionPercentage,
          missedCount: closeResult.missedCheckpointIds.length,
        },
        request,
      })

      return NextResponse.json({
        success: true,
        status: closeResult.status,
        completionPercentage: closeResult.completionPercentage,
        forced: true,
      })
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
        // Ventana del turno: inicio − gracia … fin + gracia (alineado con check-in)
        const earliestStart = new Date(
          patrol.scheduledStart.getTime() - gracePeriodMinutes * 60 * 1000
        )
        const latestStart = new Date(patrol.scheduledEnd.getTime() + gracePeriodMinutes * 60 * 1000)

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
              error:
                'El horario programado para esta ronda ya finalizó. No se puede iniciar fuera de la ventana de tiempo.',
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

      const closeResult = await computePatrolCloseFromProgress(id)
      await applyPatrolClose(id, closeResult, { endPhotoId })

      // Notificar si completitud por debajo del umbral
      const threshold = familyConfig?.alertCompletionThreshold ?? 80
      if (closeResult.completionPercentage < threshold) {
        const supervisors = await getPatrolSupervisors(patrol.familyId)

        await Promise.allSettled(
          supervisors.map(s =>
            NotificationService.push({
              userId: s.id,
              type: NotificationType.PATROL_INCOMPLETE,
              title: 'Ronda incompleta',
              message: `La patrulla finalizó con ${closeResult.completionPercentage}% de completitud (umbral: ${threshold}%). ${closeResult.missedCheckpointIds.length} checkpoint(s) requerido(s) no visitado(s).`,
              metadata: {
                patrolId: id,
                completionPct: closeResult.completionPercentage,
                missedCheckpointIds: closeResult.missedCheckpointIds,
              },
            })
          )
        )
      }

      await AuditServiceComplete.log({
        action: 'PATROL_ENDED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: {
          status: closeResult.status,
          completionPct: closeResult.completionPercentage,
          missedCount: closeResult.missedCheckpointIds.length,
        },
        request,
      })

      return NextResponse.json({
        success: true,
        status: closeResult.status,
        completionPercentage: closeResult.completionPercentage,
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
