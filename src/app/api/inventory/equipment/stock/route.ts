/**
 * API Endpoint: GET /api/inventory/equipment/stock
 *
 * Obtiene información de stock para un modelo específico
 * Requiere autenticación
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { buildCacheKey } from '@/lib/api-cache'
import type { StockInfo } from '@/types/equipment-grouping'

export const dynamic = 'force-dynamic'

/**
 * GET /api/inventory/equipment/stock
 *
 * Retorna información de stock para un modelo específico
 *
 * Query params (todos requeridos):
 * - brand: string - Marca del equipo
 * - model: string - Modelo del equipo
 * - typeId: string - ID del tipo de equipo
 *
 * @returns StockInfo - Contadores por estado
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Parsear query params
    const { searchParams } = new URL(request.url)
    const brand = searchParams.get('brand')
    const model = searchParams.get('model')
    const typeId = searchParams.get('typeId')

    // 3. Validar parámetros requeridos
    if (!brand || !model || !typeId) {
      return NextResponse.json(
        {
          error: 'Parámetros faltantes',
          message: 'Se requieren brand, model y typeId para consultar stock',
        },
        { status: 400 }
      )
    }

    // 4. Generar cache key
    const cacheKey = `inventory:equipment:stock:${brand}:${model}:${typeId}`

    // 5. Intentar obtener de caché
    // const cached = await getCachedData<StockInfo>(cacheKey)

    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'X-Cache': 'HIT',
        },
      })
    }

    // 6. Consultar equipos que coincidan con brand, model, typeId
    const equipment = await prisma.equipment.findMany({
      where: {
        brand,
        model,
        typeId,
      },
      select: {
        status: true,
      },
    })

    // 7. Calcular contadores por estado
    const stockInfo: StockInfo = {
      brand,
      model,
      typeId,
      total: equipment.length,
      available: 0,
      assigned: 0,
      maintenance: 0,
      forSale: 0,
      sold: 0,
      retired: 0,
      isNewModel: equipment.length === 0,
      lastUpdated: new Date(),
    }

    // Contar por estado
    for (const eq of equipment) {
      switch (eq.status) {
        case 'AVAILABLE':
          stockInfo.available++
          break
        case 'ASSIGNED':
          stockInfo.assigned++
          break
        case 'MAINTENANCE':
          stockInfo.maintenance++
          break
        case 'FOR_SALE':
          stockInfo.forSale++
          break
        case 'SOLD':
          stockInfo.sold++
          break
        case 'RETIRED':
          stockInfo.retired++
          break
      }
    }

    // 8. Guardar en caché (TTL 30s)
    // await setCachedData(cacheKey, stockInfo, 30)

    // 9. Retornar respuesta
    return NextResponse.json(stockInfo, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Error obteniendo información de stock:', error)

    return NextResponse.json(
      {
        error: 'Error al obtener información de stock',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
