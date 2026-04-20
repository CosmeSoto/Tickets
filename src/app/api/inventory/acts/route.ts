import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inventory/acts
 * Lista las actas donde el usuario es entregador o receptor (o todas si es ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING | ACCEPTED | REJECTED | EXPIRED | all
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    // Construir filtro de estado
    const statusFilter: any = status && status !== 'all' ? { status } : {}

    // Admin ve todas; otros solo las suyas
    const whereClause = isAdmin
      ? { ...statusFilter }
      : {
          ...statusFilter,
          OR: [
            // Buscar por ID en los campos JSON delivererInfo y receiverInfo
            // Prisma no puede filtrar dentro de Json directamente, usamos string_contains
          ],
        }

    // Para no-admin: obtener actas donde aparece como deliverer o receiver
    // Usamos raw query para filtrar dentro del JSON
    let acts: any[]
    let total: number

    if (isAdmin) {
      ;[acts, total] = await Promise.all([
        prisma.delivery_acts.findMany({
          where: statusFilter,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { assignment: { include: { equipment: true } } },
        }),
        prisma.delivery_acts.count({ where: statusFilter }),
      ])
    } else {
      // Filtrar por userId dentro del JSON usando path filter de Prisma
      const jsonFilter: any = {
        OR: [
          { delivererInfo: { path: ['id'], equals: userId } },
          { receiverInfo:  { path: ['id'], equals: userId } },
        ],
        ...statusFilter,
      }
      ;[acts, total] = await Promise.all([
        prisma.delivery_acts.findMany({
          where: jsonFilter,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { assignment: { include: { equipment: true } } },
        }),
        prisma.delivery_acts.count({ where: jsonFilter }),
      ])
    }

    // Parsear campos JSON y añadir rol del usuario
    const result = acts.map((act: any) => {
      const delivererInfo = typeof act.delivererInfo === 'string'
        ? JSON.parse(act.delivererInfo) : act.delivererInfo
      const receiverInfo = typeof act.receiverInfo === 'string'
        ? JSON.parse(act.receiverInfo) : act.receiverInfo
      const equipmentSnapshot = typeof act.equipmentSnapshot === 'string'
        ? JSON.parse(act.equipmentSnapshot) : act.equipmentSnapshot

      return {
        id: act.id,
        folio: act.folio,
        status: act.status,
        createdAt: act.createdAt,
        expirationDate: act.expirationDate,
        acceptedAt: act.acceptedAt,
        rejectedAt: act.rejectedAt,
        delivererInfo,
        receiverInfo,
        equipmentSnapshot,
        equipment: act.assignment?.equipment ?? null,
        userRole: isAdmin ? 'admin'
          : delivererInfo?.id === userId && receiverInfo?.id === userId ? 'both'
          : delivererInfo?.id === userId ? 'deliverer'
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

    if (!await canManageInventory(session.user.id, session.user.role)) {
      return NextResponse.json({ error: 'No tienes permiso para gestionar el inventario' }, { status: 403 })
    }

    const body = await request.json()
    const { actType = 'EQUIPMENT_ASSIGNMENT', referenceId, referenceType, description, quantity, warehouseDestId, assignmentId } = body

    if (actType === 'EQUIPMENT_ASSIGNMENT') {
      return NextResponse.json({ error: 'Para actas de asignación de equipo usa el flujo de asignaciones' }, { status: 400 })
    }

    if (!referenceId) {
      return NextResponse.json({ error: 'referenceId es requerido' }, { status: 400 })
    }

    if (actType === 'MRO_DELIVERY' && !quantity) {
      return NextResponse.json({ error: 'quantity es requerido para MRO_DELIVERY' }, { status: 400 })
    }
    if (actType === 'SERVICE_COMPLETION' && !description) {
      return NextResponse.json({ error: 'description es requerido para SERVICE_COMPLETION' }, { status: 400 })
    }
    if (actType === 'ASSET_TRANSFER' && !warehouseDestId) {
      return NextResponse.json({ error: 'warehouseDestId es requerido para ASSET_TRANSFER' }, { status: 400 })
    }

    const folio = await FolioService.generateDeliveryActFolio()
    const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 7)

    const delivererInfo = { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role }

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
