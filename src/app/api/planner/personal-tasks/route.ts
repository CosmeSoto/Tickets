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
import { combineDateAndTime, validateTimeRange, isValidTimeFormat } from '@/lib/time-utils'
import { createAuditLog } from '@/lib/audit'
import {
  assertCanViewPlanner,
  getPlannerAccess,
  isFamilyWithinPlannerScope,
} from '@/lib/planner/access'
import { MsTodoSyncService } from '@/lib/services/ms-todo-sync-service'
import {
  isValidPersonalTaskPriority,
  isValidDateOnlyString,
} from '@/lib/planner/personal-task-validation'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const denied = await assertCanViewPlanner(session.user.id, session.user.role)
    if (denied) return denied

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json(
        { success: false, message: 'El título de la tarea es requerido' },
        { status: 400 }
      )
    }

    if (body.priority !== undefined && !isValidPersonalTaskPriority(body.priority)) {
      return NextResponse.json({ success: false, message: 'Prioridad inválida' }, { status: 400 })
    }

    if (body.dueDate && !isValidDateOnlyString(body.dueDate)) {
      return NextResponse.json(
        { success: false, message: 'Fecha inválida — usa el formato AAAA-MM-DD' },
        { status: 400 }
      )
    }
    if (body.startTime && !isValidTimeFormat(body.startTime as string)) {
      return NextResponse.json(
        { success: false, message: 'Hora de inicio inválida — usa el formato HH:mm' },
        { status: 400 }
      )
    }
    if (body.endTime && !isValidTimeFormat(body.endTime as string)) {
      return NextResponse.json(
        { success: false, message: 'Hora de fin inválida — usa el formato HH:mm' },
        { status: 400 }
      )
    }

    if (
      body.startTime &&
      body.endTime &&
      !validateTimeRange(body.startTime as string, body.endTime as string)
    ) {
      return NextResponse.json(
        { success: false, message: 'La hora de fin debe ser posterior a la hora de inicio' },
        { status: 400 }
      )
    }

    // Un horario sin fecha no tiene dónde ubicarse en el calendario (mes y
    // semana agrupan únicamente por dueDate) — quedaría creada pero invisible.
    if ((body.startTime || body.endTime) && !body.dueDate) {
      return NextResponse.json(
        { success: false, message: 'Para asignar un horario primero indica la fecha' },
        { status: 400 }
      )
    }

    // Si se indica un área, debe existir y estar dentro del alcance del
    // usuario — evita tanto una FK inválida como etiquetar la tarea con un
    // área a la que no tiene acceso (se filtraría igual en reportes).
    let familyId: string | null = null
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
        return NextResponse.json({ success: false, message: 'Área no encontrada' }, { status: 400 })
      }
      familyId = family.id
    }

    const dueDate = body.dueDate
      ? combineDateAndTime(body.dueDate as string, (body.startTime as string) || '00:00')
      : null

    const task = await prisma.personal_tasks.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        title: (body.title as string).trim(),
        description: (body.description as string | undefined)?.trim() || null,
        priority: (body.priority as string) || 'medium',
        startTime: (body.startTime as string) || null,
        endTime: (body.endTime as string) || null,
        dueDate,
        notes: (body.notes as string | undefined)?.trim() || null,
        familyId,
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
  } catch (error) {
    console.error('[API] Error creando tarea independiente:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear la tarea',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
