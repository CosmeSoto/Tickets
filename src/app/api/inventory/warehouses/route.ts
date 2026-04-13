import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/warehouses
 * Lista bodegas.
 * ?familyId=  → filtra por familia (incluye bodegas sin familia = compartidas)
 * ?includeInactive=true → incluye inactivas (solo ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isManager = await canManageInventory(user.id, user.role)

    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const includeInactive = isAdmin && request.nextUrl.searchParams.get('includeInactive') === 'true'
    const familyId = request.nextUrl.searchParams.get('familyId') ?? undefined

    const warehouses = await prisma.warehouses.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        // Si se filtra por familia: mostrar bodegas de esa familia + bodegas compartidas (sin familia)
        ...(familyId ? { OR: [{ familyId }, { familyId: null }] } : {}),
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: [{ familyId: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ warehouses })
  } catch {
    return NextResponse.json({ error: 'Error al obtener bodegas' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/warehouses
 * Crea una nueva bodega. ADMIN o gestor con canManageInventory.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const isAdmin = session.user.role === 'ADMIN'
    const isManager = await canManageInventory(session.user.id, session.user.role)
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Sin permiso para gestionar bodegas' }, { status: 403 })
    }

    const { name, location, description, managerId, familyId } = await request.json()

    if (!name?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    const warehouse = await prisma.warehouses.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        location: location ?? null,
        description: description ?? null,
        managerId: managerId ?? null,
        familyId: familyId ?? null,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, color: true, icon: true } },
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CREATE',
        entityType: 'warehouse',
        entityId: warehouse.id,
        userId: session.user.id,
        details: { name: warehouse.name, familyId: warehouse.familyId },
        createdAt: new Date(),
      },
    })

    return NextResponse.json(warehouse, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear la bodega' }, { status: 500 })
  }
}
