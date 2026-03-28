import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/families/[id]
 * Retorna el detalle de una familia con sus tipos activos relacionados.
 * Requiere sesión activa con canManageInventory o rol ADMIN.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isManager = await canManageInventory(user.id, user.role)

    if (!isAdmin && !isManager) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder al inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const family = await prisma.inventory_families.findUnique({
      where: { id },
      include: {
        equipmentTypes: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        consumableTypes: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        licenseTypes: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ family })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener la familia' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/families/[id]
 * Edita una familia de inventario.
 * Solo ADMIN.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.inventory_families.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { name, icon, color, order, description } = body

    const family = await prisma.inventory_families.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(order !== undefined && { order }),
        ...(description !== undefined && { description }),
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE',
        entityType: 'inventory_family',
        entityId: family.id,
        userId: session.user.id,
        details: { name: family.name },
      },
    }).catch(err => console.warn('[audit] families PUT:', err?.message))

    return NextResponse.json({ family })
  } catch (err) {
    console.error('[PUT /api/inventory/families/[id]]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al editar la familia' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/inventory/families/[id]
 * Alterna el estado activo/inactivo de una familia.
 * Solo ADMIN.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.inventory_families.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const family = await prisma.inventory_families.update({
      where: { id },
      data: { isActive: !existing.isActive },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'TOGGLE',
        entityType: 'inventory_family',
        entityId: family.id,
        userId: session.user.id,
        details: { isActive: family.isActive },
      },
    }).catch(err => console.warn('[audit] families PATCH:', err?.message))

    return NextResponse.json({ family })
  } catch {
    return NextResponse.json(
      { error: 'Error al cambiar el estado de la familia' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/families/[id]
 * Elimina una familia si no tiene tipos de activo asignados.
 * Solo ADMIN.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.inventory_families.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const [equipmentCount, consumableCount, licenseCount] = await Promise.all([
      prisma.equipment_types.count({ where: { familyId: id } }),
      prisma.consumable_types.count({ where: { familyId: id } }),
      prisma.license_types.count({ where: { familyId: id } }),
    ])

    if (equipmentCount + consumableCount + licenseCount > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar la familia porque tiene tipos de activo asignados. Desactívela en su lugar.',
        },
        { status: 409 }
      )
    }

    await prisma.inventory_families.delete({ where: { id } })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DELETE',
        entityType: 'inventory_family',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name },
      },
    }).catch(err => console.warn('[audit] families DELETE:', err?.message))

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { error: 'Error al eliminar la familia' },
      { status: 500 }
    )
  }
}
