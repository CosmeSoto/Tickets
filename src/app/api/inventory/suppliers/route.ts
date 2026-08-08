import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { sanitizeSupplierPayload } from '@/lib/validations/inventory/supplier'
import {
  buildSupplierAuditSnapshot,
  supplierAuditMessage,
} from '@/lib/inventory/supplier-audit'
import { buildSupplierCommercialSummary } from '@/lib/inventory/supplier-commercial'
import { notifySupplierLifecycle } from '@/lib/inventory/notifications'
import { ZodError } from 'zod'

const supplierListInclude = {
  supplierType: { select: { id: true, name: true } },
  family: { select: { id: true, name: true, color: true } },
  _count: { select: { maintenances: true, contracts: true } },
} as const

async function enrichSuppliersWithCommercial<
  T extends { id: string; creditLimit: unknown; creditCurrency: string | null },
>(suppliers: T[]) {
  const supplierIds = suppliers.map(s => s.id)
  const openContracts =
    supplierIds.length === 0
      ? []
      : await prisma.contracts.findMany({
          where: {
            supplierId: { in: supplierIds },
            status: { in: ['ACTIVE', 'EXPIRING'] },
          },
          select: {
            supplierId: true,
            monthlyCost: true,
            totalValue: true,
            billingCycle: true,
            currency: true,
            status: true,
          },
        })

  const contractsBySupplier = new Map<string, typeof openContracts>()
  for (const row of openContracts) {
    if (!row.supplierId) continue
    const list = contractsBySupplier.get(row.supplierId) ?? []
    list.push(row)
    contractsBySupplier.set(row.supplierId, list)
  }

  return suppliers.map(s => ({
    ...s,
    commercialSummary: buildSupplierCommercialSummary({
      contracts: contractsBySupplier.get(s.id) ?? [],
      creditLimit: s.creditLimit,
      creditCurrency: s.creditCurrency,
    }),
  }))
}

/**
 * GET /api/inventory/suppliers
 * Lista proveedores. Filtros: ?active=, ?search=, ?familyId=, ?creditRef=high|ok
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const searchParams = request.nextUrl.searchParams
    const activeParam = searchParams.get('active')
    const search = searchParams.get('search') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const creditRef = searchParams.get('creditRef')

    const where: Record<string, unknown> = {}

    if (activeParam !== null && activeParam !== undefined) {
      where.isActive = activeParam === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (familyId) {
      const familyFilter = { OR: [{ familyId }, { familyId: null }] }
      where.AND = [familyFilter]
    } else {
      const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
      const invCtx = await getInventorySessionContext(session.user)
      const isSuperAdmin = (session.user as any).isSuperAdmin === true

      if (!isSuperAdmin && invCtx.scope.familyIds !== undefined) {
        const { buildInventoryFamilyWhere } = await import('@/lib/inventory/scope-filter')
        const familyFilter = buildInventoryFamilyWhere(invCtx.scope.familyIds, true)
        if (Object.keys(familyFilter).length > 0) {
          where.AND = [...((where.AND as any[]) ?? []), familyFilter]
        }
      }
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const skip = (page - 1) * limit

    if (creditRef === 'high' || creditRef === 'ok') {
      const candidates = await prisma.suppliers.findMany({
        where,
        include: supplierListInclude,
        orderBy: { name: 'asc' },
        take: 500,
      })
      const enriched = await enrichSuppliersWithCommercial(candidates)
      const filtered = enriched.filter(s => s.commercialSummary.referenceStatus === creditRef)
      const total = filtered.length
      return NextResponse.json({
        suppliers: filtered.slice(skip, skip + limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
        },
      })
    }

    const [suppliers, total] = await Promise.all([
      prisma.suppliers.findMany({
        where,
        include: supplierListInclude,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.suppliers.count({ where }),
    ])

    const enriched = await enrichSuppliersWithCommercial(suppliers)

    return NextResponse.json({
      suppliers: enriched,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    })
  } catch (error) {
    console.error('[GET /api/inventory/suppliers]', error)
    return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/suppliers
 * Crea un nuevo proveedor
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const body = await request.json()
    const data = sanitizeSupplierPayload(body)

    if (data.taxId) {
      const existing = await prisma.suppliers.findUnique({ where: { taxId: data.taxId } })
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un proveedor con ese RUC/NIT' },
          { status: 409 }
        )
      }
    }

    const supplier = await prisma.suppliers.create({ data })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CREATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: supplierAuditMessage('CREATE', supplier.name, session.user.email),
          ...buildSupplierAuditSnapshot(supplier),
        },
      },
    })

    notifySupplierLifecycle({
      familyId: supplier.familyId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      event: 'created',
      actorName: session.user.email,
    }).catch(err => console.error('[NOTIFICATION] supplier lifecycle:', err))

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.errors[0]
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos', field: first?.path?.join('.'), details: error.errors },
        { status: 422 }
      )
    }
    console.error('[POST /api/inventory/suppliers]', error)
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
  }
}
