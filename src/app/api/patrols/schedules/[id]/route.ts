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
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'
import {
  assertScheduleAgent,
  assertScheduleRoute,
  assertNoAgentScheduleOverlap,
  ScheduleValidationError,
} from '@/lib/patrol/schedule-validation'

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

    const targetFamilyId = data.familyId ?? existing.familyId
    const targetRouteId = data.routeId ?? existing.routeId
    const targetAgentId = data.agentId ?? existing.agentId
    const targetStart = updateData.scheduledStart ?? existing.scheduledStart
    const targetEnd = updateData.scheduledEnd ?? existing.scheduledEnd
    const targetRecurrence = data.recurrence ?? existing.recurrence
    const targetRecurrenceDays = data.recurrenceDays ?? existing.recurrenceDays

    try {
      await assertScheduleRoute({ routeId: targetRouteId, familyId: targetFamilyId })
      await assertScheduleAgent({ agentId: targetAgentId, familyId: targetFamilyId })

      const slotChanged =
        updateData.agentId !== undefined ||
        updateData.scheduledStart !== undefined ||
        updateData.scheduledEnd !== undefined ||
        updateData.recurrence !== undefined ||
        updateData.recurrenceDays !== undefined

      if (slotChanged) {
        await assertNoAgentScheduleOverlap(
          {
            agentId: targetAgentId,
            scheduledStart: targetStart,
            scheduledEnd: targetEnd,
            recurrence: targetRecurrence,
            recurrenceDays: targetRecurrenceDays,
          },
          { excludeScheduleId: id }
        )
      }
    } catch (err) {
      if (err instanceof ScheduleValidationError) {
        return NextResponse.json(
          { error: err.message, ...(err.code ? { code: err.code } : {}) },
          { status: err.statusCode }
        )
      }
      throw err
    }

    // Si cambia la familia, verificar acceso a la nueva familia
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

    // Si cambiaron datos que afectan las patrullas futuras (hora, días, agente, ruta),
    // cancelar las patrullas PENDING futuras y regenerarlas con los nuevos datos
    const affectsPatrols =
      updateData.scheduledStart !== undefined ||
      updateData.scheduledEnd !== undefined ||
      updateData.recurrenceDays !== undefined ||
      updateData.recurrence !== undefined ||
      updateData.agentId !== undefined ||
      updateData.routeId !== undefined

    let regeneratedCount = 0
    if (affectsPatrols && updated.isActive) {
      // Cancelar patrullas PENDING futuras de este schedule
      await prisma.patrols.deleteMany({
        where: {
          scheduleId: id,
          status: 'PENDING',
          scheduledStart: { gt: new Date() },
        },
      })
      // Regenerar con los nuevos datos
      regeneratedCount = await PatrolSchedulerService.generatePatrols(id, 30)
    }

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_UPDATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      oldValues: existing,
      newValues: { ...data, regeneratedPatrols: regeneratedCount },
      request,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      regeneratedPatrols: regeneratedCount,
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
      // Primero borramos todas las patrullas asociadas (con sus check-ins y fotos)
      await prisma.$transaction(async tx => {
        // 1. Primero obtenemos los IDs de las patrullas para este schedule
        const patrolIds = (
          await tx.patrols.findMany({
            where: { scheduleId: id },
            select: { id: true },
          })
        ).map(p => p.id)

        if (patrolIds.length > 0) {
          // 2. Desasignamos las fotos de las patrullas para evitar restricciones
          await tx.patrols.updateMany({
            where: { scheduleId: id },
            data: { startPhotoId: null, endPhotoId: null },
          })

          // 3. Borramos check-ins
          await tx.patrol_check_ins.deleteMany({
            where: { patrolId: { in: patrolIds } },
          })

          // 4. Borramos fotos
          await tx.patrol_photos.deleteMany({
            where: { patrolId: { in: patrolIds } },
          })

          // 5. Borramos patrullas
          await tx.patrols.deleteMany({
            where: { id: { in: patrolIds } },
          })
        }

        // 6. Borramos la programación
        await tx.patrol_schedules.delete({
          where: { id },
        })
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
