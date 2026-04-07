import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { NotificationService } from '@/lib/services/notification-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const maintenance = await MaintenanceService.getById(id)
    if (!maintenance) return NextResponse.json({ error: 'Mantenimiento no encontrado' }, { status: 404 })

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
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { action, scheduledDate, description, cost, partsReplaced, returnTo, technicianId, notes } = body

    const isClient = session.user.role === 'CLIENT'
    const isAdminOrTech = session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'

    // Permisos por acción — acciones de gestión requieren permiso de inventario
    if (action === 'approve' || action === 'reschedule' || action === 'complete') {
      if (!await canManageInventory(session.user.id, session.user.role)) {
        return inventoryForbidden()
      }
    }
    if (action === 'approve' && !isAdminOrTech) {
      return NextResponse.json({ error: 'Solo ADMIN o TECHNICIAN pueden aprobar solicitudes' }, { status: 403 })
    }
    if (action === 'accept' && !isClient) {
      return NextResponse.json({ error: 'Solo el cliente puede aceptar el mantenimiento' }, { status: 403 })
    }
    if (action === 'complete' && isClient) {
      return NextResponse.json({ error: 'Solo el técnico o administrador puede completar el mantenimiento' }, { status: 403 })
    }
    if (action === 'reschedule' && !isAdminOrTech) {
      return NextResponse.json({ error: 'No tienes permisos para reagendar' }, { status: 403 })
    }
    if (action === 'approve') {
      if (!scheduledDate) return NextResponse.json({ error: 'Fecha requerida para aprobar' }, { status: 400 })
      const result = await MaintenanceService.approveMaintenance(
        id,
        { scheduledDate: new Date(scheduledDate), technicianId, notes },
        session.user.id
      )

      // Notificar al solicitante
      const maintenance = await MaintenanceService.getById(id)
      if (maintenance?.requestedById) {
        await NotificationService.push({
          userId: maintenance.requestedById,
          type: 'SUCCESS',
          title: `Mantenimiento aprobado — ${maintenance.equipment.code}`,
          message: `Tu solicitud de mantenimiento fue aprobada. El equipo ${maintenance.equipment.code} entrará en mantenimiento el ${new Date(scheduledDate).toLocaleDateString('es-ES')}.`,
          metadata: { equipmentId: maintenance.equipmentId, maintenanceId: id },
        }).catch(() => {})
      }

      return NextResponse.json(result)
    }

    if (action === 'accept') {
      const result = await MaintenanceService.acceptMaintenance(id, session.user.id)

      // Notificar al técnico asignado
      const maintenance = await MaintenanceService.getById(id)
      if (maintenance?.technicianId) {
        await NotificationService.push({
          userId: maintenance.technicianId,
          type: 'INFO',
          title: `Mantenimiento aceptado — ${maintenance.equipment.code}`,
          message: `El cliente aceptó el mantenimiento del equipo ${maintenance.equipment.code}.`,
          metadata: { equipmentId: maintenance.equipmentId, maintenanceId: id },
        }).catch(() => {})
      }

      return NextResponse.json(result)
    }

    if (action === 'reschedule') {
      if (!scheduledDate) return NextResponse.json({ error: 'Fecha requerida para reagendar' }, { status: 400 })
      const result = await MaintenanceService.reschedule(
        id,
        { scheduledDate: new Date(scheduledDate), description },
        session.user.id
      )
      return NextResponse.json(result)
    }

    if (action === 'complete') {
      const result = await MaintenanceService.completeMaintenance(
        id,
        {
          cost: cost !== undefined ? parseFloat(cost) : undefined,
          partsReplaced,
          returnTo: returnTo || 'available',
          notes,
        },
        session.user.id
      )

      // Notificar al solicitante/cliente asignado
      const maintenance = await MaintenanceService.getById(id)
      const notifyUserId = maintenance?.requestedById || maintenance?.equipment?.assignments?.[0]?.receiver?.id
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

    return NextResponse.json({ error: 'Acción no válida. Use: approve, accept, complete, reschedule' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
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
    if (session.user.role === 'CLIENT') return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })

    const { id } = await params
    await MaintenanceService.cancel(id, session.user.id)

    return NextResponse.json({ message: 'Mantenimiento cancelado' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cancelar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
