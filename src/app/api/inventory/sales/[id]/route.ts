import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import {
  getInventorySessionContext,
  hasInventoryModuleAccess,
} from '@/lib/inventory/inventory-session'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/inventory/sales/[id]
 * Detalle de una venta — admin, super admin o gestor con scope de familia
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ctx = await getInventorySessionContext(session.user)
  if (!hasInventoryModuleAccess(ctx)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params

  try {
    await assertInventoryResourceRead(ctx.user, 'SALE', id)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const sale = await prisma.equipment_sales.findUnique({
    where: { id },
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
          depreciationMethod: true,
          condition: true,
          type: { select: { name: true } },
          department: { select: { name: true } },
        },
      },
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  })

  if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })

  return NextResponse.json(sale)
}

/**
 * PATCH /api/inventory/sales/[id]
 * Aprobar o rechazar una solicitud de venta
 * Body: { action: 'approve' | 'reject', rejectionReason?: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const ctx = await getInventorySessionContext(session.user)
  if (!hasInventoryModuleAccess(ctx)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params

  try {
    await assertInventoryResourceManage(ctx.user, 'SALE', id)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const body = await req.json()
  const { action, rejectionReason } = body

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const sale = await prisma.equipment_sales.findUnique({
    where: { id },
    include: { equipment: { select: { code: true, status: true } } },
  })

  if (!sale) return NextResponse.json({ error: 'Venta no encontrada' }, { status: 404 })
  if (sale.status !== 'PENDING') {
    return NextResponse.json({ error: 'Esta solicitud ya fue procesada' }, { status: 409 })
  }

  if (action === 'approve') {
    const [updatedSale] = await prisma.$transaction([
      prisma.equipment_sales.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      }),
      prisma.equipment.update({
        where: { id: sale.equipmentId },
        data: { status: 'SOLD' },
      }),
    ])

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'EQUIPMENT_SALE_APPROVED',
        entityType: 'equipment',
        entityId: sale.equipmentId,
        userId: session.user.id,
        details: { descripcion: `Venta aprobada para ${sale.equipment.code}`, saleId: id },
        createdAt: new Date(),
      },
    })

    return NextResponse.json(updatedSale)
  }

  if (!rejectionReason?.trim()) {
    return NextResponse.json({ error: 'Debes indicar el motivo del rechazo' }, { status: 400 })
  }

  const updatedSale = await prisma.equipment_sales.update({
    where: { id },
    data: {
      status: 'REJECTED',
      rejectionReason: rejectionReason.trim(),
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
  })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_SALE_REJECTED',
      entityType: 'equipment',
      entityId: sale.equipmentId,
      userId: session.user.id,
      details: {
        descripcion: `Venta rechazada para ${sale.equipment.code}`,
        motivo: rejectionReason,
      },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(updatedSale)
}
