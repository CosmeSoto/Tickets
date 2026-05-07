import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/assets-for-sale/filters
 * Retorna las familias (con sus tipos de equipo) que tienen al menos 1 equipo FOR_SALE.
 * Sin autenticación requerida.
 *
 * Respuesta: { families: Array<{ id, name, icon, color, types: Array<{ id, name }> }> }
 */
export async function GET() {
  try {
    const types = await prisma.equipment_types.findMany({
      where: { equipment: { some: { status: 'FOR_SALE' } } },
      select: {
        id: true,
        name: true,
        family: { select: { id: true, name: true, icon: true, color: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Agrupar por familia usando Map para preservar el orden de inserción
    const familyMap = new Map<
      string,
      {
        id: string
        name: string
        icon: string | null
        color: string | null
        types: { id: string; name: string }[]
      }
    >()

    for (const t of types) {
      if (!t.family) continue
      if (!familyMap.has(t.family.id)) {
        familyMap.set(t.family.id, { ...t.family, types: [] })
      }
      familyMap.get(t.family.id)!.types.push({ id: t.id, name: t.name })
    }

    return NextResponse.json({ families: Array.from(familyMap.values()) })
  } catch (error) {
    console.error('Error en GET /api/public/assets-for-sale/filters:', error)
    return NextResponse.json(
      { error: 'Error al obtener filtros de activos en venta' },
      { status: 500 }
    )
  }
}
