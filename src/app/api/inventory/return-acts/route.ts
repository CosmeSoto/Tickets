import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { buildReturnActFamilyWhere } from '@/lib/inventory/scope-filter'

/**
 * GET /api/inventory/return-acts
 * Lista actas de devolución.
 * - Super Admin: todas
 * - Admin / Gestor: por familias de inventario accesibles
 * - Otros: solo las propias (donde son receiver o deliverer)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'
    const invCtx = await getInventorySessionContext(session.user)
    const canManage = isAdmin || invCtx.canManageInventory

    const statusFilter = status !== 'all' ? { status } : {}

    let acts: any[]
    let total: number

    if (canManage) {
      if (invCtx.scope.noAccess) {
        return NextResponse.json({
          acts: [],
          pagination: { page, limit, total: 0, pages: 0 },
        })
      }

      const familyIds = invCtx.user.isSuperAdmin ? undefined : invCtx.scope.familyIds
      const where = {
        ...statusFilter,
        ...buildReturnActFamilyWhere(familyIds),
      }

      ;[acts, total] = await Promise.all([
        (prisma.return_acts as any).findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            assignment: {
              include: {
                equipment: {
                  select: { id: true, code: true, brand: true, model: true },
                },
              },
            },
          },
        }),
        (prisma.return_acts as any).count({ where }),
      ])
    } else {
      // Participantes: solo las suyas (receiver o deliverer en el JSON)
      const jsonFilter: any = {
        OR: [
          { receiverInfo: { path: ['id'], equals: userId } },
          { delivererInfo: { path: ['id'], equals: userId } },
        ],
        ...statusFilter,
      }
      ;[acts, total] = await Promise.all([
        (prisma.return_acts as any).findMany({
          where: jsonFilter,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            assignment: {
              include: {
                equipment: {
                  select: { id: true, code: true, brand: true, model: true },
                },
              },
            },
          },
        }),
        (prisma.return_acts as any).count({ where: jsonFilter }),
      ])
    }

    // Normalizar y añadir rol del usuario
    const result = acts.map((act: any) => {
      const receiverInfo =
        typeof act.receiverInfo === 'string' ? JSON.parse(act.receiverInfo) : act.receiverInfo
      const delivererInfo =
        typeof act.delivererInfo === 'string' ? JSON.parse(act.delivererInfo) : act.delivererInfo
      const equipmentSnapshot =
        typeof act.equipmentSnapshot === 'string'
          ? JSON.parse(act.equipmentSnapshot)
          : act.equipmentSnapshot

      return {
        id: act.id,
        folio: act.folio,
        status: act.status,
        returnCondition: act.equipmentCondition ?? act.returnCondition,
        equipmentCondition: act.equipmentCondition,
        createdAt: act.createdAt,
        expirationDate: act.expirationDate,
        acceptedAt: act.acceptedAt,
        rejectedAt: act.rejectedAt,
        returnDate: act.returnDate,
        receiverInfo,
        delivererInfo,
        equipmentSnapshot,
        equipment: act.assignment?.equipment ?? null,
        userRole:
          isAdmin || canManage
            ? 'admin'
            : receiverInfo?.id === userId && delivererInfo?.id === userId
              ? 'both'
              : receiverInfo?.id === userId
                ? 'returner' // quien devuelve
                : 'receiver', // quien recibe la devolución (firma)
      }
    })

    return NextResponse.json({
      acts: result,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/return-acts:', error)
    return NextResponse.json({ error: 'Error al obtener actas de devolución' }, { status: 500 })
  }
}
