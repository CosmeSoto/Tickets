import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { sendEmail } from '@/lib/email-service'

/**
 * POST /api/inventory/maintenance
 * Crea un registro de mantenimiento y notifica al cliente asignado
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
    }

    const body = await request.json()
    const { equipmentId, type, description, scheduledDate, technicianId } = body

    if (!equipmentId || !type || !description || !scheduledDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: equipmentId, type, description, scheduledDate' },
        { status: 400 }
      )
    }

    if (!['PREVENTIVE', 'CORRECTIVE'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de mantenimiento inválido' }, { status: 400 })
    }

    // Verificar que el equipo existe y obtener asignación activa
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

    // Crear registro de mantenimiento
    const maintenance = await MaintenanceService.createMaintenance(
      {
        equipmentId,
        type,
        description,
        scheduledDate: new Date(scheduledDate),
        technicianId: technicianId || session.user.id,
      },
      session.user.id
    )

    // Notificar al cliente asignado si existe
    const activeAssignment = equipment.assignments?.[0]
    if (activeAssignment?.receiver) {
      const receiver = activeAssignment.receiver
      const maintenanceTypeLabel = type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'
      const formattedDate = new Date(scheduledDate).toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
      const equipmentLabel = `${equipment.code} (${equipment.brand} ${equipment.model})`

      // 1. Notificación en dashboard (campanita)
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          userId: receiver.id,
          type: 'INFO',
          title: `Mantenimiento programado - ${equipment.code}`,
          message: `El equipo ${equipmentLabel} que tienes asignado entrará en mantenimiento ${maintenanceTypeLabel} el ${formattedDate}. Motivo: ${description}`,
          metadata: { equipmentId, maintenanceId: maintenance.id },
        },
      })

      // 2. Notificación por email
      sendEmail({
        to: receiver.email,
        subject: `Mantenimiento programado para tu equipo ${equipment.code}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">🔧 Mantenimiento Programado</h2>
            <p>Hola <strong>${receiver.name}</strong>,</p>
            <p>Te informamos que el equipo que tienes asignado entrará en mantenimiento:</p>
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
            <p>Durante el mantenimiento es posible que el equipo no esté disponible. Si tienes alguna consulta, no dudes en contactar al equipo de soporte.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Este es un mensaje automático del sistema de gestión de inventario.</p>
          </div>
        `,
      }).catch(err => {
        console.error('Error enviando email de mantenimiento:', err)
      })
    }

    return NextResponse.json({ maintenance }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/maintenance:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al registrar mantenimiento' }, { status: 500 })
  }
}
