/**
 * API: Individual Equipment Type Management
 * GET /api/admin/inventory/equipment-types/[typeId]
 * PUT /api/admin/inventory/equipment-types/[typeId]
 * DELETE /api/admin/inventory/equipment-types/[typeId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const equipmentTypeUpdateSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  familyId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

/**
 * GET - Obtener tipo de equipo por ID
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

    const equipmentType = await prisma.equipment_types.findUnique({
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
            equipment: true,
            attributes: true,
          },
        },
      },
    })

    if (!equipmentType) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ equipmentType })
  } catch (error) {
    console.error('Error obteniendo tipo de equipo:', error)
    return NextResponse.json({ error: 'Error al obtener tipo de equipo' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar tipo de equipo
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
    const validation = equipmentTypeUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que el tipo existe
    const existing = await prisma.equipment_types.findUnique({
      where: { id: typeId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    // Si se cambia el código, verificar que no exista otro con el mismo código
    if (validation.data.code && validation.data.code !== existing.code) {
      const duplicate = await prisma.equipment_types.findUnique({
        where: { code: validation.data.code },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de equipo con ese código' },
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
    const equipmentType = await prisma.equipment_types.update({
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

    return NextResponse.json({ equipmentType })
  } catch (error) {
    console.error('Error actualizando tipo de equipo:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de equipo' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar tipo de equipo
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
    const existing = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      include: {
        _count: {
          select: {
            equipment: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    // Verificar si tiene equipos asignados
    if (existing._count.equipment > 0) {
      // Soft delete - solo desactivar
      const equipmentType = await prisma.equipment_types.update({
        where: { id: typeId },
        data: { isActive: false },
      })

      return NextResponse.json({
        success: true,
        message: `Tipo de equipo desactivado (tiene ${existing._count.equipment} equipos asignados)`,
        equipmentType,
      })
    } else {
      // Hard delete - eliminar completamente
      await prisma.equipment_types.delete({
        where: { id: typeId },
      })

      return NextResponse.json({
        success: true,
        message: 'Tipo de equipo eliminado',
      })
    }
  } catch (error) {
    console.error('Error eliminando tipo de equipo:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de equipo' }, { status: 500 })
  }
}
