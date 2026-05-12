import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/equipment/[id]
 * Endpoint público — no requiere autenticación.
 * Devuelve información segura del equipo para la página de verificación QR.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        model: { select: { id: true, brand: true, model: true } },
        type: { select: { name: true, icon: true, code: true } },
        department: { select: { name: true } },
        warehouse: { select: { name: true } },
        assignments: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            receiver: {
              select: {
                name: true,
                departments: { select: { name: true } },
              },
            },
            deliverer: { select: { name: true } },
          },
        },
        // Mantenimiento activo (status SCHEDULED o ACCEPTED)
        maintenanceRecords: {
          where: { status: { in: ['SCHEDULED', 'ACCEPTED'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            technician: { select: { name: true } },
          },
        },
        // Solicitud de baja aprobada
        decommission_requests: {
          where: { status: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            reason: true,
            createdAt: true,
            condition: true,
          },
        },
        // Primera imagen adjunta para mostrar como foto del equipo
        attachments: {
          where: { mimeType: { startsWith: 'image/' } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    const activeAssignment = equipment.assignments[0] ?? null

    const statusLabels: Record<string, string> = {
      AVAILABLE: 'Disponible',
      ASSIGNED: 'Asignado',
      MAINTENANCE: 'En mantenimiento',
      DAMAGED: 'Dañado',
      RETIRED: 'Dado de baja',
      SOLD: 'Vendido',
    }

    const conditionLabels: Record<string, string> = {
      NEW: 'Nuevo',
      LIKE_NEW: 'Como nuevo',
      GOOD: 'Bueno',
      FAIR: 'Regular',
      POOR: 'Deteriorado',
    }

    const ownershipLabels: Record<string, { label: string; description: string }> = {
      FIXED_ASSET: {
        label: 'Activo Fijo',
        description:
          'Equipo de propiedad de la empresa, asignado de forma permanente a una persona o departamento.',
      },
      RENTAL: {
        label: 'Alquiler',
        description:
          'Equipo rentado a un proveedor externo. La empresa paga una renta mensual por su uso.',
      },
      LOAN: {
        label: 'Préstamo',
        description:
          'Equipo prestado temporalmente. Se espera su devolución al finalizar el período acordado.',
      },
    }

    const assignmentTypeLabels: Record<string, { label: string; description: string }> = {
      PERMANENT: {
        label: 'Asignación Permanente',
        description: 'El equipo está asignado de forma indefinida a esta persona.',
      },
      TEMPORARY: {
        label: 'Asignación Temporal',
        description: 'El equipo está asignado por un período limitado de tiempo.',
      },
      LOAN: {
        label: 'Préstamo',
        description: 'El equipo fue prestado temporalmente y debe ser devuelto.',
      },
    }

    const ownership = ownershipLabels[equipment.ownershipType] ?? {
      label: equipment.ownershipType,
      description: '',
    }

    const assignmentInfo = activeAssignment
      ? {
          receiverName: activeAssignment.receiver.name,
          receiverDepartment: activeAssignment.receiver.departments?.name ?? null,
          deliveredBy: activeAssignment.deliverer.name,
          startDate: activeAssignment.startDate,
          endDate: activeAssignment.endDate ?? null,
          type: assignmentTypeLabels[activeAssignment.assignmentType] ?? {
            label: activeAssignment.assignmentType,
            description: '',
          },
        }
      : null

    // Mantenimiento activo
    const activeMaintenance = equipment.maintenanceRecords[0] ?? null
    const maintenanceInfo = activeMaintenance
      ? {
          type: activeMaintenance.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo',
          description: activeMaintenance.description,
          date: activeMaintenance.date,
          technicianName: activeMaintenance.technician?.name ?? null,
        }
      : null

    // Baja aprobada
    const decommission = equipment.decommission_requests[0] ?? null
    const decommissionInfo = decommission
      ? {
          reason: decommission.reason,
          date: decommission.createdAt,
        }
      : null

    // Usar la primera imagen adjunta como foto principal (más confiable que photoUrl legacy)
    const firstAttachmentId = equipment.attachments[0]?.id ?? null

    return NextResponse.json({
      id: equipment.id,
      code: equipment.code,
      serialNumber: equipment.serialNumber,
      brand: equipment.brand,
      model: equipment.model
        ? [equipment.model.brand, equipment.model.model].filter(Boolean).join(' ')
        : equipment.model,
      typeName: equipment.type.name,
      typeIcon: equipment.type.icon,
      status: equipment.status,
      statusLabel: statusLabels[equipment.status] ?? equipment.status,
      condition: equipment.condition,
      conditionLabel: conditionLabels[equipment.condition] ?? equipment.condition,
      ownershipType: equipment.ownershipType,
      ownershipLabel: ownership.label,
      ownershipDescription: ownership.description,
      // Ubicación
      location: equipment.location ?? null,
      physicalLocation: equipment.physicalLocation ?? null,
      warehouseName: equipment.warehouse?.name ?? null,
      departmentName: equipment.department?.name ?? null,
      // Accesorios y especificaciones
      accessories: equipment.accessories ?? [],
      specifications: null,
      // Notas
      notes: equipment.notes ?? null,
      // Foto: primero adjunto, luego campo legacy
      photoUrl: firstAttachmentId
        ? `/api/inventory/equipment/${equipment.id}/attachments/${firstAttachmentId}?preview=true`
        : (equipment.photoUrl ?? null),
      // Asignación
      assignment: assignmentInfo,
      // Mantenimiento activo
      maintenance: maintenanceInfo,
      // Baja
      decommission: decommissionInfo,
      verifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en endpoint público de equipo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
