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

/** Admin/técnico: solo patrullas del área (familia) asignada; admin sin asignaciones = acceso legacy total. */
async function canViewPatrolAsStaff(
  user: { id: string; role: string; isSuperAdmin?: boolean },
  familyId: string
): Promise<boolean> {
  if (user.role === 'ADMIN') {
    if (user.isSuperAdmin) return true
    const forFamily = await prisma.admin_family_assignments.count({
      where: { adminId: user.id, familyId, isActive: true },
    })
    if (forFamily > 0) return true
    const anyAssign = await prisma.admin_family_assignments.count({
      where: { adminId: user.id, isActive: true },
    })
    return anyAssign === 0
  }
  if (user.role === 'TECHNICIAN') {
    const n = await prisma.technician_family_assignments.count({
      where: { technicianId: user.id, familyId, isActive: true },
    })
    return n > 0
  }
  return false
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
        guardId: true,
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
        guard: { select: { id: true, name: true, email: true } },
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

    const isGuard = patrol.guardId === session.user.id
    const sessionUser = session.user as { isSuperAdmin?: boolean }
    if (!isGuard) {
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
      select: { requirePhotoOnStart: true, requirePhotoOnEnd: true },
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
        guardId: true,
        familyId: true,
        status: true,
        routeId: true,
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

    // Solo el guardia asignado puede iniciar/finalizar
    if (patrol.guardId !== session.user.id) {
      return NextResponse.json(
        { error: 'Solo el guardia asignado puede operar esta patrulla' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = patchPatrolSchema.parse(body)

    // Obtener config de familia para saber si se requiere foto
    const familyConfig = await prisma.patrol_family_config.findUnique({
      where: { familyId: patrol.familyId },
      select: {
        requirePhotoOnStart: true,
        requirePhotoOnEnd: true,
        alertCompletionThreshold: true,
      },
    })

    if (data.action === 'start') {
      if (patrol.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'La patrulla no está en estado PENDING' },
          { status: 409 }
        )
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
        // Notificar supervisores
        const supervisors = await prisma.users.findMany({
          where: {
            isActive: true,
            patrolsEnabled: true,
            role: { in: ['ADMIN', 'TECHNICIAN'] },
            OR: [
              { adminFamilyAssignments: { some: { familyId: patrol.familyId, isActive: true } } },
              {
                technicianFamilyAssignments: {
                  some: { familyId: patrol.familyId, isActive: true },
                },
              },
            ],
          },
          select: { id: true },
        })

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
