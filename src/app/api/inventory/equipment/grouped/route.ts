/**
 * API Endpoint: GET /api/inventory/equipment/grouped
 *
 * Vista agrupada de inventario con contadores por estado
 * Requiere autenticación y permisos de gestión de inventario
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { withCache, buildCacheKey, invalidateCache } from '@/lib/api-cache'
import type { GroupedInventoryRow, EquipmentSummary } from '@/types/equipment-grouping'

export const dynamic = 'force-dynamic'

/**
 * GET /api/inventory/equipment/grouped
 *
 * Retorna equipos agrupados por modelo con contadores de estado
 *
 * Query params:
 * - search?: string - Busca en brand, model, type.name
 * - familyId?: string - Filtra por familia
 * - typeId?: string - Filtra por tipo
 * - page?: number - Página actual (default: 1)
 * - limit?: number - Items por página (default: 20)
 *
 * @returns {
 *   groups: GroupedInventoryRow[] - Grupos con contadores
 *   pagination: { page, limit, total, totalPages }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Verificar permisos
    const hasPermission = await canManageInventory(session.user.id)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver el inventario' },
        { status: 403 }
      )
    }

    // 3. Parsear query params
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const typeId = searchParams.get('typeId') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    // 4. Generar cache key
    const cacheKey = buildCacheKey('inventory:equipment:grouped', {
      search: search || 'all',
      familyId: familyId || 'all',
      typeId: typeId || 'all',
      page,
      limit,
    })

    // 5. Intentar obtener de caché (temporalmente deshabilitado)
    // TODO: Refactorizar para usar withCache correctamente
    // const cached = await getCachedData<{...}>(cacheKey)

    // 6. Construir filtros
    const where: any = {}

    // Filtro de búsqueda
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { type: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Filtro por tipo
    if (typeId) {
      where.typeId = typeId
    }

    // Filtro por familia (a través de type)
    if (familyId) {
      where.type = {
        ...where.type,
        familyId,
      }
    }

    // 7. Consultar equipos con filtros
    const equipment = await prisma.equipment.findMany({
      where,
      include: {
        type: {
          include: {
            family: true,
          },
        },
        assignments: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            receiver: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
    })

    // 8. Agrupar equipos por modelo
    const groupsMap = new Map<string, GroupedInventoryRow>()

    for (const eq of equipment) {
      // Generar groupId basado en criterios de agrupación
      const groupId = `${eq.brand}|${eq.model}|${eq.typeId}`

      if (!groupsMap.has(groupId)) {
        // Crear nuevo grupo
        groupsMap.set(groupId, {
          groupId,
          brand: eq.brand,
          model: eq.model,
          type: {
            id: eq.type.id,
            name: eq.type.name,
            code: eq.type.code,
          },
          family: eq.type.family
            ? {
                id: eq.type.family.id,
                name: eq.type.family.name,
                icon: eq.type.family.icon,
                color: eq.type.family.color,
              }
            : null,
          total: 0,
          available: 0,
          assigned: 0,
          maintenance: 0,
          forSale: 0,
          sold: 0,
          retired: 0,
          units: [],
        })
      }

      const group = groupsMap.get(groupId)!

      // Incrementar contadores
      group.total++

      switch (eq.status) {
        case 'AVAILABLE':
          group.available++
          break
        case 'ASSIGNED':
          group.assigned++
          break
        case 'MAINTENANCE':
          group.maintenance++
          break
        case 'FOR_SALE':
          group.forSale++
          break
        case 'SOLD':
          group.sold++
          break
        case 'RETIRED':
          group.retired++
          break
      }

      // Agregar unidad al grupo
      const unit: EquipmentSummary = {
        id: eq.id,
        code: eq.code,
        serialNumber: eq.serialNumber,
        status: eq.status,
        condition: eq.condition,
        location: eq.location,
        physicalLocation: eq.physicalLocation,
        assignedTo:
          eq.assignments.length > 0
            ? {
                id: eq.assignments[0].receiver.id,
                name: eq.assignments[0].receiver.name,
                email: eq.assignments[0].receiver.email,
              }
            : null,
        createdAt: eq.createdAt,
        updatedAt: eq.updatedAt,
      }

      group.units.push(unit)
    }

    // 9. Convertir a array y aplicar paginación
    const allGroups = Array.from(groupsMap.values())
    const total = allGroups.length
    const totalPages = Math.ceil(total / limit)
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedGroups = allGroups.slice(startIndex, endIndex)

    // 10. Preparar respuesta
    const response = {
      groups: paginatedGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }

    // 11. Guardar en caché (temporalmente deshabilitado)
    // TODO: Refactorizar para usar withCache correctamente
    // await setCachedData(cacheKey, response, 30)

    // 12. Retornar respuesta
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'X-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Error obteniendo inventario agrupado:', error)

    return NextResponse.json(
      {
        error: 'Error al obtener inventario agrupado',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
