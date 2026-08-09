import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import {
  assertInventoryManageByFamily,
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { parseScheduledDateTime } from '@/lib/forms/form-date'

/**
 * POST /api/inventory/maintenance/by-model
 * Crea mantenimiento para todos los equipos de un modelo
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const canManage = await resolveCanManageInventory(session.user.id, session.user.role)
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN' && !canManage) {
      return NextResponse.json(
        { error: 'No tienes permisos para crear mantenimientos masivos' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const {
      modelId,
      type,
      description,
      scheduledDate,
      technicianId,
      statusFilter,
      familyId,
      cost,
      notes,
    } = body

    if (!modelId || !type || !description || !scheduledDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: modelId, type, description, scheduledDate' },
        { status: 400 }
      )
    }

    const user = toInventoryAccessUser(session.user)

    try {
      await assertInventoryResourceManage(user, 'MODEL', modelId)
      if (familyId) {
        await assertInventoryManageByFamily(user, familyId)
      }
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const when = parseScheduledDateTime(scheduledDate)
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
    }

    const result = await MaintenanceService.createMaintenanceByModel(
      {
        modelId,
        type,
        description,
        scheduledDate: when,
        technicianId,
        statusFilter,
        familyId,
        cost,
        notes,
      },
      session.user.id
    )

    return NextResponse.json({
      success: true,
      created: result.created.length,
      skipped: result.skipped.length,
      details: {
        createdIds: result.created.map(m => m.id),
        skippedEquipment: result.skipped,
      },
    })
  } catch (error) {
    console.error('Error creating maintenance by model:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear mantenimientos' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/inventory/maintenance/by-model?modelId=xxx
 * Obtiene estadísticas de mantenimiento por modelo
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const modelId = searchParams.get('modelId')

    if (!modelId) {
      return NextResponse.json({ error: 'modelId es requerido' }, { status: 400 })
    }

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'MODEL', modelId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const stats = await MaintenanceService.getMaintenanceStatsByModel(modelId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error getting maintenance stats by model:', error)
    return NextResponse.json(
      { error: 'Error al obtener estadísticas de mantenimiento' },
      { status: 500 }
    )
  }
}
