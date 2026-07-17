/**
 * GET    /api/patrols/checkpoints/[id]  — Detalle de checkpoint
 * PATCH  /api/patrols/checkpoints/[id]  — Actualiza checkpoint (ADMIN de la familia o SuperAdmin)
 * DELETE /api/patrols/checkpoints/[id]  — Desactiva checkpoint — solo SuperAdmin
 *
 * qrSecret y qrStaticToken NUNCA se incluyen en las respuestas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import {
  checkPatrolFamilyAccess,
  checkPatrolFamilyOperate,
  canDeletePatrolResource,
  canSoftDeletePatrolResource,
} from '@/lib/patrol/patrol-access'

const SAFE_CHECKPOINT_SELECT = {
  id: true,
  familyId: true,
  name: true,
  description: true,
  location: true,
  latitude: true,
  longitude: true,
  geofenceRadiusMeters: true,
  hasConnectivity: true,
  isSensitive: true,
  isActive: true,
  qrType: true,
  createdAt: true,
  updatedAt: true,
  family: {
    select: {
      patrolFamilyConfig: {
        select: {
          qrWindowMinutes: true,
        },
      },
    },
  },
} as const

const patchCheckpointSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  location: z.string().min(1).max(500).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  geofenceRadiusMeters: z.number().min(1).max(10000).nullable().optional(),
  hasConnectivity: z.boolean().optional(),
  isSensitive: z.boolean().optional(),
  isActive: z.boolean().optional(), // Para reactivar un checkpoint desactivado
  regenerateSecret: z.boolean().optional(), // Si true, genera nuevo qrSecret
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const checkpoint = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: SAFE_CHECKPOINT_SELECT,
    })

    if (!checkpoint)
      return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyAccess(
      session.user.id,
      checkpoint.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    return NextResponse.json({ success: true, data: checkpoint })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]] GET:', error)
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
    const existing = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: { ...SAFE_CHECKPOINT_SELECT, qrSecret: true, qrStaticToken: true },
    })
    if (!existing) return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

    // Verificar acceso a la familia del checkpoint
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      existing.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    const body = await request.json()
    const { regenerateSecret, ...rest } = patchCheckpointSchema.parse(body)

    // Si cambia hasConnectivity, recalcular qrType
    const newHasConnectivity = rest.hasConnectivity ?? existing.hasConnectivity
    const newQrType = newHasConnectivity ? 'DYNAMIC' : 'STATIC'
    const qrTypeChanged = newQrType !== existing.qrType

    const updateData: Record<string, unknown> = { ...rest, qrType: newQrType }

    // Regenerar tokens si:
    // 1. Se pidió explícitamente (regenerateSecret: true)
    // 2. El qrType cambió (DYNAMIC→STATIC o STATIC→DYNAMIC)
    if (regenerateSecret || qrTypeChanged) {
      updateData.qrSecret = PatrolQRService.generateSecret()
      if (newQrType === 'STATIC') {
        updateData.qrStaticToken = PatrolQRService.generateStaticToken()
      } else {
        // DYNAMIC no usa qrStaticToken
        updateData.qrStaticToken = null
      }
    }

    const updated = await prisma.patrol_checkpoints.update({
      where: { id },
      data: updateData,
      select: SAFE_CHECKPOINT_SELECT,
    })

    await AuditServiceComplete.log({
      action: 'PATROL_CHECKPOINT_UPDATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      oldValues: {
        name: existing.name,
        hasConnectivity: existing.hasConnectivity,
        qrType: existing.qrType,
        isActive: existing.isActive,
      },
      newValues: {
        name: updated.name,
        hasConnectivity: updated.hasConnectivity,
        qrType: updated.qrType,
        isActive: updated.isActive,
        secretRegenerated: !!(regenerateSecret || qrTypeChanged),
      },
      request,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]] PATCH:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
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
    const removeFromRoutes = searchParams.get('removeFromRoutes') === 'true'
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const existing = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, familyId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

    // Hard delete: solo SuperAdmin
    if (isPermanent && !canDeletePatrolResource(session.user.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar permanentemente checkpoints' },
        { status: 403 }
      )
    }

    // Soft delete (desactivar): solo ADMIN/TECH con acceso operational
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

      // Ciclo: no desactivar si sigue en rutas activas
      const activeRouteLinks = await prisma.patrol_route_checkpoints.findMany({
        where: { checkpointId: id, route: { isActive: true } },
        select: { route: { select: { name: true } } },
      })
      if (activeRouteLinks.length > 0) {
        const routeNames = [...new Set(activeRouteLinks.map(l => l.route.name))]
        return NextResponse.json(
          {
            error: `No se puede desactivar: está en rutas activas (${routeNames.join(', ')}). Primero desactiva o edita esas rutas.`,
            code: 'CHECKPOINT_IN_ACTIVE_ROUTES',
            routes: routeNames,
            routeCount: activeRouteLinks.length,
          },
          { status: 409 }
        )
      }

      await prisma.patrol_checkpoints.update({
        where: { id },
        data: { isActive: false },
      })

      await AuditServiceComplete.log({
        action: 'PATROL_CHECKPOINT_DEACTIVATED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, familyId: existing.familyId },
        request,
      })

      return NextResponse.json({ success: true, message: 'Checkpoint desactivado' })
    }

    // Hard delete
    const routeLinks = await prisma.patrol_route_checkpoints.findMany({
      where: { checkpointId: id },
      select: {
        routeId: true,
        route: { select: { id: true, name: true } },
      },
    })

    if (routeLinks.length > 0 && !removeFromRoutes) {
      const routeNames = [...new Set(routeLinks.map(l => l.route.name))]
      return NextResponse.json(
        {
          error: `No se puede eliminar: está en rutas (${routeNames.join(', ')}). Primero quítalo de Rutas o desactiva esas rutas.`,
          code: 'CHECKPOINT_IN_USE',
          routes: routeNames,
          routeCount: routeLinks.length,
        },
        { status: 409 }
      )
    }

    const [checkInCount, incidentCount] = await Promise.all([
      prisma.patrol_check_ins.count({ where: { checkpointId: id } }),
      prisma.patrol_incidents.count({ where: { checkpointId: id } }),
    ])
    if (checkInCount > 0 || incidentCount > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar permanentemente: tiene historial. Usa desactivar en su lugar.',
          code: 'CHECKPOINT_HAS_HISTORY',
          checkInCount,
          incidentCount,
        },
        { status: 409 }
      )
    }

    try {
      await prisma.$transaction(async tx => {
        if (routeLinks.length > 0) {
          await tx.patrol_route_checkpoints.deleteMany({
            where: { checkpointId: id },
          })
        }
        await tx.patrol_checkpoints.delete({
          where: { id },
        })
      })
    } catch (err) {
      console.error('[patrol/checkpoints/[id]] hard delete FK:', err)
      return NextResponse.json(
        {
          error:
            'No se pudo eliminar: el checkpoint tiene dependencias. Usa desactivar en su lugar.',
          code: 'CHECKPOINT_HAS_DEPENDENCIES',
        },
        { status: 409 }
      )
    }

    await AuditServiceComplete.log({
      action: 'PATROL_CHECKPOINT_PERMANENTLY_DELETED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      details: {
        name: existing.name,
        familyId: existing.familyId,
        removedFromRoutes: routeLinks.length > 0,
        routes: routeLinks.map(l => l.route.name),
      },
      request,
    })

    return NextResponse.json({
      success: true,
      message:
        routeLinks.length > 0
          ? 'Checkpoint eliminado y quitado de las rutas'
          : 'Checkpoint eliminado permanentemente',
    })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
