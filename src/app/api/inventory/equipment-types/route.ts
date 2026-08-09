import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  assertCatalogEntryWrite,
  buildCatalogFamilyWhere,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/equipment-types
 * Retorna tipos de equipo activos.
 * Query params:
 *   - familyId: filtrar por familia (opcional)
 *   - includeInactive: incluir inactivos (solo ADMIN)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const ctx = await requireInventoryCatalogRead(session.user)
    const isAdmin = ctx.user.role === 'ADMIN'
    const { searchParams } = req.nextUrl
    const familyId = searchParams.get('familyId') ?? undefined
    const includeInactive = isAdmin && searchParams.get('includeInactive') === 'true'
    const familyFilter = buildCatalogFamilyWhere(ctx, familyId, true)

    const types = await prisma.equipment_types.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...familyFilter,
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        icon: true,
        familyId: true,
        isActive: true,
        order: true,
        // Campos de configuración
        trackMaintenance: true,
      },
    })

    return NextResponse.json({ types })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[GET /api/inventory/equipment-types]', err)
    return NextResponse.json({ error: 'Error al obtener tipos de equipo' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/equipment-types
 * Crea un tipo de equipo (ADMIN / gestores de catálogo)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const user = toInventoryAccessUser(session.user)
    const body = await request.json()
    const { code, name, description, icon, order, familyId } = body
    await assertCatalogEntryWrite(user, familyId ?? null)

    if (!code || !name) {
      return NextResponse.json({ error: 'Código y nombre son requeridos' }, { status: 400 })
    }

    const existing = await prisma.equipment_types.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo de equipo con este código' },
        { status: 400 }
      )
    }

    let nextOrder = order
    if (nextOrder == null) {
      const maxOrder = await prisma.equipment_types.aggregate({
        where: { familyId: familyId || null },
        _max: { order: true },
      })
      nextOrder = (maxOrder._max.order ?? -1) + 1
    }

    const newType = await prisma.equipment_types.create({
      data: {
        id: randomUUID(),
        code: code.toUpperCase(),
        name,
        description,
        icon,
        isActive: true,
        order: nextOrder,
        ...(familyId ? { familyId } : {}),
      },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_TYPE_CREATED,
      entityType: 'inventory',
      entityId: newType.id,
      userId: session.user.id,
      details: { code: newType.code, name: newType.name, description },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de tipo de equipo:', err))

    return NextResponse.json(newType, { status: 201 })
  } catch (error) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error en POST /api/inventory/equipment-types:', error)
    return NextResponse.json({ error: 'Error al crear tipo de equipo' }, { status: 500 })
  }
}
