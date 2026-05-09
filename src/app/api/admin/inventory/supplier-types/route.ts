/**
 * API: Supplier Types
 * GET /api/admin/inventory/supplier-types
 * POST /api/admin/inventory/supplier-types
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const supplierTypeSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional(),
  familyId: z.string().uuid('ID de familia inválido').optional().nullable(),
  isActive: z.boolean().default(true),
})

/**
 * GET - Obtener todos los tipos de proveedor
 * Query params:
 * - familyId: filtrar por familia (opcional)
 * - includeGlobal: incluir tipos globales (default: true)
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
    const includeGlobal = searchParams.get('includeGlobal') !== 'false'

    // Construir filtro
    const where: any = {}

    if (familyId) {
      // Si se especifica familyId, incluir tipos de esa familia y opcionalmente globales
      if (includeGlobal) {
        where.OR = [{ familyId }, { familyId: null }]
      } else {
        where.familyId = familyId
      }
    }
    // Si no se especifica familyId, devolver todos

    const supplierTypes = await prisma.supplier_types.findMany({
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
            suppliers: true,
          },
        },
      },
      orderBy: [{ familyId: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ supplierTypes })
  } catch (error) {
    console.error('Error obteniendo tipos de proveedor:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de proveedor' }, { status: 500 })
  }
}

/**
 * POST - Crear tipo de proveedor
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
    const validation = supplierTypeSchema.safeParse(body)
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

    // Verificar que no exista un tipo con el mismo nombre en el mismo scope
    const existing = await prisma.supplier_types.findFirst({
      where: {
        name: validation.data.name,
        familyId: validation.data.familyId || null,
      },
    })

    if (existing) {
      return NextResponse.json(
        {
          error: validation.data.familyId
            ? 'Ya existe un tipo de proveedor con ese nombre en esta familia'
            : 'Ya existe un tipo de proveedor global con ese nombre',
        },
        { status: 409 }
      )
    }

    // Crear tipo de proveedor
    const supplierType = await prisma.supplier_types.create({
      data: {
        name: validation.data.name,
        description: validation.data.description || null,
        familyId: validation.data.familyId || null,
        isActive: validation.data.isActive,
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

    return NextResponse.json({ supplierType }, { status: 201 })
  } catch (error) {
    console.error('Error creando tipo de proveedor:', error)
    return NextResponse.json({ error: 'Error al crear tipo de proveedor' }, { status: 500 })
  }
}
