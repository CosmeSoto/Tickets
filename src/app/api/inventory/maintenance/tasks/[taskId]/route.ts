/**
 * PATCH  /api/inventory/maintenance/tasks/[taskId] — marcar/desmarcar, editar texto o mover
 * DELETE /api/inventory/maintenance/tasks/[taskId] — eliminar
 *
 * Solo lectura no expuesta aparte — la lista completa ya viene de
 * GET /api/inventory/maintenance/[id]/tasks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceTaskService } from '@/lib/services/maintenance-task.service'
import {
  assertMaintenanceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

async function resolveManageAccess(
  session: { user: { id: string; role: string; isSuperAdmin?: boolean } },
  taskId: string
) {
  const task = await MaintenanceTaskService.getById(taskId)
  if (!task) throw new InventoryAccessError('Tarea no encontrada', 404)
  await assertMaintenanceManage(toInventoryAccessUser(session.user), task.maintenanceRecordId)
  return task
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await resolveManageAccess(session as any, taskId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await req.json()

    if (body.move === 'up' || body.move === 'down') {
      const task = await MaintenanceTaskService.move(taskId, body.move)
      return NextResponse.json(task)
    }

    if (typeof body.isCompleted === 'boolean') {
      const task = await MaintenanceTaskService.toggle(taskId, body.isCompleted, session.user.id)
      return NextResponse.json(task)
    }

    if (typeof body.description === 'string') {
      if (!body.description.trim()) {
        return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
      }
      if (body.description.length > 300) {
        return NextResponse.json(
          { error: 'La descripción no puede exceder 300 caracteres' },
          { status: 400 }
        )
      }
      const task = await MaintenanceTaskService.updateDescription(
        taskId,
        body.description,
        session.user.id
      )
      return NextResponse.json(task)
    }

    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  } catch (error) {
    console.error('[PATCH /maintenance/tasks/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar la tarea' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await resolveManageAccess(session as any, taskId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    await MaintenanceTaskService.delete(taskId, session.user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /maintenance/tasks/[id]]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar la tarea' },
      { status: 500 }
    )
  }
}
