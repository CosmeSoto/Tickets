/**
 * API: Individual Warehouse Management
 * GET /api/admin/inventory/warehouses/[id]
 * PUT /api/admin/inventory/warehouses/[id]
 * DELETE /api/admin/inventory/warehouses/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import { z } from 'zod'

const warehouseUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  location: z.string().max(200).optional(),
  description: z.string().optional(),
  managerId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * GET - Obtener bodega por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { id } = await params

    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: {
            equipment: true,
            consumables: true,
            batches: true,
          },
        },
      },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, warehouse.familyId)
    if (denied) return denied

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('Error obteniendo bodega:', error)
    return NextResponse.json({ error: 'Error al obtener bodega' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar bodega
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { id } = await params
    const body = await request.json()

    // Validar
    const validation = warehouseUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que la bodega existe
    const existing = await prisma.warehouses.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (denied) return denied

    // Si se especifica manager, verificar que existe y tiene permisos
    if (validation.data.managerId) {
      const manager = await prisma.users.findUnique({
        where: { id: validation.data.managerId },
      })

      if (!manager) {
        return NextResponse.json({ error: 'Manager no encontrado' }, { status: 404 })
      }

      if (!manager.canManageInventory) {
        return NextResponse.json(
          { error: 'El usuario no tiene permisos para gestionar inventario' },
          { status: 400 }
        )
      }
    }

    // Actualizar
    const warehouse = await prisma.warehouses.update({
      where: { id },
      data: validation.data,
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({ warehouse })
  } catch (error) {
    console.error('Error actualizando bodega:', error)
    return NextResponse.json({ error: 'Error al actualizar bodega' }, { status: 500 })
  }
}

/**
 * DELETE - Desactivar bodega (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { id } = await params

    // Verificar que la bodega existe
    const existing = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            equipment: true,
            consumables: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (denied) return denied

    // Verificar si tiene items asignados
    const hasItems = existing._count.equipment > 0 || existing._count.consumables > 0

    if (hasItems) {
      // Soft delete - solo desactivar
      const warehouse = await prisma.warehouses.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json({
        success: true,
        message: 'Bodega desactivada (tiene items asignados)',
        warehouse,
      })
    } else {
      // Hard delete - eliminar completamente
      await prisma.warehouses.delete({
        where: { id },
      })

      return NextResponse.json({
        success: true,
        message: 'Bodega eliminada',
      })
    }
  } catch (error) {
    console.error('Error eliminando bodega:', error)
    return NextResponse.json({ error: 'Error al eliminar bodega' }, { status: 500 })
  }
}
