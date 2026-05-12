/**
 * API Endpoint: GET /api/inventory/equipment/stock/available
 *
 * Consulta la cantidad de equipos disponibles de un tipo específico
 * Usado para validación de disponibilidad en solicitudes de activos
 *
 * Optimización: Caché Redis con TTL 30s para reducir carga en DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

/**
 * GET /api/inventory/equipment/stock/available?typeId={typeId}
 *
 * Retorna la cantidad de equipos disponibles de un tipo específico
 * Implementa caché para consultas frecuentes durante creación de solicitudes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar que el usuario tenga acceso al inventario
    if (!session.user.inventoryEnabled) {
      return NextResponse.json(
        { error: 'No tienes acceso al módulo de inventario' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const typeId = searchParams.get('typeId')

    if (!typeId) {
      return NextResponse.json({ error: 'typeId es requerido' }, { status: 400 })
    }

    // Usar caché para reducir consultas repetidas
    const cacheKey = buildCacheKey('equipment-stock-available', { typeId })
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
