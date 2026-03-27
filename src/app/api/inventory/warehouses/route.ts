import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/warehouses
 * Lista bodegas.
 * - ADMIN: todas las activas (o todas si ?includeInactive=true)
 * - Gestor (canManageInventory): solo las activas
 */
export async function GET(request: NextRequest) {
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

    const includeInactive =
      isAdmin && request.nextUrl.searchParams.get('includeInactive') === 'true'

    const warehouses = await prisma.warehouses.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ warehouses })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener bodegas' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/warehouses
 * Crea una nueva bodega.
 * Solo ADMIN.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { name, location, description, managerId } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    if (managerId) {
      const managerExists = await prisma.users.findUnique({ where: { id: managerId } })
      if (!managerExists) {
        return NextResponse.json(
          { error: 'El usuario gestor especificado no existe' },
          { status: 400 }
        )
      }
    }

    const warehouse = await prisma.warehouses.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        location: location ?? null,
        description: description ?? null,
        managerId: managerId ?? null,
      },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CREATE',
        entityType: 'warehouse',
        entityId: warehouse.id,
        userId: session.user.id,
        details: { name: warehouse.name },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ warehouse }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Error al crear la bodega' },
      { status: 500 }
    )
  }
}
