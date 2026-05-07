import { NextRequest, NextResponse } from 'next/server'
import { Prisma, EquipmentCondition } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/assets-for-sale
 * Retorna equipos con estado FOR_SALE sin requerir autenticación.
 *
 * Query params opcionales:
 *   - familyId  — filtra por familia del tipo de equipo
 *   - typeId    — filtra por tipo de equipo específico
 *   - condition — filtra por condición del equipo (EquipmentCondition)
 *   - limit     — limita el número de resultados (para preview en landing page)
 *
 * Campos sensibles excluidos explícitamente mediante select:
 *   purchasePrice, purchaseDate, invoiceNumber, serialNumber,
 *   departmentId, supplierId, usefulLifeYears, residualValue,
 *   depreciationMethod, rentalProvider, contractId, warehouseId
 *
 * Resolución de contactWhatsapp (fallback en cascada):
 *   1. family.contactWhatsapp → número específico de la familia
 *   2. system_settings['contact.whatsapp_number'] → número global
 *   3. null → el frontend redirige a /login
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const familyId = searchParams.get('familyId') ?? undefined
    const typeId = searchParams.get('typeId') ?? undefined
    const condition = searchParams.get('condition') ?? undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    // Leer el número global de WhatsApp una vez al inicio del handler
    const globalWhatsappSetting = await prisma.system_settings.findUnique({
      where: { key: 'contact.whatsapp_number' },
    })
    const globalWhatsapp = globalWhatsappSetting?.value ?? null

    const where: Prisma.equipmentWhereInput = {
      status: 'FOR_SALE',
      ...(typeId && { typeId }),
      ...(familyId && { type: { familyId } }),
      ...(condition && { condition: condition as EquipmentCondition }),
    }

    const items = await prisma.equipment.findMany({
      where,
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        condition: true,
        photoUrl: true,
        specifications: true,
        accessories: true,
        notes: true,
        saleListingPrice: true,
        updatedAt: true,
        type: {
          select: {
            id: true,
            name: true,
            family: {
              select: {
                id: true,
                name: true,
                icon: true,
                color: true,
                contactWhatsapp: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      ...(limit && { take: limit }),
    })

    // Mapear cada item para resolver contactWhatsapp con fallback en cascada
    const itemsWithResolvedContact = items.map(item => ({
      ...item,
      contactWhatsapp: item.type.family?.contactWhatsapp ?? globalWhatsapp ?? null,
    }))

    return NextResponse.json({ items: itemsWithResolvedContact })
  } catch (error) {
    console.error('Error en GET /api/public/assets-for-sale:', error)
    return NextResponse.json({ error: 'Error al obtener activos en venta' }, { status: 500 })
  }
}
