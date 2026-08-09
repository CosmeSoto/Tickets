import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.contract_service_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const type = await prisma.contract_service_types.update({
      where: { id },
      data: {
        name,
        description:
          body.description !== undefined
            ? typeof body.description === 'string'
              ? body.description.trim() || null
              : null
            : existing.description,
        ...(typeof body.order === 'number' ? { order: body.order } : {}),
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      },
    })

    return NextResponse.json(type)
  } catch (error) {
    console.error('PUT contract-service-types:', error)
    return NextResponse.json({ error: 'Error al actualizar tipo de servicio' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.contract_service_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
    }

    const inUse = await prisma.contracts.count({
      where: { serviceSubtype: existing.code },
    })

    if (inUse > 0) {
      await prisma.contract_service_types.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        message: 'Desactivado (hay contratos que usan este tipo)',
        softDeleted: true,
      })
    }

    await prisma.contract_service_types.delete({ where: { id } })
    return NextResponse.json({ message: 'Eliminado' })
  } catch (error) {
    console.error('DELETE contract-service-types:', error)
    return NextResponse.json({ error: 'Error al eliminar tipo de servicio' }, { status: 500 })
  }
}
