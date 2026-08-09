/**
 * GET  /api/admin/inventory/brands?familyId=  — catálogo por área (configuración)
 * POST /api/admin/inventory/brands             — crear marca
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBrand,
  listBrandsForFamily,
  type CreateBrandInput,
} from '@/lib/services/equipment-brands.service'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import { z } from 'zod'

const brandSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const familyId = request.nextUrl.searchParams.get('familyId')
    if (!familyId) {
      return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })
    }

    const denied = assertFamilyInManageScope(access.auth, familyId)
    if (denied) return denied

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const brands = await listBrandsForFamily(familyId, includeInactive)
    return NextResponse.json({ brands })
  } catch (error) {
    console.error('[GET /api/admin/inventory/brands]', error)
    return NextResponse.json({ error: 'Error al obtener marcas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const body = await request.json()
    const validation = brandSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const denied = assertFamilyInManageScope(access.auth, validation.data.familyId)
    if (denied) return denied

    const brand = await createBrand(validation.data as CreateBrandInput)
    return NextResponse.json(brand, { status: 201 })
  } catch (error: unknown) {
    console.error('[POST /api/admin/inventory/brands]', error)
    const message = error instanceof Error ? error.message : 'Error al crear marca'
    const status = message.includes('Ya existe') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
