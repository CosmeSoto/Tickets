import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'
import { buildEquipmentFamilyWhere } from '@/lib/inventory/scope-filter'

/**
 * GET /api/inventory/equipment
 * Listado simple de equipos, con scope por familia. Usado por el dashboard de
 * clientes ("mis equipos asignados") y selectores rápidos (ej. diálogo de
 * mantenimiento). Para el listado unificado paginado (equipos + MRO +
 * licencias) usar /api/inventory/assets.
 *
 * Nota: este archivo solo expone GET — la creación de equipos pasa por
 * POST /api/inventory/assets (ver assets-create.ts), no por aquí.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') ?? undefined
    const familyIdParam = searchParams.get('familyId') ?? undefined
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

    const userId = session.user.id
    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const andConditions: Record<string, any>[] = []

    if (role === 'CLIENT') {
      const assignments = await prisma.equipment_assignments.findMany({
        where: { receiverId: userId, isActive: true },
        select: { equipmentId: true },
      })
      const ids = assignments.map(a => a.equipmentId)
      if (ids.length === 0) {
        return NextResponse.json({ total: 0, equipment: [] })
      }
      andConditions.push({ id: { in: ids } })
    } else {
      const ctx = await getInventorySessionContext({ id: userId, role, isSuperAdmin })
      if (!hasInventoryModuleAccess(ctx)) {
        return NextResponse.json({ total: 0, equipment: [] })
      }
      const scopeWhere = buildEquipmentFamilyWhere(ctx.scope.familyIds)
      if (Object.keys(scopeWhere).length > 0) andConditions.push(scopeWhere)
    }

    if (status) andConditions.push({ status })
    if (familyIdParam) andConditions.push({ type: { familyId: familyIdParam } })

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

    const [total, items] = await Promise.all([
      prisma.equipment.count({ where }),
      prisma.equipment.findMany({
        where,
        include: {
          model: { select: { brand: true, model: true } },
          type: { select: { family: { select: { name: true } } } },
          assignments: {
            where: { isActive: true },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: { startDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    const equipment = items.map(eq => ({
      id: eq.id,
      code: eq.code,
      brand: eq.model?.brand?.name ?? eq.brand ?? '',
      model: eq.model?.model ?? eq.modelDeprecated ?? '',
      familyName: eq.type?.family?.name ?? '',
      assignedAt: eq.assignments[0]?.startDate?.toISOString() ?? null,
    }))

    return NextResponse.json({ total, equipment })
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment:', error)
    return NextResponse.json({ error: 'Error al obtener equipos' }, { status: 500 })
  }
}
