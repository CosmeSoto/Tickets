/**
 * API: Consumable Types
 * GET /api/admin/inventory/consumable-types
 * POST /api/admin/inventory/consumable-types
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const consumableTypeSchema = z.object({
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(50),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  familyId: z.string().uuid('ID de familia inválido').optional().nullable(),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).optional().default(999),
})

/**
 * GET - Obtener todos los tipos de suministro
 * Query params:
 * - familyId: filtrar por familia (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    const where: any = {}
    if (familyId) {
      where.familyId = familyId
    }

    const consumableTypes = await prisma.consumable_types.findMany({
      where,
      include: {
        family: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
        _count: {
          select: {
            consumables: true,
            attributes: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ types: consumableTypes })
  } catch (error) {
    console.error('Error obteniendo tipos de suministro:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de suministro' }, { status: 500 })
  }
}

/**
 * POST - Crear tipo de suministro
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()

    // Validar
    const validation = consumableTypeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Si se especifica familyId, verificar que existe
    if (validation.data.familyId) {
      const family = await prisma.families.findUnique({
        where: { id: validation.data.familyId },
      })

      if (!family) {
        return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
      }
    }

    // Verificar que no exista un tipo con el mismo código
    const existing = await prisma.consumable_types.findUnique({
      where: { code: validation.data.code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de suministro con ese código' },
        { status: 409 }
      )
    }

    // Crear tipo de suministro
    const consumableType = await prisma.consumable_types.create({
      data: {
        code: validation.data.code,
        name: validation.data.name,
        description: validation.data.description || null,
        icon: validation.data.icon || null,
        familyId: validation.data.familyId || null,
        isActive: validation.data.isActive,
        order: validation.data.order,
      },
      include: {
        family: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
      },
    })

    return NextResponse.json({ type: consumableType }, { status: 201 })
  } catch (error) {
    console.error('Error creando tipo de suministro:', error)
    return NextResponse.json({ error: 'Error al crear tipo de suministro' }, { status: 500 })
  }
}
