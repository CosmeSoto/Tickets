/**
 * API Endpoint: GET /api/inventory/equipment/stock/available
 *
 * Consulta la cantidad de equipos disponibles de un tipo específico
 * Usado para validación de disponibilidad en solicitudes de activos
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import {
  assertEquipmentTypeRead,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/equipment/stock/available?typeId={typeId}
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ctx = await getInventorySessionContext(session.user)
    if (ctx.scope.noAccess) {
      return NextResponse.json({ available: 0 })
    }

    const { searchParams } = new URL(request.url)
    const typeId = searchParams.get('typeId')

    if (!typeId) {
      return NextResponse.json({ error: 'typeId es requerido' }, { status: 400 })
    }

    try {
      await assertEquipmentTypeRead(toInventoryAccessUser(session.user), typeId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const cacheKey = buildCacheKey('equipment-stock-available', {
      uid: session.user.id,
      typeId,
      families: ctx.scope.familyIds?.join(',') ?? 'all',
    })
    const { available } = await withCache(cacheKey, 30, async () => {
      const available = await prisma.equipment.count({
        where: {
          typeId,
          status: 'AVAILABLE',
        },
      })
      return { available }
    })

    return NextResponse.json({ available })
  } catch (error) {
    console.error('[API] Error fetching available stock:', error)
    return NextResponse.json({ error: 'Error al consultar stock disponible' }, { status: 500 })
  }
}
