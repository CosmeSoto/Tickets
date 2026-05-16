import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inventory/acts
 * Lista las actas donde el usuario es entregador o receptor (o todas si es ADMIN)
 * Soporta búsqueda avanzada con múltiples filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING | ACCEPTED | REJECTED | EXPIRED | all
    const actType = searchParams.get('actType') // Filtro por tipo de acta
    const createdBy = searchParams.get('createdBy') // Filtro por creador
    const equipmentId = searchParams.get('equipmentId') // Filtro por equipo
    const familyId = searchParams.get('familyId') // Filtro por familia
    const startDate = searchParams.get('startDate') // Rango de fechas
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search') // Búsqueda por folio o notas
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const userId = session.user.id
    const userRole = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const isAdmin = userRole === 'ADMIN'
    const canManage =
      !isAdmin &&
      (await import('@/lib/inventory-access').then(m => m.canManageInventory(userId, userRole)))
    const isFullAdmin = isAdmin

    // Construir filtros
    const filters: any = {}

    // Filtro de estado
    if (status && status !== 'all') {
      filters.status = status
    }

    // Filtro de tipo de acta
    if (actType) {
      filters.actType = actType
    }

    // Filtro por creador (delivererInfo.id)
    if (createdBy) {
      filters.delivererInfo = { path: ['id'], equals: createdBy }
    }

    // Filtro por equipo (a través de assignment)
    if (equipmentId) {
      filters.assignment = {
        equipmentId: equipmentId,
      }
    }

    // Filtro por familia (a través de assignment.equipment.type)
    if (familyId) {
      filters.assignment = {
        ...filters.assignment,
        equipment: {
          type: {
            familyId: familyId,
          },
        },
      }
    } else if (isAdmin && !isSuperAdmin) {
      // Admin Normal sin familyId explícito: aplicar scope de inventario
      const { getInventoryScope } = await import('@/lib/inventory/scope-filter')
      const scope = await getInventoryScope(
        userId,
        userRole,
        false,
        (session.user as any).canManageInventory === true
      )
      if (scope.familyIds && scope.familyIds.length > 0) {
        filters.assignment = {
          ...filters.assignment,
          equipment: {
            type: {
              familyId: { in: scope.familyIds },
            },
          },
        }
      } else if (scope.noAccess) {
        return NextResponse.json({ acts: [], total: 0, page, limit, totalPages: 0 })
      }
    }

    // Rango de fechas
    if (startDate || endDate) {
      filters.createdAt = {}
      if (startDate) {
        filters.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        filters.createdAt.lte = new Date(endDate)
      }
    }

    // Búsqueda por texto (folio)
    if (search) {
      filters.folio = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // Admin ve todas; otros solo las suyas
    let acts: any[]
    let total: number

    if (isFullAdmin) {
      ;[acts, total] = await Promise.all([
        prisma.delivery_acts.findMany({
          where: filters,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            assignment: {
              include: {
                equipment: {
                  include: {
                    type: {
                      include: {
                        family: {
                          select: { id: true, name: true, color: true, icon: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.delivery_acts.count({ where: filters }),
      ])
    } else {
      // Filtrar por userId dentro del JSON usando path filter de Prisma
      const jsonFilter: any = {
        OR: [
          { delivererInfo: { path: ['id'], equals: userId } },
          { receiverInfo: { path: ['id'], equals: userId } },
        ],
        ...filters,
      }
      ;[acts, total] = await Promise.all([
        prisma.delivery_acts.findMany({
          where: jsonFilter,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            assignment: {
              include: {
                equipment: {
                  include: {
                    type: {
                      include: {
                        family: {
                          select: { id: true, name: true, color: true, icon: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.delivery_acts.count({ where: jsonFilter }),
      ])
    }

    // Parsear campos JSON y añadir rol del usuario
    const result = acts.map((act: any) => {
      const delivererInfo =
        typeof act.delivererInfo === 'string' ? JSON.parse(act.delivererInfo) : act.delivererInfo
      const receiverInfo =
        typeof act.receiverInfo === 'string' ? JSON.parse(act.receiverInfo) : act.receiverInfo
      const equipmentSnapshot =
        typeof act.equipmentSnapshot === 'string'
          ? JSON.parse(act.equipmentSnapshot)
          : act.equipmentSnapshot

      return {
        id: act.id,
        folio: act.folio,
        status: act.status,
        actType: act.actType,
        createdAt: act.createdAt,
        expirationDate: act.expirationDate,
        acceptedAt: act.acceptedAt,
        rejectedAt: act.rejectedAt,
        delivererInfo,
        receiverInfo,
        equipmentSnapshot,
        equipment: act.assignment?.equipment ?? null,
        family: act.assignment?.equipment?.type?.family ?? null,
        userRole: isFullAdmin
          ? 'admin'
          : delivererInfo?.id === userId && receiverInfo?.id === userId
            ? 'both'
            : delivererInfo?.id === userId
              ? 'deliverer'
              : 'receiver',
      }
    })

    return NextResponse.json({
      acts: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/acts:', error)
    return NextResponse.json({ error: 'Error al obtener actas' }, { status: 500 })
  }
}

import { randomUUID } from 'crypto'
import { canManageInventory } from '@/lib/inventory-access'
import { FolioService } from '@/lib/services/folio.service'
import { DigitalSignatureService } from '@/lib/services/digital-signature.service'

/**
 * POST /api/inventory/acts
 * Crea un acta de entrega para los nuevos tipos (MRO_DELIVERY, SERVICE_COMPLETION, ASSET_TRANSFER).
 * Para EQUIPMENT_ASSIGNMENT usar el flujo existente de asignaciones.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json(
        { error: 'No tienes permiso para gestionar el inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      actType = 'EQUIPMENT_ASSIGNMENT',
      referenceId,
      referenceType,
      description,
      quantity,
      warehouseDestId,
      assignmentId,
    } = body

    if (actType === 'EQUIPMENT_ASSIGNMENT') {
      return NextResponse.json(
        { error: 'Para actas de asignación de equipo usa el flujo de asignaciones' },
        { status: 400 }
      )
    }

    if (!referenceId) {
      return NextResponse.json({ error: 'referenceId es requerido' }, { status: 400 })
    }

    if (actType === 'MRO_DELIVERY' && !quantity) {
      return NextResponse.json(
        { error: 'quantity es requerido para MRO_DELIVERY' },
        { status: 400 }
      )
    }
    if (actType === 'SERVICE_COMPLETION' && !description) {
      return NextResponse.json(
        { error: 'description es requerido para SERVICE_COMPLETION' },
        { status: 400 }
      )
    }
    if (actType === 'ASSET_TRANSFER' && !warehouseDestId) {
      return NextResponse.json(
        { error: 'warehouseDestId es requerido para ASSET_TRANSFER' },
        { status: 400 }
      )
    }

    const folio = await FolioService.generateDeliveryActFolio()
    const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 7)

    const delivererInfo = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    }

    const act = await (prisma.delivery_acts as any).create({
      data: {
        id: randomUUID(),
        folio,
        assignmentId: assignmentId ?? null,
        equipmentSnapshot: {},
        delivererInfo,
        receiverInfo: {},
        accessories: [],
        termsVersion: '1.0',
        status: 'PENDING',
        acceptanceToken,
        expirationDate,
        actType,
        referenceId,
        referenceType: referenceType ?? actType,
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'ACTA_CREADA',
        entityType: 'delivery_act',
        entityId: act.id,
        userId: session.user.id,
        details: { folio, actType, referenceId },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ act }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear el acta' }, { status: 500 })
  }
}
