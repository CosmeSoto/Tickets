import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  assertCatalogEntryWrite,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

// Catálogo global (sin familyId) de bancos/entidades financieras — alimenta el
// selector reutilizable del campo "Banco / Entidad". No es FK de nada: los
// campos que lo usan (equipment_invoices.bankEntity, suppliers.bankName)
// siguen guardando el nombre como texto libre.

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await requireInventoryCatalogRead(session.user)

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
    const isAdmin = session.user.role === 'ADMIN' || (session.user as any).isSuperAdmin === true

    const banks = await prisma.bank_entities.findMany({
      where: isAdmin && includeInactive ? {} : { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(banks)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al obtener bancos/entidades' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const user = toInventoryAccessUser(session.user)
    await assertCatalogEntryWrite(user, null)

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const existing = await prisma.bank_entities.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un banco/entidad con ese nombre' },
        { status: 409 }
      )
    }

    const maxOrder = await prisma.bank_entities.aggregate({ _max: { order: true } })

    const bank = await prisma.bank_entities.create({
      data: {
        id: randomUUID(),
        name,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    })
    return NextResponse.json(bank, { status: 201 })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al crear banco/entidad' }, { status: 500 })
  }
}
