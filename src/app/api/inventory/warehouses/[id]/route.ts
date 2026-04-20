import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/warehouses/[id]
 * Retorna el detalle de una bodega.
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

    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!warehouse) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ warehouse })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener la bodega' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/warehouses/[id]
 * Edita una bodega.
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
        { error: 'Solo el administrador puede gestionar bodegas' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.warehouses.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { name, location, description, managerId, familyId } = body

    if (managerId !== undefined && managerId !== null) {
      const managerExists = await prisma.users.findUnique({ where: { id: managerId } })
      if (!managerExists) {
        return NextResponse.json(
          { error: 'El usuario gestor especificado no existe' },
          { status: 400 }
        )
      }
    }

    const warehouse = await (prisma.warehouses.update as any)({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(location !== undefined && { location }),
        ...(description !== undefined && { description }),
        ...(managerId !== undefined && { managerId }),
        ...('familyId' in body && { familyId: familyId ?? null }),
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, color: true } },
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE',
        entityType: 'warehouse',
        entityId: warehouse.id,
        userId: session.user.id,
        details: { name: warehouse.name },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ warehouse })
  } catch {
    return NextResponse.json(
      { error: 'Error al editar la bodega' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/inventory/warehouses/[id]
 * Alterna el estado activo/inactivo de una bodega.
 * Restricción: no se puede desactivar si tiene equipos o consumibles activos.
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
        { error: 'Solo el administrador puede gestionar bodegas' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        _count: { select: { equipment: true, consumables: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Bodega no encontrada' }, { status: 404 })
    }

    // Si se intenta desactivar, verificar que no tenga activos
    if (existing.isActive) {
      const total = existing._count.equipment + existing._count.consumables
      if (total > 0) {
        return NextResponse.json(
          { error: `No se puede desactivar: la bodega tiene ${total} activo(s) almacenado(s). Reasígnalos primero.` },
          { status: 409 }
        )
      }
    }

    const warehouse = await prisma.warehouses.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'TOGGLE',
        entityType: 'warehouse',
        entityId: warehouse.id,
        userId: session.user.id,
        details: { isActive: warehouse.isActive },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ warehouse })
  } catch {
    return NextResponse.json(
      { error: 'Error al cambiar el estado de la bodega' },
      { status: 500 }
    )
  }
}
