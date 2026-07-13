import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { buildEquipmentFamilyWhere } from '@/lib/inventory/scope-filter'

/**
 * GET /api/inventory/equipment/count
 * Cuenta equipos con filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (ctx.scope.noAccess) {
      return NextResponse.json({ count: 0 })
    }

    const { searchParams } = new URL(request.url)
    const modelId = searchParams.get('modelId')
    const batchId = searchParams.get('batchId')
    const familyIdParam = searchParams.get('familyId')
    const status = searchParams.get('status')?.split(',')

    const where: Record<string, unknown> = {}

    if (modelId) where.modelId = modelId
    if (batchId) where.batchId = batchId
    if (status && status.length > 0) where.status = { in: status }

    if (familyIdParam && familyIdParam !== 'all') {
      if (
        !ctx.user.isSuperAdmin &&
        ctx.scope.familyIds &&
        !ctx.scope.familyIds.includes(familyIdParam)
      ) {
        return NextResponse.json({ count: 0 })
      }
      where.type = { familyId: familyIdParam }
    } else if (!ctx.user.isSuperAdmin && ctx.scope.familyIds) {
      Object.assign(where, buildEquipmentFamilyWhere(ctx.scope.familyIds))
    }

    const count = await prisma.equipment.count({ where })

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error counting equipment:', error)
    return NextResponse.json({ error: 'Error al contar equipos' }, { status: 500 })
  }
}
