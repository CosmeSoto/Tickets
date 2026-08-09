import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { parseScheduledDateTime } from '@/lib/forms/form-date'
import prisma from '@/lib/prisma'

/**
 * POST /api/inventory/maintenance/by-type
 * Crea mantenimiento para todos los equipos de un tipo de equipo.
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
      typeId,
      type,
      description,
      scheduledDate,
      technicianId,
      supplierId,
      contractId,
      statusFilter,
      familyId,
      cost,
      notes,
    } = body

    if (!typeId || !type || !description || !scheduledDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: typeId, type, description, scheduledDate' },
        { status: 400 }
      )
    }

    if (supplierId && technicianId) {
      return NextResponse.json(
        {
          error:
            'Indica técnico interno o proveedor externo, no ambos como responsables del trabajo',
        },
        { status: 400 }
      )
    }

    const equipmentType = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      select: { id: true, familyId: true, name: true, isActive: true },
    })
    if (!equipmentType || !equipmentType.isActive) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    const user = toInventoryAccessUser(session.user)
    try {
      await assertInventoryManageByFamily(user, equipmentType.familyId)
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

    const result = await MaintenanceService.createMaintenanceByType(
      {
        typeId,
        type,
        description,
        scheduledDate: when,
        technicianId,
        supplierId,
        contractId,
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
      typeName: equipmentType.name,
      details: {
        createdIds: result.created.map(m => m.id),
        skippedEquipment: result.skipped,
      },
    })
  } catch (error) {
    console.error('Error creating maintenance by type:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear mantenimientos' },
      { status: 500 }
    )
  }
}
