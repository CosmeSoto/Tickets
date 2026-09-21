/**
 * PATCH  /api/planner/personal-tasks/[id] — edita o cambia el estado.
 * DELETE /api/planner/personal-tasks/[id] — elimina.
 * Ambas exigen que la tarea sea del propio usuario — v1 es estrictamente
 * personal, no hay asignación a otro usuario ni gestión por un tercero.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { combineDateAndTime, validateTimeRange } from '@/lib/time-utils'
import { createAuditLog } from '@/lib/audit'
import {
  assertCanViewPlanner,
  getPlannerAccess,
  isFamilyWithinPlannerScope,
} from '@/lib/planner/access'
import { MsTodoSyncService } from '@/lib/services/ms-todo-sync-service'
import {
  isValidPersonalTaskPriority,
  isValidPersonalTaskStatus,
} from '@/lib/planner/personal-task-validation'

function serializeTask(task: {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: Date | null
  startTime: string | null
  endTime: string | null
  completedAt: Date | null
  family: { id: string; name: string; color: string | null } | null
  user: { id: string; name: string; email: string }
}) {
  return {
    origin: 'personal' as const,
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    startTime: task.startTime,
    endTime: task.endTime,
    completedAt: task.completedAt?.toISOString() ?? null,
    assignee: task.user,
    ticketId: null,
    ticketTitle: null,
    planTitle: null,
    family: task.family,
    canEdit: true,
    canDelete: true,
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const denied = await assertCanViewPlanner(session.user.id, session.user.role)
    if (denied) return denied

    const { id } = await params
    const task = await prisma.personal_tasks.findUnique({ where: { id } })
    if (!task) {
      return NextResponse.json({ success: false, message: 'Tarea no encontrada' }, { status: 404 })
    }
    if (task.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No puedes editar una tarea de otro usuario' },
        { status: 403 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 })
    }

    if (body.status !== undefined && !isValidPersonalTaskStatus(body.status)) {
      return NextResponse.json({ success: false, message: 'Estado inválido' }, { status: 400 })
    }
    if (body.priority !== undefined && !isValidPersonalTaskPriority(body.priority)) {
      return NextResponse.json({ success: false, message: 'Prioridad inválida' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const changes: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) {
      updateData.title = body.title.trim()
      changes.title = { old: task.title, new: body.title.trim() }
    }

    if (body.description !== undefined) {
      updateData.description = (body.description as string | null)?.trim() || null
    }

    if (body.status !== undefined) {
      updateData.status = body.status
      changes.status = { old: task.status, new: body.status }
      if (body.status === 'completed' && task.status !== 'completed') {
        updateData.completedAt = new Date()
      }
      if (body.status !== 'completed' && task.status === 'completed') {
        updateData.completedAt = null
      }
    }

    if (body.priority !== undefined) {
      updateData.priority = body.priority
    }

    if (body.startTime !== undefined || body.endTime !== undefined) {
      const newStartTime = (body.startTime !== undefined ? body.startTime : task.startTime) as
        | string
        | null
      const newEndTime = (body.endTime !== undefined ? body.endTime : task.endTime) as string | null
      if (newStartTime && newEndTime && !validateTimeRange(newStartTime, newEndTime)) {
        return NextResponse.json(
          { success: false, message: 'La hora de fin debe ser posterior a la hora de inicio' },
          { status: 400 }
        )
      }
      if (body.startTime !== undefined) updateData.startTime = body.startTime
      if (body.endTime !== undefined) updateData.endTime = body.endTime
    }

    // Fecha límite: siempre combinar fecha+hora con combineDateAndTime (hora
    // local) — ver la misma nota en resolution-task-service.ts.
    if (body.dueDate !== undefined) {
      if (body.dueDate) {
        const effectiveStartTime = body.startTime !== undefined ? body.startTime : task.startTime
        updateData.dueDate = combineDateAndTime(
          body.dueDate as string,
          (effectiveStartTime as string) || '00:00'
        )
      } else {
        updateData.dueDate = null
      }
    } else if (body.startTime !== undefined && task.dueDate) {
      const d = task.dueDate
      const pad = (n: number) => String(n).padStart(2, '0')
      const currentDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      updateData.dueDate = combineDateAndTime(currentDate, (body.startTime as string) || '00:00')
    }

    // Un horario sin fecha no tiene dónde ubicarse en el calendario — se
    // evalúa sobre el estado FINAL (lo que llegó en el body + lo que ya
    // tenía la tarea), no solo sobre lo que trae este PATCH puntual.
    const effectiveDueDate = 'dueDate' in updateData ? updateData.dueDate : task.dueDate
    const effectiveStartTime = 'startTime' in updateData ? updateData.startTime : task.startTime
    const effectiveEndTime = 'endTime' in updateData ? updateData.endTime : task.endTime
    if ((effectiveStartTime || effectiveEndTime) && !effectiveDueDate) {
      return NextResponse.json(
        { success: false, message: 'Para asignar un horario primero indica la fecha' },
        { status: 400 }
      )
    }

    if (body.notes !== undefined) {
      updateData.notes = (body.notes as string | null)?.trim() || null
    }

    if (body.familyId !== undefined) {
      if (body.familyId) {
        const access = await getPlannerAccess(session.user.id, session.user.role)
        if (!isFamilyWithinPlannerScope(access, body.familyId as string)) {
          return NextResponse.json(
            { success: false, message: 'No tienes acceso a esa área' },
            { status: 403 }
          )
        }
        const family = await prisma.families.findUnique({ where: { id: body.familyId as string } })
        if (!family) {
          return NextResponse.json(
            { success: false, message: 'Área no encontrada' },
            { status: 400 }
          )
        }
      }
      updateData.familyId = body.familyId || null
    }

    const updated = await prisma.personal_tasks.update({
      where: { id },
      data: updateData,
      include: {
        family: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        entityType: 'personal_task',
        entityId: id,
        action: 'updated',
        userId: session.user.id,
        changes,
      }).catch(() => {})
    }

    void MsTodoSyncService.pushTask(updated, session.user.id)

    return NextResponse.json({
      success: true,
      data: serializeTask(updated),
      message: 'Tarea actualizada',
    })
  } catch (error) {
    console.error('[API] Error actualizando tarea independiente:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const denied = await assertCanViewPlanner(session.user.id, session.user.role)
    if (denied) return denied

    const { id } = await params
    const task = await prisma.personal_tasks.findUnique({ where: { id } })
    if (!task) {
      return NextResponse.json({ success: false, message: 'Tarea no encontrada' }, { status: 404 })
    }
    if (task.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No puedes eliminar una tarea de otro usuario' },
        { status: 403 }
      )
    }

    // Debe ejecutarse ANTES de borrar la tarea local: personal_task_ms_todo_links
    // tiene onDelete: Cascade sobre personalTaskId, así que borrar primero
    // destruiría el enlace y removeTask ya no encontraría con qué tarea de
    // Microsoft To Do comunicarse (quedaría huérfana allá para siempre).
    await MsTodoSyncService.removeTask(id, session.user.id)

    await prisma.personal_tasks.delete({ where: { id } })

    await createAuditLog({
      entityType: 'personal_task',
      entityId: id,
      action: 'deleted',
      userId: session.user.id,
      changes: { title: task.title, status: task.status },
    }).catch(() => {})

    return NextResponse.json({ success: true, message: 'Tarea eliminada' })
  } catch (error) {
    console.error('[API] Error eliminando tarea independiente:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
