/**
 * API: Individual License Type Management
 * GET /api/admin/inventory/license-types/[typeId]
 * PUT /api/admin/inventory/license-types/[typeId]
 * DELETE /api/admin/inventory/license-types/[typeId]
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

const licenseTypeUpdateSchema = z.object({
  code: z.string().min(2).max(50).optional(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  familyId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
})

/**
 * GET - Obtener tipo de licencia por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { typeId } = await params

    const licenseType = await prisma.license_types.findUnique({
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
            licenses: true,
            attributes: true,
          },
        },
      },
    })

    if (!licenseType) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, licenseType.familyId)
    if (denied) return denied

    return NextResponse.json({ licenseType })
  } catch (error) {
    console.error('Error obteniendo tipo de licencia:', error)
    return NextResponse.json({ error: 'Error al obtener tipo de licencia' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar tipo de licencia
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { typeId } = await params
    const body = await request.json()

    // Validar
    const validation = licenseTypeUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que el tipo existe
    const existing = await prisma.license_types.findUnique({
      where: { id: typeId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 404 })
    }

    const existingDenied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (existingDenied) return existingDenied

    if (validation.data.familyId !== undefined) {
      const targetDenied = assertFamilyInManageScope(access.auth, validation.data.familyId)
      if (targetDenied) return targetDenied
    }

    // Si se cambia el código, verificar que no exista otro con el mismo código
    if (validation.data.code && validation.data.code !== existing.code) {
      const duplicate = await prisma.license_types.findUnique({
        where: { code: validation.data.code },
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un tipo de licencia con ese código' },
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
    const licenseType = await prisma.license_types.update({
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

    return NextResponse.json({ type: licenseType })
  } catch (error) {
    console.error('Error actualizando tipo de licencia:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de licencia' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar tipo de licencia
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { typeId } = await params

    // Verificar que el tipo existe
    const existing = await prisma.license_types.findUnique({
      where: { id: typeId },
      include: {
        _count: {
          select: {
            licenses: true,
          },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 404 })
    }

    const denied = assertFamilyInManageScope(access.auth, existing.familyId)
    if (denied) return denied

    // Verificar si tiene licencias asignadas
    if (existing._count.licenses > 0) {
      // Soft delete - solo desactivar
      const licenseType = await prisma.license_types.update({
        where: { id: typeId },
        data: { isActive: false },
      })

      return NextResponse.json({
        success: true,
        message: `Tipo de licencia desactivado (tiene ${existing._count.licenses} licencias asignadas)`,
        type: licenseType,
      })
    } else {
      // Hard delete - eliminar completamente
      await prisma.license_types.delete({
        where: { id: typeId },
      })

      return NextResponse.json({
        success: true,
        message: 'Tipo de licencia eliminado',
      })
    }
  } catch (error) {
    console.error('Error eliminando tipo de licencia:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de licencia' }, { status: 500 })
  }
}
