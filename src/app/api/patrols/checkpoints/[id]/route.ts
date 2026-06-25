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
import { checkPatrolFamilyAccess, checkPatrolFamilyOperate, canDeletePatrolResource } from '@/lib/patrol/patrol-access'

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
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const existing = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true, familyId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

    // Si es hard delete, solo SuperAdmin puede hacerlo
    if (isPermanent && !canDeletePatrolResource(session.user.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar permanentemente checkpoints' },
        { status: 403 }
      )
    }

    // Soft delete (desactivar): ADMIN y TECHNICIAN pueden hacerlo (con acceso a la familia)
    if (!isPermanent) {
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
      // Verificar si el checkpoint está en alguna ruta
      const routeCheckpointCount = await prisma.patrol_route_checkpoints.count({
        where: { checkpointId: id },
      })
      if (routeCheckpointCount > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar el checkpoint porque está en uso en rutas' },
          { status: 409 }
        )
      }

      // Hard delete: eliminar permanentemente de la BD
      await prisma.patrol_checkpoints.delete({
        where: { id },
      })

      await AuditServiceComplete.log({
        action: 'PATROL_CHECKPOINT_PERMANENTLY_DELETED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, familyId: existing.familyId },
        request,
      })

      return NextResponse.json({ success: true, message: 'Checkpoint eliminado permanentemente' })
    } else {
      // Soft delete — preserva historial de check-ins
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
  } catch (error) {
    console.error('[patrol/checkpoints/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
