/**
 * GET    /api/patrols/schedules/[id]  — Detalle de schedule
 * PATCH  /api/patrols/schedules/[id]  — Actualiza schedule
 * DELETE /api/patrols/schedules/[id]  — Desactiva schedule
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

const patchScheduleSchema = z.object({
  isActive: z.boolean().optional(),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const schedule = await prisma.patrol_schedules.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        routeId: true,
        guardId: true,
        scheduledStart: true,
        scheduledEnd: true,
        recurrence: true,
        recurrenceDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        route: { select: { id: true, name: true, estimatedDurationMinutes: true } },
        guard: { select: { id: true, name: true, email: true } },
        _count: { select: { patrols: true } },
      },
    })

    if (!schedule) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    return NextResponse.json({ success: true, data: schedule })
  } catch (error) {
    console.error('[patrol/schedules/[id]] GET:', error)
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
    const existing = await prisma.patrol_schedules.findUnique({
      where: { id },
      select: { id: true, isActive: true, guardId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    const body = await request.json()
    const data = patchScheduleSchema.parse(body)

    const updated = await prisma.patrol_schedules.update({
      where: { id },
      data,
    })

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_UPDATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      oldValues: { isActive: existing.isActive },
      newValues: data,
      request,
    })

    return NextResponse.json({
      success: true,
      data: { id: updated.id, isActive: updated.isActive },
    })
  } catch (error) {
    console.error('[patrol/schedules/[id]] PATCH:', error)
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
    const existing = await prisma.patrol_schedules.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    })
    if (!existing) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    await prisma.patrol_schedules.update({ where: { id }, data: { isActive: false } })

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_DEACTIVATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      request,
    })

    return NextResponse.json({ success: true, message: 'Schedule desactivado' })
  } catch (error) {
    console.error('[patrol/schedules/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
