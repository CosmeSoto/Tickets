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

// Solo 3 condiciones válidas (enum EquipmentCondition definitivo)
const CONDITIONS: EquipmentCondition[] = ['NEW', 'USED', 'DAMAGED']

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

    // Obtener settings para WhatsApp
    const [equipment, settings] = await Promise.all([
      prisma.equipment.findMany({
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
          attachments: {
            where: {
              mimeType: {
                in: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.system_settings.findMany({
        where: {
          key: { in: ['landing.social_whatsapp', 'contact.phone'] },
        },
      }),
    ])

    // Obtener WhatsApp de settings
    const whatsAppSetting =
      settings.find(s => s.key === 'landing.social_whatsapp') ||
      settings.find(s => s.key === 'contact.phone')
    const contactWhatsapp = whatsAppSetting?.value || null

    // Obtener todos los custom fields legacy de las familias involucradas (fallback)
    const familyIds = [
      ...new Set(equipment.map(eq => eq.type?.familyId).filter(Boolean)),
    ] as string[]
    const legacyCustomFields =
      familyIds.length > 0
        ? await prisma.family_custom_fields.findMany({
            where: {
              familyId: { in: familyIds },
            },
          })
        : []

    // Crear un mapa de fieldName -> field info por familia (legacy)
    const legacyFieldsByFamily = new Map<string, Map<string, (typeof legacyCustomFields)[0]>>()
    legacyCustomFields.forEach(field => {
      if (!legacyFieldsByFamily.has(field.familyId)) {
        legacyFieldsByFamily.set(field.familyId, new Map())
      }
      legacyFieldsByFamily.get(field.familyId)!.set(field.fieldName, field)
    })

    // Transformar a formato PublicEquipmentItem
    const publicItems: PublicEquipmentItem[] = equipment
      .map(eq => {
        try {
          if (!eq.type) {
            throw new Error('Equipo sin relación de tipo')
          }

          const customAttributes: Record<string, { value: string; label: string; type: string }> =
            {}

          if (eq.customValues && eq.customValues.length > 0) {
            if (eq.type.attributes && eq.type.attributes.length > 0) {
              const sortedVisibleAttributes = [...eq.type.attributes]
                .filter((attr: any) => attr?.isVisible)
                .sort((a: any, b: any) => (a?.order ?? 0) - (b?.order ?? 0))

              sortedVisibleAttributes.forEach((attr: any) => {
                const cv = eq.customValues.find(cv => cv.fieldName === attr.attributeName)
                if (cv) {
                  customAttributes[attr.attributeName] = {
                    value: cv.fieldValue != null ? String(cv.fieldValue) : '',
                    label: attr.attributeLabel,
                    type: attr.attributeType,
                  }
                }
              })
            } else if (eq.type.familyId) {
              const familyFields = legacyFieldsByFamily.get(eq.type.familyId)
              if (familyFields) {
                const sortedFields = [...familyFields.entries()].sort(
                  ([, a], [, b]) => a.order - b.order
                )

                sortedFields.forEach(([fieldName, fieldInfo]) => {
                  const cv = eq.customValues.find(cv => cv.fieldName === fieldName)
                  if (cv) {
                    customAttributes[fieldName] = {
                      value: cv.fieldValue != null ? String(cv.fieldValue) : '',
                      label: fieldInfo.fieldLabel,
                      type: fieldInfo.fieldType,
                    }
                  }
                })
              }
            }
          }

          const resolvedBrand = eq.model?.brand?.name || eq.brand || ''
          const resolvedModel = eq.model?.model || eq.modelDeprecated || ''

          let publicImageUrl: string | null = null
          if (eq.attachments && eq.attachments.length > 0 && eq.attachments[0]?.id) {
            publicImageUrl = `/api/public/equipment-attachments/${eq.attachments[0].id}`
          } else if (eq.photoUrl) {
            publicImageUrl = eq.photoUrl
          }

          return {
            id: eq.id,
            code: eq.code,
            serialNumber: eq.serialNumber,
            brand: resolvedBrand,
            model: resolvedModel,
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
            photoUrl: publicImageUrl,
            specifications: null,
            customAttributes,
            createdAt: eq.createdAt,
            contactWhatsapp,
          }
        } catch (error) {
          console.error(`Error transformando equipo ${eq.id}:`, error)
          return null
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) as PublicEquipmentItem[]

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
