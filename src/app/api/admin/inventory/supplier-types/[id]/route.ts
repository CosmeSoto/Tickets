/**
 * API: Individual Supplier Type Management
 * GET /api/admin/inventory/supplier-types/[id]
 * PUT /api/admin/inventory/supplier-types/[id]
 * DELETE /api/admin/inventory/supplier-types/[id]
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

const supplierTypeUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  familyId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
})

/**
 * GET - Obtener tipo de proveedor por ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { id } = await params

    const supplierType = await prisma.supplier_types.findUnique({
      where: { id },
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
    })

    if (!supplierType) {
      return NextResponse.json({ error: 'Tipo de proveedor no encontrado' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, supplierType.familyId)
    if (denied) return denied

    return NextResponse.json({ supplierType })
  } catch (error) {
    console.error('Error obteniendo tipo de proveedor:', error)
    return NextResponse.json({ error: 'Error al obtener tipo de proveedor' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar tipo de proveedor
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { id } = await params
    const body = await request.json()

    // Validar
    const validation = supplierTypeUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que el tipo existe
    const existing = await prisma.supplier_types.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de proveedor no encontrado' }, { status: 404 })
    }

    const existingDenied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (existingDenied) return existingDenied

    if (validation.data.familyId !== undefined) {
      const targetDenied = assertFamilyInManageScope(access.auth, validation.data.familyId)
      if (targetDenied) return targetDenied
    }

    // Si se cambia el nombre, verificar que no exista otro con el mismo nombre en el mismo scope
    if (validation.data.name && validation.data.name !== existing.name) {
      const duplicate = await prisma.supplier_types.findFirst({
        where: {
          name: validation.data.name,
          familyId:
            validation.data.familyId !== undefined ? validation.data.familyId : existing.familyId,
          id: { not: id },
        },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de proveedor con ese nombre en este scope' },
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
    const supplierType = await prisma.supplier_types.update({
      where: { id },
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

    return NextResponse.json({ supplierType })
  } catch (error) {
    console.error('Error actualizando tipo de proveedor:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de proveedor' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar tipo de proveedor
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

    // Verificar que el tipo existe
    const existing = await prisma.supplier_types.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            suppliers: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de proveedor no encontrado' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (denied) return denied

    // Verificar si tiene proveedores asignados
    if (existing._count.suppliers > 0) {
      // Soft delete - solo desactivar
      const supplierType = await prisma.supplier_types.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json({
        success: true,
        message: `Tipo de proveedor desactivado (tiene ${existing._count.suppliers} proveedores asignados)`,
        supplierType,
      })
    } else {
      // Hard delete - eliminar completamente
      await prisma.supplier_types.delete({
        where: { id },
      })

      return NextResponse.json({
        success: true,
        message: 'Tipo de proveedor eliminado',
      })
    }
  } catch (error) {
    console.error('Error eliminando tipo de proveedor:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de proveedor' }, { status: 500 })
  }
}
