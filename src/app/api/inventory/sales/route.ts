import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/sales
 * Lista solicitudes de venta — admin, super admin o gestor con scope de familia
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ctx = await getInventorySessionContext(session.user)
  if (!hasInventoryModuleAccess(ctx)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? undefined
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = status ? { status } : {}

  const { scope } = ctx
  if (scope.familyIds && scope.familyIds.length > 0) {
    where.equipment = { type: { familyId: { in: scope.familyIds } } }
  } else if (scope.noAccess) {
    return NextResponse.json({ sales: [], total: 0, page, limit, totalPages: 0 })
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
 * Crea una solicitud de venta — admin, super admin o gestor en scope de familia del equipo
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ctx = await getInventorySessionContext(session.user)
  if (!hasInventoryModuleAccess(ctx)) {
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

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      code: true,
      status: true,
      sale: true,
      acquisitionMode: true,
      ownershipType: true,
      type: { select: { familyId: true } },
    },
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

  // No se puede vender un equipo que no es propiedad de la compañía (arriendo
  // o préstamo de terceros). Primero debe adquirirse — ver
  // POST /api/inventory/equipment/[id]/convert-to-purchase — y solo entonces,
  // si no está asignado, puede ponerse a la venta.
  const ownership = equipment.acquisitionMode ?? equipment.ownershipType
  if (ownership !== 'FIXED_ASSET') {
    return NextResponse.json(
      {
        error:
          'Este equipo está en arriendo/préstamo y no es propiedad de la compañía. Primero debe registrarse su compra al arrendador (convertir a activo propio) antes de poder venderse.',
        code: 'NOT_OWNED_ASSET',
      },
      { status: 422 }
    )
  }

  // Igual que en decommission-acts: no se puede vender un equipo con
  // asignación activa — primero debe registrarse su devolución. Sin este
  // chequeo, aprobar la venta lo marca SOLD mientras equipment_assignments
  // sigue mostrándolo como asignado a un empleado (estado contradictorio).
  const activeAssignment = await prisma.equipment_assignments.findFirst({
    where: { equipmentId, isActive: true },
  })
  if (activeAssignment) {
    return NextResponse.json(
      {
        error:
          'No se puede vender un equipo que está asignado. Primero debe registrar su devolución.',
      },
      { status: 422 }
    )
  }

  try {
    await assertInventoryManageByFamily(ctx.user, equipment.type?.familyId)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
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
