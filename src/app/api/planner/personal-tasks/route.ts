/**
 * POST /api/planner/personal-tasks
 * Crea una tarea independiente (personal_tasks) para el usuario logueado —
 * sin ticket ni plan de resolución de por medio. v1: estrictamente personal,
 * el creador es siempre el dueño (sin asignar a otro usuario).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { combineDateAndTime, validateTimeRange } from '@/lib/time-utils'
import { createAuditLog } from '@/lib/audit'
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MsTodoSyncService } from '@/lib/services/ms-todo-sync-service'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
  }

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  const body = await request.json()

  if (!body.title?.trim()) {
    return NextResponse.json(
      { success: false, message: 'El título de la tarea es requerido' },
      { status: 400 }
    )
  }

  if (body.startTime && body.endTime && !validateTimeRange(body.startTime, body.endTime)) {
    return NextResponse.json(
      { success: false, message: 'La hora de fin debe ser posterior a la hora de inicio' },
      { status: 400 }
    )
  }

  // Si se indica un área, debe existir — evita una FK inválida silenciosa.
  if (body.familyId) {
    const family = await prisma.families.findUnique({ where: { id: body.familyId } })
    if (!family) {
      return NextResponse.json({ success: false, message: 'Área no encontrada' }, { status: 400 })
    }
  }

  const dueDate = body.dueDate ? combineDateAndTime(body.dueDate, body.startTime || '00:00') : null

  const task = await prisma.personal_tasks.create({
    data: {
      id: randomUUID(),
      userId: session.user.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      priority: body.priority || 'medium',
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      dueDate,
      notes: body.notes?.trim() || null,
      familyId: body.familyId || null,
      updatedAt: new Date(),
    },
    include: {
      family: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  })

  await createAuditLog({
    entityType: 'personal_task',
    entityId: task.id,
    action: 'created',
    userId: session.user.id,
    changes: { title: task.title, priority: task.priority, dueDate: task.dueDate },
  }).catch(() => {})

  // Sincronización con la Microsoft To Do del propio usuario (fire-and-forget,
  // nunca lanza — si no tiene cuenta vinculada, no hace nada en silencio).
  void MsTodoSyncService.pushTask(task, session.user.id)

  return NextResponse.json({
    success: true,
    data: {
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
    },
    message: 'Tarea creada',
  })
}
