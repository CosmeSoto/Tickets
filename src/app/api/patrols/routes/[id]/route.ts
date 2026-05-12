/**
 * GET    /api/patrols/routes/[id]  — Detalle de ruta
 * PATCH  /api/patrols/routes/[id]  — Actualiza ruta
 * DELETE /api/patrols/routes/[id]  — Desactiva ruta (cancela patrullas PENDING)
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

    const body = await request.json()
    const { checkpoints, ...rest } = patchRouteSchema.parse(body)

    const updated = await prisma.$transaction(async tx => {
      const updatedRoute = await tx.patrol_routes.update({
        where: { id },
        data: rest,
      })

      // Si se envían checkpoints, reemplazar la lista completa
      if (checkpoints !== undefined) {
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
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── DELETE (soft + cancelar patrullas PENDING) ────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.patrol_routes.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    })
    if (!existing) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 })

    // Cancelar patrullas PENDING futuras y notificar guardias
    const pendingPatrols = await prisma.patrols.findMany({
      where: { routeId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
      select: { id: true, guardId: true, scheduledStart: true },
    })

    await prisma.$transaction([
      prisma.patrol_routes.update({ where: { id }, data: { isActive: false } }),
      prisma.patrols.updateMany({
        where: { routeId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
        data: { status: 'MISSED' },
      }),
    ])

    // Notificar guardias afectados
    const uniqueGuardIds = [...new Set(pendingPatrols.map(p => p.guardId))]
    await Promise.allSettled(
      uniqueGuardIds.map(guardId =>
        NotificationService.push({
          userId: guardId,
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
