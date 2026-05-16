import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/sales
 * Lista todas las solicitudes de venta — solo ADMIN y SUPER_ADMIN
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const role = session.user.role
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (role !== 'ADMIN' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: any = status ? { status: status as any } : {}

  // Admin Normal: filtrar ventas por scope de inventario (a través de equipment.type.familyId)
  if (role === 'ADMIN' && !isSuperAdmin) {
    const { getInventoryScope } = await import('@/lib/inventory/scope-filter')
    const scope = await getInventoryScope(
      session.user.id,
      role,
      false,
      (session.user as any).canManageInventory === true
    )
    if (scope.familyIds && scope.familyIds.length > 0) {
      where.equipment = { type: { familyId: { in: scope.familyIds } } }
    } else if (scope.noAccess) {
      return NextResponse.json({ sales: [], total: 0, page, limit, totalPages: 0 })
    }
  }

  const [sales, total] = await Promise.all([
    prisma.equipment_sales.findMany({
      where,
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            brand: true,
            model: true,
            serialNumber: true,
            purchasePrice: true,
            purchaseDate: true,
            usefulLifeYears: true,
            residualValue: true,
            type: { select: { name: true } },
          },
        },
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.equipment_sales.count({ where }),
  ])

  return NextResponse.json({ sales, total, page, limit })
}

/**
 * POST /api/inventory/sales
 * Crea una solicitud de venta — solo ADMIN y SUPER_ADMIN
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const role = session.user.role
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (role !== 'ADMIN' && !isSuperAdmin) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const body = await req.json()
  const {
    equipmentId,
    buyerName,
    buyerCompany,
    buyerIdNumber,
    salePrice,
    saleDate,
    invoiceNumber,
    paymentMethod,
    accessories,
    notes,
  } = body

  if (!equipmentId || !buyerName || !salePrice || !saleDate) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  // Verificar que el equipo existe y no está ya vendido
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, code: true, status: true, sale: true },
  })

  if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
  if (equipment.status === 'SOLD') {
    return NextResponse.json({ error: 'Este equipo ya fue vendido' }, { status: 409 })
  }
  if (equipment.sale) {
    return NextResponse.json(
      { error: 'Ya existe una solicitud de venta para este equipo' },
      { status: 409 }
    )
  }

  const sale = await prisma.equipment_sales.create({
    data: {
      id: randomUUID(),
      equipmentId,
      requestedById: session.user.id,
      buyerName,
      buyerCompany: buyerCompany || null,
      buyerIdNumber: buyerIdNumber || null,
      salePrice: parseFloat(salePrice),
      saleDate: new Date(saleDate),
      invoiceNumber: invoiceNumber || null,
      paymentMethod: paymentMethod || null,
      accessories: accessories ?? [],
      notes: notes || null,
      status: 'PENDING',
    },
    include: {
      equipment: { select: { code: true, brand: true, model: true } },
      requestedBy: { select: { name: true } },
    },
  })

  // Audit log
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_SALE_REQUESTED',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      details: { descripcion: `Solicitud de venta creada para ${equipment.code}`, saleId: sale.id },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(sale, { status: 201 })
}
