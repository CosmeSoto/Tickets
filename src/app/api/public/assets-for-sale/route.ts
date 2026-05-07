/**
 * API Endpoint: GET /api/public/assets-for-sale
 *
 * Lista equipos en venta (FOR_SALE) agrupados por modelo
 * Endpoint público - no requiere autenticación
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { groupByModel } from '@/lib/services/equipment-grouping.service'
import type { PublicEquipmentItem } from '@/types/equipment-grouping'

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/assets-for-sale
 *
 * Retorna equipos en venta agrupados por modelo
 *
 * @returns {
 *   items: EquipmentGroup[] - Grupos de equipos idénticos
 * }
 */
export async function GET() {
  try {
    // Consultar equipos con estado FOR_SALE
    const equipment = await prisma.equipment.findMany({
      where: {
        status: 'FOR_SALE',
      },
      include: {
        type: {
          include: {
            family: true,
          },
        },
        custom_values: {
          include: {
            field: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transformar a formato PublicEquipmentItem
    const publicItems: PublicEquipmentItem[] = equipment.map(eq => {
      // Transformar custom_values a un objeto key-value con labels
      const customAttributes: Record<string, { value: string; label: string; type: string }> = {}

      if (eq.custom_values && eq.custom_values.length > 0) {
        eq.custom_values.forEach(cv => {
          if (cv.field) {
            customAttributes[cv.fieldName] = {
              value: cv.fieldValue,
              label: cv.field.fieldLabel,
              type: cv.field.fieldType,
            }
          }
        })
      }

      return {
        id: eq.id,
        code: eq.code,
        serialNumber: eq.serialNumber,
        brand: eq.brand,
        model: eq.model,
        type: {
          id: eq.type.id,
          name: eq.type.name,
          code: eq.type.code,
          family: eq.type.family
            ? {
                id: eq.type.family.id,
                name: eq.type.family.name,
                icon: eq.type.family.icon,
                color: eq.type.family.color,
              }
            : null,
        },
        condition: eq.condition,
        saleListingPrice: eq.saleListingPrice,
        photoUrl: eq.photoUrl,
        specifications: eq.specifications as Record<string, any> | null,
        customAttributes, // Agregar atributos personalizados
        createdAt: eq.createdAt,
      }
    })

    // Agrupar equipos por modelo
    const groups = groupByModel(publicItems)

    return NextResponse.json(
      {
        items: groups,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    console.error('Error obteniendo equipos en venta:', error)

    return NextResponse.json(
      {
        error: 'Error al obtener equipos en venta',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
