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
        customValues: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Obtener todos los custom fields de las familias involucradas
    const familyIds = [...new Set(equipment.map(eq => eq.type.familyId).filter(Boolean))]
    const customFields = await prisma.family_custom_fields.findMany({
      where: {
        familyId: { in: familyIds as string[] },
      },
    })

    // Crear un mapa de fieldName -> field info por familia
    const fieldsByFamily = new Map<string, Map<string, (typeof customFields)[0]>>()
    customFields.forEach(field => {
      if (!fieldsByFamily.has(field.familyId)) {
        fieldsByFamily.set(field.familyId, new Map())
      }
      fieldsByFamily.get(field.familyId)!.set(field.fieldName, field)
    })

    // Transformar a formato PublicEquipmentItem
    const publicItems: PublicEquipmentItem[] = equipment.map(eq => {
      // Transformar customValues a un objeto key-value con labels
      const customAttributes: Record<string, { value: string; label: string; type: string }> = {}

      if (eq.customValues && eq.customValues.length > 0 && eq.type.familyId) {
        const familyFields = fieldsByFamily.get(eq.type.familyId)

        eq.customValues.forEach(cv => {
          const fieldInfo = familyFields?.get(cv.fieldName)
          if (fieldInfo) {
            customAttributes[cv.fieldName] = {
              value: cv.fieldValue,
              label: fieldInfo.fieldLabel,
              type: fieldInfo.fieldType,
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
