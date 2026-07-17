/**
 * GET    /api/patrols/routes/[id]  — Detalle de ruta
 * PATCH  /api/patrols/routes/[id]  — Actualiza ruta (ADMIN de la familia o SuperAdmin)
 * DELETE /api/patrols/routes/[id]  — Desactiva ruta — solo SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  checkPatrolFamilyAccess,
  checkPatrolFamilyOperate,
  canDeletePatrolResource,
  canSoftDeletePatrolResource,
} from '@/lib/patrol/patrol-access'

const patchRouteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440).optional(),
  checkpoints: z
    .array(
      z.object({
        checkpointId: z.string().uuid(),
        order: z.number().int().min(1),
        isRequired: z.boolean().default(true),
      })
    )
    .optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const route = await prisma.patrol_routes.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        name: true,
        description: true,
        estimatedDurationMinutes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        routeCheckpoints: {
          select: {
            order: true,
            isRequired: true,
            checkpoint: {
              select: {
                id: true,
                name: true,
                location: true,
                isActive: true,
                qrType: true,
                isSensitive: true,
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!route) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 })

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyAccess(
      session.user.id,
      route.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: route })
  } catch (error) {
    console.error('[patrol/routes/[id]] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.patrol_routes.findUnique({
      where: { id },
      select: { id: true, name: true, familyId: true, isActive: true },
    })
    if (!existing) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 })

    // Verificar acceso a la familia de la ruta
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      existing.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes acceso para modificar rutas en esta área' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { checkpoints, ...rest } = patchRouteSchema.parse(body)

    const updated = await prisma.$transaction(async tx => {
      const updatedRoute = await tx.patrol_routes.update({
        where: { id },
        data: rest,
      })

      // Si se envían checkpoints, reemplazar la lista completa
      if (checkpoints !== undefined) {
        if (checkpoints.length > 0) {
          const checkpointIds = checkpoints.map(c => c.checkpointId)
          const validCheckpoints = await tx.patrol_checkpoints.findMany({
            where: {
              id: { in: checkpointIds },
              familyId: existing.familyId,
              isActive: true,
            },
            select: { id: true },
          })
          if (validCheckpoints.length !== checkpointIds.length) {
            throw new Error('Uno o más checkpoints no pertenecen a esta área o están inactivos')
          }
        }

        await tx.patrol_route_checkpoints.deleteMany({ where: { routeId: id } })
        if (checkpoints.length > 0) {
          await tx.patrol_route_checkpoints.createMany({
            data: checkpoints.map(c => ({
              id: randomUUID(),
              routeId: id,
              checkpointId: c.checkpointId,
              order: c.order,
              isRequired: c.isRequired,
            })),
          })
        }
      }

      return updatedRoute
    })

    await AuditServiceComplete.log({
      action: 'PATROL_ROUTE_UPDATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      oldValues: { name: existing.name },
      newValues: { name: updated.name, checkpointsUpdated: checkpoints !== undefined },
      request,
    })

    return NextResponse.json({ success: true, data: { id: updated.id, name: updated.name } })
  } catch (error) {
    console.error('[patrol/routes/[id]] PATCH:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('checkpoints')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── DELETE (soft o hard) — solo SuperAdmin para hard delete ──────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const isPermanent = searchParams.get('permanent') === 'true'
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const existing = await prisma.patrol_routes.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, familyId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 })

    // Si es hard delete, solo SuperAdmin puede hacerlo
    if (isPermanent && !canDeletePatrolResource(session.user.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar permanentemente rutas' },
        { status: 403 }
      )
    }

    if (!isPermanent) {
      if (!canSoftDeletePatrolResource(session.user.role)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      const hasAccess = await checkPatrolFamilyOperate(
        session.user.id,
        existing.familyId,
        session.user.role,
        isSuperAdmin
      )
      if (!hasAccess) {
        return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
      }
    }

    if (isPermanent) {
      const [patrolCount, scheduleCount, activeSchedules] = await Promise.all([
        prisma.patrols.count({ where: { routeId: id } }),
        prisma.patrol_schedules.count({ where: { routeId: id } }),
        prisma.patrol_schedules.findMany({
          where: { routeId: id, isActive: true },
          select: {
            scheduledStart: true,
            agent: { select: { name: true } },
          },
          take: 5,
        }),
      ])
      if (patrolCount > 0 || scheduleCount > 0) {
        const scheduleLabels = activeSchedules.map(
          s => `${s.agent?.name ?? 'Agente'} (${s.scheduledStart.toLocaleString('es-EC')})`
        )
        return NextResponse.json(
          {
            error:
              'No se puede eliminar la ruta: tiene programaciones o patrullas. Primero desactiva las programaciones en Programación.',
            code: 'ROUTE_IN_USE',
            patrolCount,
            scheduleCount,
            schedules: scheduleLabels,
          },
          { status: 409 }
        )
      }

      await prisma.$transaction([
        prisma.patrol_route_checkpoints.deleteMany({ where: { routeId: id } }),
        prisma.patrol_routes.delete({ where: { id } }),
      ])

      await AuditServiceComplete.log({
        action: 'PATROL_ROUTE_PERMANENTLY_DELETED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, familyId: existing.familyId },
        request,
      })

      return NextResponse.json({ success: true, message: 'Ruta eliminada permanentemente' })
    }

    // Soft delete: exigir desactivar programaciones activas primero
    const activeSchedules = await prisma.patrol_schedules.findMany({
      where: { routeId: id, isActive: true },
      select: {
        scheduledStart: true,
        agent: { select: { name: true } },
      },
      take: 8,
    })
    if (activeSchedules.length > 0) {
      const scheduleLabels = activeSchedules.map(
        s => `${s.agent?.name ?? 'Agente'} (${s.scheduledStart.toLocaleString('es-EC')})`
      )
      return NextResponse.json(
        {
          error: `No se puede desactivar la ruta: tiene ${activeSchedules.length} programación(es) activa(s). Primero desactívalas en Programación.`,
          code: 'ROUTE_HAS_ACTIVE_SCHEDULES',
          scheduleCount: activeSchedules.length,
          schedules: scheduleLabels,
        },
        { status: 409 }
      )
    }

    const pendingPatrols = await prisma.patrols.findMany({
      where: { routeId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
      select: { id: true, agentId: true, scheduledStart: true },
    })

    await prisma.$transaction([
      prisma.patrol_routes.update({ where: { id }, data: { isActive: false } }),
      prisma.patrols.updateMany({
        where: { routeId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
        data: { status: 'MISSED' },
      }),
    ])

    const uniqueAgentIds = [...new Set(pendingPatrols.map(p => p.agentId))]
    await Promise.allSettled(
      uniqueAgentIds.map(agentId =>
        NotificationService.push({
          userId: agentId,
          type: NotificationType.WARNING,
          title: 'Ruta desactivada',
          message: `La ruta "${existing.name}" ha sido desactivada. Las patrullas programadas han sido canceladas.`,
          metadata: { routeId: id },
        })
      )
    )

    await AuditServiceComplete.log({
      action: 'PATROL_ROUTE_DEACTIVATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      details: { name: existing.name, cancelledPatrols: pendingPatrols.length },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Ruta desactivada',
      cancelledPatrols: pendingPatrols.length,
    })
  } catch (error) {
    console.error('[patrol/routes/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
