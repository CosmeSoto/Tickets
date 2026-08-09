/**
 * API: Warehouses by Family
 * GET /api/admin/inventory/families/[familyId]/warehouses
 * POST /api/admin/inventory/families/[familyId]/warehouses
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

const warehouseSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  location: z.string().max(200).optional(),
  description: z.string().optional(),
  managerId: z.string().uuid('ID de manager inválido').optional(),
  isActive: z.boolean().default(true),
})

/**
 * GET - Obtener bodegas de una familia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { familyId } = await params
    const denied = assertFamilyInManageScope(access.auth, familyId)
    if (denied) return denied

    const warehouses = await prisma.warehouses.findMany({
      where: { familyId },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            equipment: true,
            consumables: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ warehouses })
  } catch (error) {
    console.error('Error obteniendo bodegas:', error)
    return NextResponse.json({ error: 'Error al obtener bodegas' }, { status: 500 })
  }
}

/**
 * POST - Crear bodega para una familia
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { familyId } = await params
    const denied = assertFamilyInManageScope(access.auth, familyId)
    if (denied) return denied

    const body = await request.json()

    // Validar
    const validation = warehouseSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar que la familia existe
    const family = await prisma.families.findUnique({
      where: { id: familyId },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

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

    // Crear bodega al final del orden actual del área
    const maxOrder = await prisma.warehouses.aggregate({
      where: { familyId },
      _max: { order: true },
    })

    const warehouse = await prisma.warehouses.create({
      data: {
        name: validation.data.name,
        location: validation.data.location || null,
        description: validation.data.description || null,
        managerId: validation.data.managerId || null,
        familyId,
        isActive: validation.data.isActive,
        order: (maxOrder._max.order ?? -1) + 1,
      },
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

    return NextResponse.json({ warehouse }, { status: 201 })
  } catch (error) {
    console.error('Error creando bodega:', error)
    return NextResponse.json({ error: 'Error al crear bodega' }, { status: 500 })
  }
}
