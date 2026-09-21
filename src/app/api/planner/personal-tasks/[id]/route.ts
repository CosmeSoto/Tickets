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
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MsTodoSyncService } from '@/lib/services/ms-todo-sync-service'

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

  const body = await request.json()
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  const changes: Record<string, unknown> = {}

  if (body.title !== undefined && body.title.trim()) {
    updateData.title = body.title.trim()
    changes.title = { old: task.title, new: body.title.trim() }
  }

  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null
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
    const newStartTime = body.startTime !== undefined ? body.startTime : task.startTime
    const newEndTime = body.endTime !== undefined ? body.endTime : task.endTime
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
      updateData.dueDate = combineDateAndTime(body.dueDate, effectiveStartTime || '00:00')
    } else {
      updateData.dueDate = null
    }
  } else if (body.startTime !== undefined && task.dueDate) {
    const d = task.dueDate
    const pad = (n: number) => String(n).padStart(2, '0')
    const currentDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    updateData.dueDate = combineDateAndTime(currentDate, body.startTime || '00:00')
  }

  if (body.notes !== undefined) {
    updateData.notes = body.notes?.trim() || null
  }

  if (body.familyId !== undefined) {
    if (body.familyId) {
      const family = await prisma.families.findUnique({ where: { id: body.familyId } })
      if (!family) {
        return NextResponse.json({ success: false, message: 'Área no encontrada' }, { status: 400 })
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
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  await prisma.personal_tasks.delete({ where: { id } })

  await createAuditLog({
    entityType: 'personal_task',
    entityId: id,
    action: 'deleted',
    userId: session.user.id,
    changes: { title: task.title, status: task.status },
  }).catch(() => {})

  void MsTodoSyncService.removeTask(id, session.user.id)

  return NextResponse.json({ success: true, message: 'Tarea eliminada' })
}
