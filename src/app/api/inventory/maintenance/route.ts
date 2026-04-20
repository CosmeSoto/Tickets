import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { sendEmail } from '@/lib/email-service'
import { NotificationService } from '@/lib/services/notification-service'

/**
 * GET /api/inventory/maintenance
 * - ADMIN/TECHNICIAN: todos los mantenimientos (con filtros opcionales)
 * - CLIENT: solo los mantenimientos de equipos que le pertenecen
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const personalOnly = searchParams.get('personalOnly') === 'true'

    const isClient = session.user.role === 'CLIENT'

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type

    // Filtrar por familia a través del equipo
    if (familyId) {
      where.equipment = { type: { familyId } }
    }

    // Cliente solo ve mantenimientos de sus equipos asignados
    if (isClient || personalOnly) {
      const myAssignments = await prisma.equipment_assignments.findMany({
        where: { receiverId: session.user.id, isActive: true },
        select: { equipmentId: true },
      })
      const myEquipmentIds = myAssignments.map(a => a.equipmentId)
      where.OR = [
        { equipmentId: { in: myEquipmentIds } },
        { requestedById: session.user.id },
      ]
    }

    const records = await prisma.maintenance_records.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        equipment: {
          select: { id: true, code: true, brand: true, model: true, status: true, type: { select: { name: true } } },
        },
        technician: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(records)
  } catch (error) {
    return NextResponse.json({ error: 'Error al obtener mantenimientos' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/maintenance
 * - ADMIN/TECHNICIAN: crea mantenimiento SCHEDULED (equipo → MAINTENANCE)
 * - CLIENT: solicita mantenimiento REQUESTED (equipo no cambia)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { equipmentId, type, description, scheduledDate, technicianId, notes } = body

    if (!equipmentId || !type || !description || !scheduledDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: equipmentId, type, description, scheduledDate' },
        { status: 400 }
      )
    }

    if (!['PREVENTIVE', 'CORRECTIVE'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de mantenimiento inválido' }, { status: 400 })
    }

    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        assignments: {
          where: { isActive: true },
          include: { receiver: { select: { id: true, name: true, email: true } } },
          take: 1,
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    const isClient = session.user.role === 'CLIENT'

    let maintenance
    if (isClient) {
      // Cliente solicita mantenimiento
      maintenance = await MaintenanceService.requestMaintenance(
        {
          equipmentId,
          type,
          description,
          scheduledDate: new Date(scheduledDate),
          requestedById: session.user.id,
          notes,
        },
        session.user.id
      )

      // Notificar a admins/técnicos sobre la solicitud
      const admins = await prisma.users.findMany({
        where: { role: { in: ['ADMIN', 'TECHNICIAN'] }, isActive: true },
        select: { id: true, name: true, email: true },
      })

      const equipmentLabel = `${equipment.code} (${equipment.brand} ${equipment.model})`
      const requesterName = session.user.name || session.user.email

      for (const admin of admins) {
        await NotificationService.push({
          userId: admin.id,
          type: 'INFO',
          title: `Solicitud de mantenimiento — ${equipment.code}`,
          message: `${requesterName} solicitó mantenimiento ${type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para el equipo ${equipmentLabel}. Motivo: ${description}`,
          metadata: { equipmentId, maintenanceId: maintenance.id, action: 'approve_maintenance' },
        }).catch(() => {})
      }
    } else {
      // Admin/Técnico programa mantenimiento directamente
      maintenance = await MaintenanceService.createMaintenance(
        {
          equipmentId,
          type,
          description,
          scheduledDate: new Date(scheduledDate),
          technicianId: technicianId || session.user.id,
          notes,
        },
        session.user.id
      )

      // Notificar al cliente asignado si existe
      const activeAssignment = equipment.assignments?.[0]
      if (activeAssignment?.receiver) {
        const receiver = activeAssignment.receiver
        const maintenanceTypeLabel = type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'
        const formattedDate = new Date(scheduledDate).toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
        const equipmentLabel = `${equipment.code} (${equipment.brand} ${equipment.model})`

        await NotificationService.push({
          userId: receiver.id,
          type: 'INFO',
          title: `Mantenimiento programado — ${equipment.code}`,
          message: `El equipo ${equipmentLabel} entrará en mantenimiento ${maintenanceTypeLabel} el ${formattedDate}. Motivo: ${description}`,
          metadata: { equipmentId, maintenanceId: maintenance.id },
        }).catch(() => {})

        sendEmail({
          to: receiver.email,
          subject: `Mantenimiento programado para tu equipo ${equipment.code}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f59e0b;">🔧 Mantenimiento Programado</h2>
              <p>Hola <strong>${receiver.name}</strong>,</p>
              <p>El equipo que tienes asignado entrará en mantenimiento:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr style="background: #f9fafb;">
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Equipo</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${equipmentLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Tipo</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Mantenimiento ${maintenanceTypeLabel}</td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Fecha programada</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Motivo</td>
                  <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${description}</td>
                </tr>
              </table>
              <p>Si tienes alguna consulta, contacta al equipo de soporte.</p>
            </div>
          `,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ maintenance }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al registrar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
