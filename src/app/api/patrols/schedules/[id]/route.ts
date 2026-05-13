/**
 * GET    /api/patrols/schedules/[id]  — Detalle de schedule
 * PATCH  /api/patrols/schedules/[id]  — Actualiza schedule (ADMIN de la familia o SuperAdmin)
 * DELETE /api/patrols/schedules/[id]  — Desactiva schedule — solo SuperAdmin
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { checkPatrolFamilyAccess, canDeletePatrolResource } from '@/lib/patrol/patrol-access'

const patchScheduleSchema = z.object({
  familyId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'CUSTOM']).optional(),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).optional(),
  isActive: z.boolean().optional(),
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
        agentId: true,
        scheduledStart: true,
        scheduledEnd: true,
        recurrence: true,
        recurrenceDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        route: { select: { id: true, name: true, estimatedDurationMinutes: true } },
        agent: { select: { id: true, name: true, email: true } },
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
      select: {
        id: true,
        isActive: true,
        agentId: true,
        familyId: true,
        routeId: true,
        scheduledStart: true,
        scheduledEnd: true,
        recurrence: true,
        recurrenceDays: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Verificar acceso a la familia del schedule (original)
    const hasAccessOriginal = await checkPatrolFamilyAccess(
      session.user.id,
      existing.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccessOriginal) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    const body = await request.json()
    const data = patchScheduleSchema.parse(body)

    // Preparar datos para actualizar
    const updateData: any = {}

    if (data.familyId !== undefined) updateData.familyId = data.familyId
    if (data.routeId !== undefined) updateData.routeId = data.routeId
    if (data.agentId !== undefined) updateData.agentId = data.agentId
    if (data.scheduledStart !== undefined) updateData.scheduledStart = new Date(data.scheduledStart)
    if (data.scheduledEnd !== undefined) updateData.scheduledEnd = new Date(data.scheduledEnd)
    if (data.recurrence !== undefined) updateData.recurrence = data.recurrence
    if (data.recurrenceDays !== undefined) updateData.recurrenceDays = data.recurrenceDays
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    // Validaciones adicionales
    if (updateData.scheduledStart && updateData.scheduledEnd) {
      if (updateData.scheduledEnd <= updateData.scheduledStart) {
        return NextResponse.json(
          { error: 'La hora de fin debe ser posterior a la de inicio' },
          { status: 422 }
        )
      }
    }

    // Si cambia el agente, validar que tenga patrolsEnabled
    if (updateData.agentId) {
      const agent = await prisma.users.findUnique({
        where: { id: updateData.agentId },
        select: { id: true, patrolsEnabled: true },
      })
      if (!agent?.patrolsEnabled) {
        return NextResponse.json(
          { error: 'El usuario seleccionado no tiene el módulo de patrullas habilitado' },
          { status: 422 }
        )
      }
    }

    // Si cambia la ruta, validar que exista y esté activa
    if (updateData.routeId) {
      const route = await prisma.patrol_routes.findUnique({
        where: { id: updateData.routeId },
        select: { id: true, isActive: true },
      })
      if (!route?.isActive) {
        return NextResponse.json({ error: 'La ruta no está activa' }, { status: 422 })
      }
    }

    // Si cambia la familia, verificar acceso a la nueva familia
    const targetFamilyId = data.familyId || existing.familyId
    if (targetFamilyId !== existing.familyId) {
      const hasAccessNew = await checkPatrolFamilyAccess(
        session.user.id,
        targetFamilyId,
        session.user.role,
        isSuperAdmin
      )
      if (!hasAccessNew) {
        return NextResponse.json({ error: 'No tienes acceso a la nueva área' }, { status: 403 })
      }
    }

    const updated = await prisma.patrol_schedules.update({
      where: { id },
      data: updateData,
    })

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_UPDATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      oldValues: existing,
      newValues: data,
      request,
    })

    return NextResponse.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('[patrol/schedules/[id]] PATCH:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── DELETE (soft o hard) o REACTIVAR ──────────────────────────────────────────

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
    const reactivate = searchParams.get('reactivate') === 'true'
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const existing = await prisma.patrol_schedules.findUnique({
      where: { id },
      select: { id: true, isActive: true, familyId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    // Verificar acceso a la familia
    const hasAccess = await checkPatrolFamilyAccess(
      session.user.id,
      existing.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    // Reactivar
    if (reactivate) {
      await prisma.patrol_schedules.update({ where: { id }, data: { isActive: true } })

      await AuditServiceComplete.log({
        action: 'PATROL_SCHEDULE_REACTIVATED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        request,
      })

      return NextResponse.json({ success: true, message: 'Programación reactivada' })
    }

    // Si es hard delete, solo SuperAdmin puede hacerlo
    if (isPermanent && !canDeletePatrolResource(session.user.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar permanentemente programaciones' },
        { status: 403 }
      )
    }

    if (isPermanent) {
      // Verificar si la programación tiene patrullas asociadas
      const patrolCount = await prisma.patrols.count({
        where: { scheduleId: id },
      })
      if (patrolCount > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar la programación porque tiene patrullas asociadas' },
          { status: 409 }
        )
      }

      // Hard delete: eliminar permanentemente de la BD
      await prisma.patrol_schedules.delete({
        where: { id },
      })

      await AuditServiceComplete.log({
        action: 'PATROL_SCHEDULE_PERMANENTLY_DELETED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        request,
      })

      return NextResponse.json({ success: true, message: 'Programación eliminada permanentemente' })
    } else {
      // Soft delete: desactivar
      await prisma.patrol_schedules.update({ where: { id }, data: { isActive: false } })

      await AuditServiceComplete.log({
        action: 'PATROL_SCHEDULE_DEACTIVATED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        request,
      })

      return NextResponse.json({ success: true, message: 'Programación desactivada' })
    }
  } catch (error) {
    console.error('[patrol/schedules/[id]] DELETE:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
