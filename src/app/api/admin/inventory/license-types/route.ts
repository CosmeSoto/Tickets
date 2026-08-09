/**
 * API: License Types
 * GET /api/admin/inventory/license-types
 * POST /api/admin/inventory/license-types
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

const licenseTypeSchema = z.object({
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres').max(50),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  familyId: z.string().uuid('ID de familia inválido').optional().nullable(),
  isActive: z.boolean().default(true),
  order: z.number().int().min(0).optional(),
})

/**
 * GET - Obtener todos los tipos de licencia
 * Query params:
 * - familyId: filtrar por familia (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    const where: any = {}
    if (familyId) {
      const denied = assertFamilyInManageScope(access.auth, familyId)
      if (denied) return denied
      where.familyId = familyId
    } else if (access.auth.manageFamilyIds) {
      where.familyId = { in: access.auth.manageFamilyIds }
    }

    const licenseTypes = await prisma.license_types.findMany({
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
            licenses: true,
            attributes: true,
          },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ types: licenseTypes })
  } catch (error) {
    console.error('Error obteniendo tipos de licencia:', error)
    return NextResponse.json({ error: 'Error al obtener tipos de licencia' }, { status: 500 })
  }
}

/**
 * POST - Crear tipo de licencia
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const body = await request.json()

    // Validar
    const validation = licenseTypeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const denied = assertFamilyInManageScope(access.auth, validation.data.familyId)
    if (denied) return denied

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
    const existing = await prisma.license_types.findUnique({
      where: { code: validation.data.code },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de licencia con ese código' },
        { status: 409 }
      )
    }

    // Crear tipo de licencia
    let order = validation.data.order
    if (order == null) {
      const maxOrder = await prisma.license_types.aggregate({
        where: { familyId: validation.data.familyId || null },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const licenseType = await prisma.license_types.create({
      data: {
        code: validation.data.code,
        name: validation.data.name,
        description: validation.data.description || null,
        icon: validation.data.icon || null,
        familyId: validation.data.familyId || null,
        isActive: validation.data.isActive,
        order,
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

    return NextResponse.json({ type: licenseType }, { status: 201 })
  } catch (error) {
    console.error('Error creando tipo de licencia:', error)
    return NextResponse.json({ error: 'Error al crear tipo de licencia' }, { status: 500 })
  }
}
