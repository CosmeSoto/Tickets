/**
 * API Endpoint: GET /api/public/assets-for-sale
 *
 * Lista equipos en venta (FOR_SALE) agrupados por modelo
 * Endpoint público - no requiere autenticación
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { groupByModel } from '@/lib/services/equipment-grouping.service'
import type { PublicEquipmentItem } from '@/types/equipment-grouping'
import type { EquipmentCondition } from '@prisma/client'

export const dynamic = 'force-dynamic'

const CONDITIONS: EquipmentCondition[] = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']

/**
 * GET /api/public/assets-for-sale
 *
 * Retorna equipos en venta agrupados por modelo.
 * `request` es opcional para compatibilidad con tests que llaman sin argumentos.
 */
export async function GET(request?: NextRequest) {
  try {
    const sp = request?.nextUrl?.searchParams
    const familyId = sp?.get('familyId') ?? undefined
    const typeId = sp?.get('typeId') ?? undefined
    const conditionParam = sp?.get('condition') ?? undefined
    const limitParam = sp?.get('limit')
    const take = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : undefined

    const condition =
      conditionParam && CONDITIONS.includes(conditionParam as EquipmentCondition)
        ? (conditionParam as EquipmentCondition)
        : undefined

    const equipment = await prisma.equipment.findMany({
      where: {
        status: 'FOR_SALE',
        ...(familyId ? { type: { familyId } } : {}),
        ...(typeId ? { typeId } : {}),
        ...(condition ? { condition } : {}),
      },
      ...(take ? { take } : {}),
      include: {
        model: { select: { id: true, brand: true, model: true } },
        type: {
          include: {
            family: true,
            attributes: true,
          },
        },
        customValues: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Obtener todos los custom fields legacy de las familias involucradas (fallback)
    const familyIds = [...new Set(equipment.map(eq => eq.type.familyId).filter(Boolean))]
    const legacyCustomFields = await prisma.family_custom_fields.findMany({
      where: {
        familyId: { in: familyIds as string[] },
      },
    })

    // Crear un mapa de fieldName -> field info por familia (legacy)
    const legacyFieldsByFamily = new Map<string, Map<string, (typeof legacyCustomFields)[0]>>()
    legacyCustomFields.forEach(field => {
      if (!legacyFieldsByFamily.has(field.familyId)) {
        legacyFieldsByFamily.set(field.familyId, new Map())
      }
      legacyFieldsByFamily.get(field.familyId)!.set(field.fieldName, field)
    })

    // Transformar a formato PublicEquipmentItem
    const publicItems: PublicEquipmentItem[] = equipment.map(eq => {
      // Transformar customValues a un objeto key-value con labels
      const customAttributes: Record<string, { value: string; label: string; type: string }> = {}

      if (eq.customValues && eq.customValues.length > 0) {
        // PRIORIDAD 1: Usar atributos del nuevo sistema (por tipo)
        if (eq.type.attributes && eq.type.attributes.length > 0) {
          const typeAttributesMap = new Map(
            eq.type.attributes.map((attr: any) => [attr.attributeName, attr])
          )

          eq.customValues.forEach(cv => {
            const attrInfo = typeAttributesMap.get(cv.fieldName)
            if (attrInfo && attrInfo.isVisible) {
              customAttributes[cv.fieldName] = {
                value: cv.fieldValue,
                label: attrInfo.attributeLabel,
                type: attrInfo.attributeType,
              }
            }
          })
        }
        // FALLBACK: Usar custom fields legacy por familia
        else if (eq.type.familyId) {
          const familyFields = legacyFieldsByFamily.get(eq.type.familyId)

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
      }

      return {
        id: eq.id,
        code: eq.code,
        serialNumber: eq.serialNumber,
        brand: eq.brand,
        model: eq.model ? [eq.model.brand, eq.model.model].filter(Boolean).join(' ') : eq.model,
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
        specifications: null,
        customAttributes, // Atributos personalizados (nuevo sistema + legacy)
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
