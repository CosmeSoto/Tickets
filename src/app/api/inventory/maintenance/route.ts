import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MaintenanceService } from '@/lib/services/maintenance.service'
import prisma from '@/lib/prisma'
import { notifyUser, notifyMany } from '@/lib/api/notify'
import { hasAccessToEquipment } from '@/lib/middleware/family-filter'
import {
  assertEquipmentMaintenanceWrite,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { formatLocalDateTime, parseScheduledDateTime } from '@/lib/forms/form-date'

function equipmentDisplayLabel(eq: {
  brand: string
  modelDeprecated: string
  model: { brand: any; model: string } | null
}) {
  if (eq.model) {
    const brandName =
      typeof eq.model.brand === 'object' ? (eq.model.brand?.name ?? '') : (eq.model.brand ?? '')
    return `${brandName} ${eq.model.model}`
  }
  return `${eq.brand} ${eq.modelDeprecated}`
}

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
    const supplierId = searchParams.get('supplierId') || undefined

    const isClient = session.user.role === 'CLIENT'

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    if (supplierId) where.supplierId = supplierId

    // Filtrar por familia a través del equipo
    if (familyId) {
      where.equipment = { type: { familyId } }
    } else if (!isClient && !personalOnly) {
      const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
      const { buildEquipmentFamilyWhere } = await import('@/lib/inventory/scope-filter')
      const ctx = await getInventorySessionContext(session.user)
      if (!ctx.user.isSuperAdmin) {
        if (ctx.scope.noAccess) {
          where.id = '__NONE__'
        } else if (ctx.scope.familyIds) {
          where.equipment = buildEquipmentFamilyWhere(ctx.scope.familyIds)
        }
      }
    }

    // Cliente solo ve mantenimientos de sus equipos asignados
    if (isClient || personalOnly) {
      const myAssignments = await prisma.equipment_assignments.findMany({
        where: { receiverId: session.user.id, isActive: true },
        select: { equipmentId: true },
      })
      const myEquipmentIds = myAssignments.map(a => a.equipmentId)
      where.OR = [{ equipmentId: { in: myEquipmentIds } }, { requestedById: session.user.id }]
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit
    const search = searchParams.get('search')?.trim() || undefined

    if (search) {
      const searchFilter = {
        OR: [
          { description: { contains: search, mode: 'insensitive' as const } },
          { equipment: { code: { contains: search, mode: 'insensitive' as const } } },
          { equipment: { brand: { contains: search, mode: 'insensitive' as const } } },
          { equipment: { modelDeprecated: { contains: search, mode: 'insensitive' as const } } },
          { technician: { name: { contains: search, mode: 'insensitive' as const } } },
          { requestedBy: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
      where.AND = [...((where.AND as any[]) ?? []), searchFilter]
    }

    const [records, total] = await Promise.all([
      prisma.maintenance_records.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              brand: true,
              modelDeprecated: true,
              status: true,
              model: { select: { brand: true, model: true } },
              type: { select: { name: true } },
            },
          },
          technician: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          contract: { select: { id: true, name: true, contractNumber: true } },
          requestedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.maintenance_records.count({ where }),
    ])

    // `equipment.model` viene de la relación equipment_models (select
    // {brand, model}), no de un string — el frontend siempre esperó un
    // string ahí (comportamiento previo a esa migración) y lo renderiza tal
    // cual, así que un objeto ahí tira "Objects are not valid as a React
    // child" y se cae toda la página. Se aplana acá, mismo criterio que usa
    // /api/inventory/equipment.
    const mapped = records.map(r => ({
      ...r,
      equipment: r.equipment
        ? {
            ...r.equipment,
            brand: r.equipment.model?.brand?.name ?? r.equipment.brand ?? '',
            model: r.equipment.model?.model ?? r.equipment.modelDeprecated ?? '',
          }
        : null,
    }))

    return NextResponse.json({
      records: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    })
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
    const {
      equipmentId,
      type,
      description,
      scheduledDate,
      technicianId,
      supplierId,
      contractId,
      notes,
    } = body

    if (!equipmentId || !type || !description || !scheduledDate) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: equipmentId, type, description, scheduledDate' },
        { status: 400 }
      )
    }

    if (!['PREVENTIVE', 'CORRECTIVE'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de mantenimiento inválido' }, { status: 400 })
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

    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        model: { select: { brand: true, model: true } },
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

    const user = toInventoryAccessUser(session.user)
    const isClient = session.user.role === 'CLIENT'

    if (isClient) {
      const hasAccess = await hasAccessToEquipment(
        session.user.id,
        session.user.role,
        session.user.isSuperAdmin || false,
        equipmentId
      )
      if (!hasAccess) {
        return NextResponse.json({ error: 'No tienes acceso a este equipo' }, { status: 403 })
      }
    } else {
      try {
        await assertEquipmentMaintenanceWrite(user, equipmentId)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    const when = parseScheduledDateTime(scheduledDate)
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Fecha y hora inválidas' }, { status: 400 })
    }

    let maintenance
    if (isClient) {
      // Cliente solicita mantenimiento
      maintenance = await MaintenanceService.requestMaintenance(
        {
          equipmentId,
          type,
          description,
          scheduledDate: when,
          requestedById: session.user.id,
          notes,
        },
        session.user.id
      )

      // Notificar a admins/técnicos sobre la solicitud
      const staffMembers = await prisma.users.findMany({
        where: { role: { in: ['ADMIN', 'TECHNICIAN'] }, isActive: true },
        select: { id: true },
      })

      const equipmentLabel = `${equipment.code} (${equipmentDisplayLabel(equipment)})`
      const requesterName = session.user.name || session.user.email

      await notifyMany(
        staffMembers.map(u => u.id),
        'INFO',
        `Solicitud de mantenimiento — ${equipment.code}`,
        `${requesterName} solicitó mantenimiento ${type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para el equipo ${equipmentLabel}. Motivo: ${description}`,
        { metadata: { equipmentId, maintenanceId: maintenance.id, action: 'approve_maintenance' } }
      )
    } else {
      // Admin/Técnico programa mantenimiento directamente
      maintenance = await MaintenanceService.createMaintenance(
        {
          equipmentId,
          type,
          description,
          scheduledDate: when,
          technicianId: technicianId || undefined,
          supplierId: supplierId || undefined,
          contractId: contractId || undefined,
          notes,
        },
        session.user.id
      )

      // Notificar al cliente asignado si existe
      const activeAssignment = equipment.assignments?.[0]
      if (activeAssignment?.receiver) {
        const receiver = activeAssignment.receiver
        const maintenanceTypeLabel = type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'
        const formattedDate = formatLocalDateTime(when)
        const equipmentLabel = `${equipment.code} (${equipmentDisplayLabel(equipment)})`
        const supplierName = (maintenance as { supplier?: { name?: string } | null }).supplier?.name
        const contract = (
          maintenance as { contract?: { name?: string; contractNumber?: string | null } | null }
        ).contract
        const performerLine = supplierName
          ? `Lo realizará el proveedor <strong>${supplierName}</strong>${
              contract ? ` (contrato ${contract.contractNumber || contract.name})` : ''
            }.`
          : 'Lo realizará el equipo técnico interno.'

        await notifyUser(
          receiver.id,
          'INFO',
          `Mantenimiento programado — ${equipment.code}`,
          `El equipo ${equipmentLabel} entrará en mantenimiento ${maintenanceTypeLabel} el ${formattedDate}. ${
            supplierName ? `Proveedor: ${supplierName}. ` : ''
          }Motivo: ${description}`,
          {
            metadata: {
              equipmentId,
              maintenanceId: maintenance.id,
              supplierId: supplierId || null,
              contractId: contractId || null,
            },
            email: {
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
                      <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Responsable</td>
                      <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${
                        supplierName ? `Proveedor: ${supplierName}` : 'Técnico interno'
                      }</td>
                    </tr>
                    <tr style="background: #f9fafb;">
                      <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #e5e7eb;">Motivo</td>
                      <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${description}</td>
                    </tr>
                  </table>
                  <p>${performerLine}</p>
                  <p>Si tienes alguna consulta, contacta al equipo de soporte.</p>
                </div>
              `,
              module: 'inventory',
              event: 'inventoryAct',
              priority: 'important',
            },
          }
        )
      }
    }

    return NextResponse.json({ maintenance }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al registrar mantenimiento'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
