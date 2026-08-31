import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { NotificationService } from '@/lib/services/notification-service'
import {
  assertMaintenanceClientAccept,
  assertMaintenanceManage,
  assertMaintenanceRead,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { formatLocalDateTime, parseScheduledDateTime } from '@/lib/forms/form-date'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const user = toInventoryAccessUser(session.user)

    try {
      await assertMaintenanceRead(user, id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const maintenance = await MaintenanceService.getById(id)
    if (!maintenance)
      return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })

    return NextResponse.json(maintenance)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener mantenimiento' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/maintenance/[id]
 * Acciones disponibles según rol:
 *   approve   — ADMIN/TECHNICIAN: aprueba solicitud REQUESTED → SCHEDULED
 *   accept    — CLIENT: acepta mantenimiento SCHEDULED → ACCEPTED
 *   complete  — ADMIN/TECHNICIAN/CLIENT: completa SCHEDULED/ACCEPTED → COMPLETED
 *   reschedule — ADMIN/TECHNICIAN: cambia fecha
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const user = toInventoryAccessUser(session.user)
    const body = await request.json()
    const {
      action,
      scheduledDate,
      description,
      cost,
      partsReplaced,
      returnTo,
      technicianId,
      supplierId,
      contractId,
      notes,
      supplierInvoice,
      warrantyExpiresAt,
      force,
    } = body

    const isClient = session.user.role === 'CLIENT'
    const isAdminOrTech = session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'

    // ADMIN/TECHNICIAN gestionan por rol; Cliente no es gestor de inventario
    if (action === 'approve' || action === 'reschedule' || action === 'complete') {
      if (!isAdminOrTech && !(await canManageInventory(session.user.id, session.user.role))) {
        return inventoryForbidden()
      }
    }
    if (action === 'approve' && !isAdminOrTech) {
      return NextResponse.json(
        { error: 'Solo ADMIN o TECHNICIAN pueden aprobar solicitudes' },
        { status: 403 }
      )
    }
    if (action === 'accept' && !isClient) {
      return NextResponse.json(
        { error: 'Solo el cliente puede aceptar el mantenimiento' },
        { status: 403 }
      )
    }
    if (action === 'complete' && isClient) {
      return NextResponse.json(
        { error: 'Solo el técnico o administrador puede completar el mantenimiento' },
        { status: 403 }
      )
    }
    if (action === 'reschedule' && !isAdminOrTech) {
      return NextResponse.json({ error: 'No tienes permisos para reagendar' }, { status: 403 })
    }
    if (action === 'approve') {
      try {
        await assertMaintenanceManage(user, id)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
      if (!scheduledDate)
        return NextResponse.json({ error: 'Fecha requerida para aprobar' }, { status: 400 })
      if (supplierId && technicianId) {
        return NextResponse.json(
          {
            error:
              'Indica técnico interno o proveedor externo, no ambos como responsables del trabajo',
          },
          { status: 400 }
        )
      }
      const when = parseScheduledDateTime(scheduledDate)
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
      }
      const result = await MaintenanceService.approveMaintenance(
        id,
        {
          scheduledDate: when,
          technicianId,
          supplierId,
          contractId,
          notes,
        },
        session.user.id
      )

      // Notificar al solicitante
      const maintenance = await MaintenanceService.getById(id)
      if (maintenance?.requestedById) {
        const supplierName = maintenance.supplier?.name
        const contractLabel = maintenance.contract
          ? maintenance.contract.contractNumber || maintenance.contract.name
          : null
        const performerMsg = supplierName
          ? ` Lo realizará el proveedor ${supplierName}${contractLabel ? ` (contrato ${contractLabel})` : ''}.`
          : maintenance.technician
            ? ` Técnico asignado: ${maintenance.technician.name}.`
            : ''
        await NotificationService.push({
          userId: maintenance.requestedById,
          type: 'SUCCESS',
          title: `Mantenimiento aprobado — ${maintenance.equipment.code}`,
          message: `Tu solicitud de mantenimiento fue aprobada. El equipo ${maintenance.equipment.code} entrará en mantenimiento el ${formatLocalDateTime(when)}.${performerMsg}`,
          metadata: {
            equipmentId: maintenance.equipmentId,
            maintenanceId: id,
            supplierId: maintenance.supplierId,
            contractId: maintenance.contractId,
          },
        }).catch(() => {})
      }

      return NextResponse.json(result)
    }

    if (action === 'accept') {
      try {
        await assertMaintenanceClientAccept(user, id)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
      const result = await MaintenanceService.acceptMaintenance(id, session.user.id)

      // Notificar al técnico asignado (interno) o al staff si es proveedor externo
      const maintenance = await MaintenanceService.getById(id)
      if (maintenance?.technicianId) {
        await NotificationService.push({
          userId: maintenance.technicianId,
          type: 'INFO',
          title: `Mantenimiento aceptado — ${maintenance.equipment.code}`,
          message: `El cliente aceptó el mantenimiento del equipo ${maintenance.equipment.code}.`,
          metadata: { equipmentId: maintenance.equipmentId, maintenanceId: id },
        }).catch(() => {})
      } else if (maintenance?.supplierId) {
        const staff = await prisma.users.findMany({
          where: { role: { in: ['ADMIN', 'TECHNICIAN'] }, isActive: true },
          select: { id: true },
        })
        const supplierName = maintenance.supplier?.name || 'proveedor externo'
        await Promise.all(
          staff.map(u =>
            NotificationService.push({
              userId: u.id,
              type: 'INFO',
              title: `Cliente aceptó mantenimiento externo — ${maintenance.equipment.code}`,
              message: `El cliente aceptó el mantenimiento del equipo ${maintenance.equipment.code} a cargo de ${supplierName}.`,
              metadata: {
                equipmentId: maintenance.equipmentId,
                maintenanceId: id,
                supplierId: maintenance.supplierId,
              },
            }).catch(() => {})
          )
        )
      }

      return NextResponse.json(result)
    }

    if (action === 'reschedule') {
      try {
        await assertMaintenanceManage(user, id)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
      if (!scheduledDate)
        return NextResponse.json({ error: 'Fecha requerida para reagendar' }, { status: 400 })
      const when = parseScheduledDateTime(scheduledDate)
      if (Number.isNaN(when.getTime())) {
        return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
      }
      const result = await MaintenanceService.reschedule(
        id,
        { scheduledDate: when, description },
        session.user.id
      )
      return NextResponse.json(result)
    }

    if (action === 'complete') {
      try {
        await assertMaintenanceManage(user, id)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
      const result = await MaintenanceService.completeMaintenance(
        id,
        {
          cost: cost !== undefined ? parseFloat(cost) : undefined,
          partsReplaced,
          returnTo: returnTo || 'available',
          notes,
          supplierInvoice: supplierInvoice || undefined,
          warrantyExpiresAt: warrantyExpiresAt ? new Date(warrantyExpiresAt) : undefined,
          force: force === true,
        },
        session.user.id
      )

      // Notificar al solicitante/cliente asignado
      const maintenance = await MaintenanceService.getById(id)
      const notifyUserId =
        maintenance?.requestedById || maintenance?.equipment?.assignments?.[0]?.receiver?.id
      if (notifyUserId) {
        const destMsg = (result as any).reAssigned
          ? 'El equipo ha sido reasignado a ti.'
          : 'El equipo está disponible en bodega.'
        await NotificationService.push({
          userId: notifyUserId,
          type: 'SUCCESS',
          title: `Mantenimiento completado — ${maintenance?.equipment?.code}`,
          message: `El mantenimiento del equipo ${maintenance?.equipment?.code} ha sido completado. ${destMsg}`,
          metadata: { equipmentId: maintenance?.equipmentId, maintenanceId: id },
        }).catch(() => {})
      }

      return NextResponse.json(result)
    }

    return NextResponse.json(
      { error: 'Acción no válida. Use: approve, accept, complete, reschedule' },
      { status: 400 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar mantenimiento'
    // IncompleteTasksError (checklist con tareas sin marcar) viaja con `code`
    // para que el front ofrezca "completar de todas formas" en vez de un
    // error genérico — ver MaintenanceTasksCard / handleComplete.
    const code = (error as { code?: string })?.code
    return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status: 400 })
  }
}

/**
 * DELETE /api/inventory/maintenance/[id]
 * Cancela un mantenimiento (solo ADMIN/TECHNICIAN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const user = toInventoryAccessUser(session.user)

    try {
      await assertMaintenanceManage(user, id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    await MaintenanceService.cancel(id, session.user.id)

    return NextResponse.json({ message: 'Mantenimiento cancelado' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cancelar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
