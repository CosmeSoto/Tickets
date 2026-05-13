/**
 * GET    /api/patrols/checkpoints/[id]  — Detalle de checkpoint
 * PATCH  /api/patrols/checkpoints/[id]  — Actualiza checkpoint
 * DELETE /api/patrols/checkpoints/[id]  — Desactiva checkpoint (soft delete)
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

    const body = await request.json()
    const { regenerateSecret, ...rest } = patchCheckpointSchema.parse(body)

    // Si cambia hasConnectivity, recalcular qrType
    const newHasConnectivity = rest.hasConnectivity ?? existing.hasConnectivity
    const newQrType = newHasConnectivity ? 'DYNAMIC' : 'STATIC'

    const updateData: Record<string, unknown> = { ...rest, qrType: newQrType }

    if (regenerateSecret) {
      updateData.qrSecret = PatrolQRService.generateSecret()
      if (newQrType === 'STATIC') {
        updateData.qrStaticToken = PatrolQRService.generateStaticToken()
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
        secretRegenerated: !!regenerateSecret,
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

// ── DELETE (soft) ─────────────────────────────────────────────────────────────

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
    const existing = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    })
    if (!existing) return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

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
      details: { name: existing.name },
      request,
    })

    return NextResponse.json({ success: true, message: 'Checkpoint desactivado' })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
