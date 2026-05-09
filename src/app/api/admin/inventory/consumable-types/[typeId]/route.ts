/**
 * API: Individual Consumable Type Management
 * GET /api/admin/inventory/consumable-types/[typeId]
 * PUT /api/admin/inventory/consumable-types/[typeId]
 * DELETE /api/admin/inventory/consumable-types/[typeId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const consumableTypeUpdateSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  familyId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

/**
 * GET - Obtener tipo de consumible por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { typeId } = await params

    const consumableType = await prisma.consumable_types.findUnique({
      where: { id: typeId },
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
    })

    if (!consumableType) {
      return NextResponse.json({ error: 'Tipo de consumible no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ consumableType })
  } catch (error) {
    console.error('Error obteniendo tipo de consumible:', error)
    return NextResponse.json({ error: 'Error al obtener tipo de consumible' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar tipo de consumible
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { typeId } = await params
    const body = await request.json()

    // Validar
    const validation = consumableTypeUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que el tipo existe
    const existing = await prisma.consumable_types.findUnique({
      where: { id: typeId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de consumible no encontrado' }, { status: 404 })
    }

    // Si se cambia el código, verificar que no exista otro con el mismo código
    if (validation.data.code && validation.data.code !== existing.code) {
      const duplicate = await prisma.consumable_types.findUnique({
        where: { code: validation.data.code },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de consumible con ese código' },
          { status: 409 }
        )
      }
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

    // Actualizar
    const consumableType = await prisma.consumable_types.update({
      where: { id: typeId },
      data: validation.data,
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

    return NextResponse.json({ type: consumableType })
  } catch (error) {
    console.error('Error actualizando tipo de consumible:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de consumible' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar tipo de consumible
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { typeId } = await params

    // Verificar que el tipo existe
    const existing = await prisma.consumable_types.findUnique({
      where: { id: typeId },
      include: {
        _count: {
          select: {
            consumables: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de consumible no encontrado' }, { status: 404 })
    }

    // Verificar si tiene consumibles asignados
    if (existing._count.consumables > 0) {
      // Soft delete - solo desactivar
      const consumableType = await prisma.consumable_types.update({
        where: { id: typeId },
        data: { isActive: false },
      })

      return NextResponse.json({
        success: true,
        message: `Tipo de consumible desactivado (tiene ${existing._count.consumables} consumibles asignados)`,
        type: consumableType,
      })
    } else {
      // Hard delete - eliminar completamente
      await prisma.consumable_types.delete({
        where: { id: typeId },
      })

      return NextResponse.json({
        success: true,
        message: 'Tipo de consumible eliminado',
      })
    }
  } catch (error) {
    console.error('Error eliminando tipo de consumible:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de consumible' }, { status: 500 })
  }
}
