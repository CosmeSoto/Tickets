import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/equipment/[id]
 * Endpoint público — no requiere autenticación.
 * Devuelve información segura del equipo para la página de verificación QR.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        type: { select: { name: true, icon: true } },
        assignments: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            receiver: {
              select: { name: true, departmentId: true },
            },
            deliverer: {
              select: { name: true },
            },
          },
        },
      },
    })

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    const activeAssignment = equipment.assignments[0] ?? null

    // Labels legibles para enums
    const statusLabels: Record<string, string> = {
      AVAILABLE: 'Disponible',
      ASSIGNED: 'Asignado',
      MAINTENANCE: 'En mantenimiento',
      DAMAGED: 'Dañado',
      RETIRED: 'Dado de baja',
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
        description: 'Equipo de propiedad de la empresa, asignado de forma permanente a una persona o departamento.',
      },
      RENTAL: {
        label: 'Alquiler',
        description: 'Equipo rentado a un proveedor externo. La empresa paga una renta mensual por su uso.',
      },
      LOAN: {
        label: 'Préstamo',
        description: 'Equipo prestado temporalmente. Se espera su devolución al finalizar el período acordado.',
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
          deliveredBy: activeAssignment.deliverer.name,
          startDate: activeAssignment.startDate,
          endDate: activeAssignment.endDate ?? null,
          type: assignmentTypeLabels[activeAssignment.assignmentType] ?? {
            label: activeAssignment.assignmentType,
            description: '',
          },
        }
      : null

    return NextResponse.json({
      id: equipment.id,
      code: equipment.code,
      brand: equipment.brand,
      model: equipment.model,
      typeName: equipment.type.name,
      typeIcon: equipment.type.icon,
      status: equipment.status,
      statusLabel: statusLabels[equipment.status] ?? equipment.status,
      condition: equipment.condition,
      conditionLabel: conditionLabels[equipment.condition] ?? equipment.condition,
      ownershipType: equipment.ownershipType,
      ownershipLabel: ownership.label,
      ownershipDescription: ownership.description,
      location: equipment.location ?? null,
      photoUrl: equipment.photoUrl ?? null,
      assignment: assignmentInfo,
      verifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en endpoint público de equipo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
