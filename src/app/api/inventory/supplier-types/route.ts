import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  assertCatalogEntryWrite,
  buildCatalogFamilyWhere,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const ctx = await requireInventoryCatalogRead(session.user)

    const familyId = request.nextUrl.searchParams.get('familyId') ?? undefined
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const isAdmin = session.user.role === 'ADMIN'

    const familyFilter = buildCatalogFamilyWhere(ctx, familyId, true)

    const types = await (prisma as any).supplier_types.findMany({
      where: {
        ...(isAdmin && includeInactive ? {} : { isActive: true }),
        ...familyFilter,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(types)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al obtener tipos de proveedor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const user = toInventoryAccessUser(session.user)
    const body = await request.json()
    const { code, name, description, familyId, order } = body

    await assertCatalogEntryWrite(user, familyId ?? null)

    if (!code || !name) {
      return NextResponse.json({ error: 'Código y nombre son obligatorios' }, { status: 400 })
    }

    const existing = await (prisma as any).supplier_types.findUnique({
      where: { code: code.toUpperCase() },
    })
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un tipo con ese código' }, { status: 409 })
    }

    const type = await (prisma as any).supplier_types.create({
      data: {
        id: randomUUID(),
        code: code.toUpperCase(),
        name,
        description: description || null,
        familyId: familyId || null,
        order: order ?? 999,
      },
    })
    return NextResponse.json(type, { status: 201 })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al crear tipo de proveedor' }, { status: 500 })
  }
}
