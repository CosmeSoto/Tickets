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

    const existing = await (prisma as any).supplier_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
    }

    const { name, description, familyId, order } = await request.json()
    if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    await assertCatalogEntryWrite(user, existing.familyId)
    const targetFamilyId = familyId !== undefined ? familyId : existing.familyId
    if (targetFamilyId !== existing.familyId) {
      await assertCatalogEntryWrite(user, targetFamilyId ?? null)
    }

    const type = await (prisma as any).supplier_types.update({
      where: { id },
      data: {
        name,
        description: description || null,
        familyId: familyId !== undefined ? familyId || null : existing.familyId,
        ...(order !== undefined ? { order } : {}),
      },
    })
    return NextResponse.json(type)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al actualizar tipo de proveedor' }, { status: 500 })
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

    const count = await (prisma as any).suppliers.count({ where: { typeId: id } })
    if (count > 0) {
      await (prisma as any).supplier_types.update({ where: { id }, data: { isActive: false } })
      return NextResponse.json({ message: 'Desactivado (tiene proveedores asociados)' })
    }

    await (prisma as any).supplier_types.delete({ where: { id } })
    return NextResponse.json({ message: 'Eliminado' })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    return NextResponse.json({ error: 'Error al eliminar tipo de proveedor' }, { status: 500 })
  }
}
