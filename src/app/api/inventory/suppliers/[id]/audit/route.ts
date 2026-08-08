import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

type RouteContext = { params: Promise<{ id: string }> }

const SUPPLIER_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  DEACTIVATE: 'Desactivación',
  REACTIVATE: 'Reactivación',
}

/**
 * GET /api/inventory/suppliers/[id]/audit
 * Historial de auditoría del proveedor (gestores de inventario).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'SUPPLIER', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const limit = Math.min(
      50,
      Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10))
    )

    const logs = await prisma.audit_logs.findMany({
      where: { entityType: 'SUPPLIER', entityId: id },
      include: {
        users: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({
      logs: logs.map(log => {
        const details = (log.details as Record<string, unknown> | null) || {}
        return {
          id: log.id,
          action: log.action,
          actionLabel: SUPPLIER_ACTION_LABELS[log.action] || log.action,
          message: typeof details.message === 'string' ? details.message : null,
          creditLimit: details.creditLimit ?? null,
          paymentTermsDays: details.paymentTermsDays ?? null,
          preferredPaymentMethod: details.preferredPaymentMethod ?? null,
          bankAccountMasked: details.bankAccountMasked ?? null,
          isActive: details.isActive ?? null,
          user: log.users,
          createdAt: log.createdAt.toISOString(),
        }
      }),
    })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[GET /api/inventory/suppliers/[id]/audit]', err)
    return NextResponse.json({ error: 'Error al obtener auditoría' }, { status: 500 })
  }
}
