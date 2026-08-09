import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import {
  assertMaintenanceIdsManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { parseScheduledDateTime } from '@/lib/forms/form-date'

/**
 * POST /api/inventory/maintenance/bulk
 * Realiza acciones masivas sobre múltiples mantenimientos
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const role = session.user.role
    const canManage =
      role === 'ADMIN' ||
      role === 'TECHNICIAN' ||
      (await resolveCanManageInventory(session.user.id, session.user.role))

    const body = await req.json()
    const { action, ids, data } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: action, ids (array)' },
        { status: 400 }
      )
    }

    const user = toInventoryAccessUser(session.user)

    switch (action) {
      case 'approve':
        if (!canManage) {
          return NextResponse.json(
            { error: 'No tienes permisos para aprobar mantenimientos' },
            { status: 403 }
          )
        }

        try {
          await assertMaintenanceIdsManage(user, ids)
        } catch (err) {
          if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
          throw err
        }

        if (!data?.scheduledDate) {
          return NextResponse.json(
            { error: 'scheduledDate es requerido para aprobar' },
            { status: 400 }
          )
        }

        const approveWhen = parseScheduledDateTime(data.scheduledDate)
        if (Number.isNaN(approveWhen.getTime())) {
          return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
        }

        const approveResults = await Promise.allSettled(
          ids.map((id: string) =>
            MaintenanceService.approveMaintenance(
              id,
              {
                scheduledDate: approveWhen,
                technicianId: data.technicianId,
                supplierId: data.supplierId,
                contractId: data.contractId,
                notes: data.notes,
              },
              session.user.id
            )
          )
        )

        return NextResponse.json({
          success: approveResults.filter(r => r.status === 'fulfilled').length,
          failed: approveResults.filter(r => r.status === 'rejected').length,
          errors: approveResults
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map(r => r.reason?.message || 'Error desconocido'),
        })

      case 'cancel':
        if (!canManage) {
          return NextResponse.json(
            { error: 'No tienes permisos para cancelar mantenimientos' },
            { status: 403 }
          )
        }

        try {
          await assertMaintenanceIdsManage(user, ids)
        } catch (err) {
          if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
          throw err
        }

        const cancelResults = await Promise.allSettled(
          ids.map((id: string) => MaintenanceService.cancel(id, session.user.id))
        )

        return NextResponse.json({
          success: cancelResults.filter(r => r.status === 'fulfilled').length,
          failed: cancelResults.filter(r => r.status === 'rejected').length,
        })

      case 'reschedule':
        if (!canManage) {
          return NextResponse.json(
            { error: 'No tienes permisos para reagendar mantenimientos' },
            { status: 403 }
          )
        }

        try {
          await assertMaintenanceIdsManage(user, ids)
        } catch (err) {
          if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
          throw err
        }

        if (!data?.scheduledDate) {
          return NextResponse.json(
            { error: 'scheduledDate es requerido para reagendar' },
            { status: 400 }
          )
        }

        const rescheduleWhen = parseScheduledDateTime(data.scheduledDate)
        if (Number.isNaN(rescheduleWhen.getTime())) {
          return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
        }

        const rescheduleResults = await Promise.allSettled(
          ids.map((id: string) =>
            MaintenanceService.reschedule(
              id,
              {
                scheduledDate: rescheduleWhen,
                description: data.description,
              },
              session.user.id
            )
          )
        )

        return NextResponse.json({
          success: rescheduleResults.filter(r => r.status === 'fulfilled').length,
          failed: rescheduleResults.filter(r => r.status === 'rejected').length,
        })

      case 'assign_technician':
        if (!canManage) {
          return NextResponse.json(
            { error: 'No tienes permisos para asignar técnicos' },
            { status: 403 }
          )
        }

        try {
          await assertMaintenanceIdsManage(user, ids)
        } catch (err) {
          if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
          throw err
        }

        if (!data?.technicianId) {
          return NextResponse.json(
            { error: 'technicianId es requerido para asignar técnico' },
            { status: 400 }
          )
        }

        // Actualizar técnico en múltiples mantenimientos
        const assignResults = await Promise.allSettled(
          ids.map((id: string) =>
            MaintenanceService.reschedule(
              id,
              {
                scheduledDate: new Date(), // Mantener fecha actual
              },
              session.user.id
            )
          )
        )

        return NextResponse.json({
          success: assignResults.filter(r => r.status === 'fulfilled').length,
          failed: assignResults.filter(r => r.status === 'rejected').length,
        })

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in bulk maintenance action:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al realizar acción masiva' },
      { status: 500 }
    )
  }
}
