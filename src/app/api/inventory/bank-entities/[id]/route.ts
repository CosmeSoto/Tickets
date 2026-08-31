import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCatalogEntryWrite,
  assertGlobalCatalogDelete,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const user = toInventoryAccessUser(session.user)
    await assertCatalogEntryWrite(user, null)

    const existing = await prisma.bank_entities.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Banco/entidad no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await prisma.bank_entities.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un banco/entidad con ese nombre' },
          { status: 409 }
        )
      }
    }

    const bank = await prisma.bank_entities.update({
      where: { id },
      data: {
        name,
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      },
    })
    return NextResponse.json(bank)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al actualizar banco/entidad' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    await requireInventoryCatalogRead(session.user)
    const user = toInventoryAccessUser(session.user)
    await assertGlobalCatalogDelete(user)

    const { id } = await params
    const existing = await prisma.bank_entities.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Banco/entidad no encontrado' }, { status: 404 })
    }

    // No es FK de nada (bankEntity/bankName son texto libre) — eliminación
    // directa, sin necesidad de revisar referencias.
    await prisma.bank_entities.delete({ where: { id } })
    return NextResponse.json({ message: 'Eliminado' })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al eliminar banco/entidad' }, { status: 500 })
  }
}
