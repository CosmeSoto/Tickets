/**
 * GET /api/inventory/suppliers/evaluations
 * Vista global de calificaciones (equivalente a la tabla del Excel), con
 * filtros ?year=, ?classification=A|B|C, ?familyId=, ?search= (nombre del
 * proveedor). Respeta el mismo alcance por familia que /suppliers.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year')
    const classification = searchParams.get('classification')
    const familyId = searchParams.get('familyId') || undefined
    const search = searchParams.get('search') || undefined

    const supplierWhere: Record<string, unknown> = {}
    if (search) {
      supplierWhere.name = { contains: search, mode: 'insensitive' }
    }

    if (familyId) {
      supplierWhere.OR = [{ familyId }, { familyId: null }]
    } else {
      const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
      const isSuperAdmin = (session.user as any).isSuperAdmin === true
      const invCtx = await getInventorySessionContext(session.user)

      if (!isSuperAdmin && invCtx.scope.familyIds !== undefined) {
        const { buildInventoryFamilyWhere } = await import('@/lib/inventory/scope-filter')
        const familyFilter = buildInventoryFamilyWhere(invCtx.scope.familyIds, true)
        Object.assign(supplierWhere, familyFilter)
      }
    }

    const where: Record<string, unknown> = { supplier: supplierWhere }
    if (year) where.year = parseInt(year, 10)
    if (classification && ['A', 'B', 'C'].includes(classification)) {
      where.classification = classification
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const [evaluations, total] = await Promise.all([
      prisma.supplier_evaluations.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, email: true, contactName: true, phone: true },
          },
          evaluatedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ year: 'desc' }, { supplier: { name: 'asc' } }],
        skip,
        take: limit,
      }),
      prisma.supplier_evaluations.count({ where }),
    ])

    return NextResponse.json({
      evaluations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    })
  } catch (error) {
    console.error('[GET /api/inventory/suppliers/evaluations]', error)
    return NextResponse.json({ error: 'Error al obtener las calificaciones' }, { status: 500 })
  }
}
