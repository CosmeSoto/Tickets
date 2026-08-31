/**
 * GET  /api/inventory/maintenance/[id]/tasks — lista el checklist del mantenimiento
 * POST /api/inventory/maintenance/[id]/tasks — agrega una tarea
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceTaskService } from '@/lib/services/maintenance-task.service'
import {
  assertMaintenanceRead,
  assertMaintenanceManage,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertMaintenanceRead(toInventoryAccessUser(session.user), id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const tasks = await MaintenanceTaskService.listByMaintenance(id)
    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('[GET /maintenance/[id]/tasks]', error)
    return NextResponse.json({ error: 'Error al obtener las tareas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    try {
      await assertMaintenanceManage(toInventoryAccessUser(session.user), id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const { description } = await req.json()
    if (!description || !String(description).trim()) {
      return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 })
    }
    if (String(description).length > 300) {
      return NextResponse.json(
        { error: 'La descripción no puede exceder 300 caracteres' },
        { status: 400 }
      )
    }

    const task = await MaintenanceTaskService.create({
      maintenanceRecordId: id,
      description: String(description),
      createdBy: session.user.id,
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('[POST /maintenance/[id]/tasks]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear la tarea' },
      { status: 500 }
    )
  }
}
