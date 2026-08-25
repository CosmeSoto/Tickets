import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/warehouses
 * Lista bodegas.
 * ?familyId=  → filtra estrictamente por familia (las bodegas son exclusivas por familia)
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

    const includeInactive =
      isAdmin && request.nextUrl.searchParams.get('includeInactive') === 'true'
    const familyId = request.nextUrl.searchParams.get('familyId') ?? undefined

    // Determinar filtro de familia
    // Las bodegas son exclusivas por familia — nunca se comparten entre familias.
    // Bodegas con familyId=null se consideran huérfanas y solo son visibles para SuperAdmin.
    let familyFilter: Record<string, any> = {}
    if (familyId) {
      // Filtro estricto: solo bodegas de la familia solicitada
      familyFilter = { familyId }
    } else if (isAdmin && !(user as any).isSuperAdmin) {
      // Admin Normal sin familyId explícito: aplicar scope de inventario sin incluir globales
      const { buildInventoryFamilyWhere } = await import('@/lib/inventory/scope-filter')
      const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
      const scope = (await getInventorySessionContext(user)).scope
      familyFilter = buildInventoryFamilyWhere(scope.familyIds, false) // includeGlobal=false: no mezclar bodegas entre familias
    }

    const warehouses = await (prisma.warehouses.findMany as any)({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...familyFilter,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, color: true, icon: true } },
      },
      orderBy: [{ familyId: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ warehouses })
  } catch {
    return NextResponse.json({ error: 'Error al obtener bodegas' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/warehouses
 * Crea una nueva bodega. ADMIN o gestor con canManageInventory.
 * familyId es REQUERIDO — las bodegas siempre deben pertenecer a una familia.
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

    if (!name?.trim())
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

    // Las bodegas deben pertenecer a una familia — no se admiten bodegas globales
    if (!familyId?.trim())
      return NextResponse.json(
        { error: 'La familia (familyId) es requerida para crear una bodega' },
        { status: 400 }
      )

    // Verificar que la familia existe
    const family = await prisma.families.findUnique({ where: { id: familyId } })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    // Un gestor con acceso a una sola familia no debe poder crear bodegas en
    // familias que no gestiona (mismo criterio que el resto del módulo).
    try {
      await assertInventoryManageByFamily(toInventoryAccessUser(session.user), familyId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const maxOrder = await prisma.warehouses.aggregate({
      where: { familyId },
      _max: { order: true },
    })

    const warehouse = await (prisma.warehouses.create as any)({
      data: {
        id: randomUUID(),
        name: name.trim(),
        location: location ?? null,
        description: description ?? null,
        managerId: managerId ?? null,
        familyId: familyId,
        order: (maxOrder._max.order ?? -1) + 1,
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
