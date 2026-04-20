import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'

/**
 * GET /api/inventory/return-acts
 * Lista actas de devolución.
 * - ADMIN / SuperAdmin: todas
 * - Gestor: las de sus familias + las propias
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
    const canManage = !isAdmin && await canManageInventory(userId, session.user.role)

    const statusFilter = status !== 'all' ? { status } : {}

    let acts: any[]
    let total: number

    if (isAdmin || canManage) {
      // Admin y gestores ven todas (gestor filtra por familias en el futuro si es necesario)
      ;[acts, total] = await Promise.all([
        (prisma.return_acts as any).findMany({
          where: statusFilter,
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
        (prisma.return_acts as any).count({ where: statusFilter }),
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
      const receiverInfo = typeof act.receiverInfo === 'string'
        ? JSON.parse(act.receiverInfo) : act.receiverInfo
      const delivererInfo = typeof act.delivererInfo === 'string'
        ? JSON.parse(act.delivererInfo) : act.delivererInfo
      const equipmentSnapshot = typeof act.equipmentSnapshot === 'string'
        ? JSON.parse(act.equipmentSnapshot) : act.equipmentSnapshot

      return {
        id: act.id,
        folio: act.folio,
        status: act.status,
        returnCondition: act.returnCondition,
        createdAt: act.createdAt,
        expirationDate: act.expirationDate,
        acceptedAt: act.acceptedAt,
        rejectedAt: act.rejectedAt,
        returnDate: act.returnDate,
        receiverInfo,
        delivererInfo,
        equipmentSnapshot,
        equipment: act.assignment?.equipment ?? null,
        userRole: isAdmin || canManage ? 'admin'
          : receiverInfo?.id === userId && delivererInfo?.id === userId ? 'both'
          : receiverInfo?.id === userId ? 'returner'   // quien devuelve
          : 'receiver',                                 // quien recibe la devolución
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
