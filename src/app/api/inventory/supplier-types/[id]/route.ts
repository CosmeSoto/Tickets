import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!await canManageInventory(session.user.id, session.user.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }
  const { id } = await params
  const { name, description, familyId, order } = await request.json()
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const type = await (prisma as any).supplier_types.update({
    where: { id },
    data: { name, description: description || null, familyId: familyId || null, order: order ?? 999 },
  })
  return NextResponse.json(type)
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Solo ADMIN' }, { status: 403 })

  const { id } = await params

  // Verificar si tiene proveedores asociados
  const count = await (prisma as any).suppliers.count({ where: { typeId: id } })
  if (count > 0) {
    // Desactivar en lugar de eliminar
    await (prisma as any).supplier_types.update({ where: { id }, data: { isActive: false } })
    return NextResponse.json({ message: 'Desactivado (tiene proveedores asociados)' })
  }

  await (prisma as any).supplier_types.delete({ where: { id } })
  return NextResponse.json({ message: 'Eliminado' })
}
