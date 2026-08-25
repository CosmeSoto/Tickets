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
import {
  checkPatrolFamilyAccess,
  checkPatrolFamilyOperate,
  canDeletePatrolResource,
  canSoftDeletePatrolResource,
} from '@/lib/patrol/patrol-access'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { NotificationService } from '@/lib/services/notification-service'
import { NotificationType } from '@prisma/client'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
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
  // null = heredar del default de la familia; true/false = sobreescribir solo para este schedule
  overrideTimeValidation: z.boolean().nullable().optional(),
  // null = sin repetición intra-turno; número = minutos entre sub-rondas dentro del bloque
  repeatIntervalMinutes: z.number().int().min(10).max(1440).nullable().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

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
        overrideTimeValidation: true,
        repeatIntervalMinutes: true,
        createdAt: true,
        updatedAt: true,
        route: { select: { id: true, name: true, estimatedDurationMinutes: true } },
        agent: { select: { id: true, name: true, email: true } },
        _count: { select: { patrols: true } },
      },
    })

    if (!schedule) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyAccess(
      session.user.id,
      schedule.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

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

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden gestionar la configuración de rondas' },
        { status: 403 }
      )
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

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
        repeatIntervalMinutes: true,
      },
    })
    if (!existing) return NextResponse.json({ error: 'Schedule no encontrado' }, { status: 404 })

    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Verificar acceso a la familia del schedule (original)
    const hasAccessOriginal = await checkPatrolFamilyOperate(
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
    // overrideTimeValidation admite null (reset al default de la familia)
    if ('overrideTimeValidation' in data)
      updateData.overrideTimeValidation = data.overrideTimeValidation ?? null
    // repeatIntervalMinutes admite null (quitar la repetición intra-turno)
    if ('repeatIntervalMinutes' in data)
      updateData.repeatIntervalMinutes = data.repeatIntervalMinutes ?? null

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
      const hasAccessNew = await checkPatrolFamilyOperate(
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

    // Si cambiaron datos que afectan las patrullas futuras (hora, días, agente, ruta,
    // repetición intra-turno), cancelar las patrullas PENDING futuras y regenerarlas
    // con los nuevos datos
    const affectsPatrols =
      updateData.scheduledStart !== undefined ||
      updateData.scheduledEnd !== undefined ||
      updateData.recurrenceDays !== undefined ||
      updateData.recurrence !== undefined ||
      updateData.agentId !== undefined ||
      updateData.routeId !== undefined ||
      updateData.repeatIntervalMinutes !== undefined

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
      // Regenerar con los nuevos datos — pasar explícitamente repeatIntervalMinutes:
      // aunque ya quedó persistido en `updated`, generatePatrols no lo lee de BD por sí solo.
      regeneratedCount = await PatrolSchedulerService.generatePatrols(
        id,
        30,
        updated.repeatIntervalMinutes ?? null
      )
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

    // Notificar al agente si cambió el horario, ruta o agente
    const agentChanged = updateData.agentId !== undefined
    const scheduleChanged =
      updateData.scheduledStart !== undefined ||
      updateData.scheduledEnd !== undefined ||
      updateData.recurrenceDays !== undefined ||
      updateData.recurrence !== undefined ||
      updateData.routeId !== undefined

    if (agentChanged || scheduleChanged) {
      const notifyAgentId = (updateData.agentId as string | undefined) ?? existing.agentId
      const { NotificationService } = await import('@/lib/services/notification-service')
      const { NotificationType } = await import('@prisma/client')

      const routeName =
        (updateData.routeId
          ? (
              await import('@/lib/prisma').then(m =>
                m.default.patrol_routes.findUnique({
                  where: { id: updateData.routeId as string },
                  select: { name: true },
                })
              )
            )?.name
          : null) ?? existing.routeId

      await NotificationService.push({
        userId: notifyAgentId,
        type: NotificationType.PATROL_ASSIGNED,
        title: 'Programación de ronda modificada',
        message: agentChanged
          ? `Se te ha reasignado una ronda. Revisa tu programación actualizada.`
          : `Tu ronda ha sido reprogramada. Revisa tu nueva programación en "Mis Rondas".`,
        metadata: { scheduleId: id, familyId: existing.familyId },
      })

      // Telegram: nuevo agente (o mismo agente si solo cambió el horario/ruta)
      queueTelegramNotification({
        recipientUserId: notifyAgentId,
        title: agentChanged ? 'Ronda reasignada a ti' : 'Tu ronda fue reprogramada',
        body: agentChanged
          ? `Se te ha asignado una ronda. Ruta: ${routeName}\nRevisa "Mis Rondas" para ver el horario.`
          : `Tu ronda ha sido reprogramada. Ruta: ${routeName}\nRevisa "Mis Rondas" para el nuevo horario.`,
        module: 'patrols',
        event: 'patrolAssigned',
        link: '/patrol',
      }).catch(err => console.error('[patrol/schedules PATCH] Telegram agente nuevo:', err))

      // Si el agente cambió, notificar también al agente anterior — in-app + Telegram
      if (agentChanged && existing.agentId !== notifyAgentId) {
        await NotificationService.push({
          userId: existing.agentId,
          type: NotificationType.PATROL_ASSIGNED,
          title: 'Ronda desasignada',
          message: `Una de tus rondas programadas ha sido reasignada a otro agente.`,
          metadata: { scheduleId: id, familyId: existing.familyId },
        })
        queueTelegramNotification({
          recipientUserId: existing.agentId,
          title: 'Ronda desasignada',
          body: `Una de tus rondas programadas ha sido reasignada a otro agente.\nRevisa tu agenda en "Mis Rondas".`,
          module: 'patrols',
          event: 'patrolAssigned',
          link: '/patrol',
        }).catch(err => console.error('[patrol/schedules PATCH] Telegram agente anterior:', err))
      }
    }

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

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

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

    if (!canSoftDeletePatrolResource(session.user.role) && !reactivate) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      existing.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No tienes acceso para modificar programaciones en esta área' },
        { status: 403 }
      )
    }

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

    if (isPermanent && !canDeletePatrolResource(session.user.role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar permanentemente programaciones' },
        { status: 403 }
      )
    }

    if (isPermanent) {
      const patrolHistoryCount = await prisma.patrols.count({
        where: {
          scheduleId: id,
          status: { not: 'PENDING' },
        },
      })
      if (patrolHistoryCount > 0) {
        return NextResponse.json(
          {
            error:
              'No se puede eliminar permanentemente: la programación tiene historial de rondas. Usa desactivar en su lugar.',
            code: 'SCHEDULE_HAS_HISTORY',
            patrolHistoryCount,
          },
          { status: 409 }
        )
      }

      await prisma.$transaction(async tx => {
        await tx.patrols.deleteMany({
          where: { scheduleId: id, status: 'PENDING' },
        })
        await tx.patrol_schedules.delete({ where: { id } })
      })

      await AuditServiceComplete.log({
        action: 'PATROL_SCHEDULE_PERMANENTLY_DELETED',
        entityType: 'patrol',
        entityId: id,
        userId: session.user.id,
        request,
      })

      return NextResponse.json({ success: true, message: 'Programación eliminada permanentemente' })
    }

    // Soft delete: desactivar + cancelar PENDING futuras
    const pendingPatrols = await prisma.patrols.findMany({
      where: { scheduleId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
      select: { id: true, agentId: true },
    })

    await prisma.$transaction([
      prisma.patrol_schedules.update({ where: { id }, data: { isActive: false } }),
      prisma.patrols.updateMany({
        where: { scheduleId: id, status: 'PENDING', scheduledStart: { gt: new Date() } },
        data: { status: 'MISSED' },
      }),
    ])

    const uniqueAgentIds = [...new Set(pendingPatrols.map(p => p.agentId))]
    await Promise.allSettled(
      uniqueAgentIds.map(agentId =>
        NotificationService.push({
          userId: agentId,
          type: NotificationType.WARNING,
          title: 'Programación desactivada',
          message: 'Se cancelaron rondas pendientes asociadas a una programación desactivada.',
          metadata: { link: '/patrol' },
        })
      )
    )

    // Telegram: mismo aviso a cada agente afectado
    await Promise.allSettled(
      uniqueAgentIds.map(agentId =>
        queueTelegramNotification({
          recipientUserId: agentId,
          title: 'Programación de ronda cancelada',
          body: `Se han cancelado tus rondas pendientes de esta programación.\nRevisa "Mis Rondas" para ver tu agenda actualizada.`,
          module: 'patrols',
          event: 'patrolCancelled',
          link: '/patrol',
        }).catch(err => console.error('[patrol/schedules DELETE] Telegram:', err))
      )
    )

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_DEACTIVATED',
      entityType: 'patrol',
      entityId: id,
      userId: session.user.id,
      details: { cancelledPending: pendingPatrols.length },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Programación desactivada',
      cancelledPending: pendingPatrols.length,
    })
  } catch (error) {
    console.error('[patrol/schedules/[id]] DELETE:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
