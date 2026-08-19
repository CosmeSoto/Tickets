import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { sanitizeSupplierPayload } from '@/lib/validations/inventory/supplier'
import { buildSupplierAuditSnapshot, supplierAuditMessage } from '@/lib/inventory/supplier-audit'
import { buildSupplierCommercialSummary } from '@/lib/inventory/supplier-commercial'
import { notifySupplierLifecycle } from '@/lib/inventory/notifications'
import { ZodError } from 'zod'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/inventory/suppliers/[id]
 * Detalle de proveedor con conteo de equipos, consumibles y licencias asociadas
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

    const supplier = await prisma.suppliers.findUnique({
      where: { id },
      include: {
        supplierType: { select: { id: true, name: true } },
        family: { select: { id: true, name: true, color: true, code: true } },
        _count: {
          select: {
            equipment: true,
            consumables: true,
            software_licenses: true,
            maintenances: true,
            contracts: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const openContracts = await prisma.contracts.findMany({
      where: {
        supplierId: id,
        status: { in: ['ACTIVE', 'EXPIRING'] },
      },
      select: {
        monthlyCost: true,
        totalValue: true,
        billingCycle: true,
        currency: true,
        status: true,
      },
    })

    const commercialSummary = buildSupplierCommercialSummary({
      contracts: openContracts,
      creditLimit: supplier.creditLimit,
      creditCurrency: supplier.creditCurrency,
    })

    return NextResponse.json({ ...supplier, commercialSummary })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[GET /api/inventory/suppliers/[id]]', err)
    return NextResponse.json({ error: 'Error al obtener proveedor' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/suppliers/[id]
 * Editar proveedor
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.suppliers.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const user = toInventoryAccessUser(session.user)
    try {
      await assertInventoryResourceManage(user, 'SUPPLIER', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    let data: ReturnType<typeof sanitizeSupplierPayload>
    try {
      data = sanitizeSupplierPayload(body)
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.errors[0]
        return NextResponse.json(
          {
            error: first?.message ?? 'Datos inválidos',
            field: first?.path?.join('.'),
            details: err.errors,
          },
          { status: 422 }
        )
      }
      throw err
    }

    const targetFamilyId = data.familyId !== undefined ? data.familyId : existing.familyId
    if (!targetFamilyId && !user.isSuperAdmin) {
      return NextResponse.json(
        {
          error: 'Selecciona el área del proveedor. Solo Super Admin puede dejarlo global.',
          field: 'familyId',
        },
        { status: 422 }
      )
    }
    if (targetFamilyId) {
      try {
        await assertInventoryManageByFamily(user, targetFamilyId)
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    if (data.taxId) {
      const duplicate = await prisma.suppliers.findFirst({
        where: { taxId: data.taxId, id: { not: id } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un proveedor con ese RUC/NIT' },
          { status: 409 }
        )
      }
    }

    const supplier = await prisma.suppliers.update({
      where: { id },
      data,
    })

    const before = buildSupplierAuditSnapshot(existing)
    const after = buildSupplierAuditSnapshot(supplier)

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: supplierAuditMessage('UPDATE', supplier.name, session.user.email),
          ...after,
          changes: { before, after },
        },
      },
    })

    return NextResponse.json(supplier)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[PUT /api/inventory/suppliers/[id]]', err)
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/suppliers/[id]
 * Activar / desactivar proveedor.
 * Body opcional: `{ isActive: boolean }` (default `false` = desactivar, compatible con clientes actuales).
 * Solo ADMIN/SuperAdmin. No se puede desactivar si tiene activos asociados.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (role !== 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador puede activar o desactivar proveedores' },
        { status: 403 }
      )
    }

    const { id } = await params

    let isActive = false
    try {
      const body = await request.json()
      if (typeof body?.isActive === 'boolean') isActive = body.isActive
    } catch {
      // Sin body (clientes legacy): desactivar
      isActive = false
    }

    const existing = await prisma.suppliers.findUnique({
      where: { id },
      include: {
        _count: {
          select: { equipment: true, consumables: true, software_licenses: true },
        },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    if (existing.isActive === isActive) {
      return NextResponse.json(existing)
    }

    if (!isActive) {
      const total =
        existing._count.equipment + existing._count.consumables + existing._count.software_licenses
      if (total > 0) {
        return NextResponse.json(
          {
            error: `No se puede desactivar: el proveedor tiene ${total} activo(s) asociado(s). Reasígnalos primero.`,
          },
          { status: 409 }
        )
      }
    }

    const supplier = await prisma.suppliers.update({
      where: { id },
      data: { isActive },
    })

    const action = isActive ? 'REACTIVATE' : 'DEACTIVATE'
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action,
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: supplierAuditMessage(action, supplier.name, session.user.email),
          ...buildSupplierAuditSnapshot(supplier),
        },
      },
    })

    const openContracts = await prisma.contracts.count({
      where: { supplierId: id, status: { in: ['ACTIVE', 'EXPIRING'] } },
    })

    notifySupplierLifecycle({
      familyId: supplier.familyId,
      supplierId: supplier.id,
      supplierName: supplier.name,
      event: isActive ? 'reactivated' : 'deactivated',
      actorName: session.user.email,
      extra:
        !isActive && openContracts > 0
          ? `Aún tiene ${openContracts} contrato(s) abierto(s).`
          : undefined,
    }).catch(err => console.error('[NOTIFICATION] supplier lifecycle:', err))

    return NextResponse.json(supplier)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[PATCH /api/inventory/suppliers/[id]]', err)
    return NextResponse.json({ error: 'Error al cambiar el estado del proveedor' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/suppliers/[id]
 * Eliminar proveedor permanentemente.
 * Solo ADMIN/SuperAdmin. Solo si no tiene activos asociados.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN puede eliminar permanentemente — gestores solo pueden crear/editar
    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (role !== 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador puede eliminar proveedores' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.suppliers.findUnique({
      where: { id },
      include: {
        _count: {
          select: { equipment: true, consumables: true, software_licenses: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const total =
      existing._count.equipment + existing._count.consumables + existing._count.software_licenses
    if (total > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: el proveedor tiene ${total} activo(s) asociado(s). Reasígnalos o desactívalo primero.`,
        },
        { status: 409 }
      )
    }

    await prisma.suppliers.delete({ where: { id } })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DELETE',
        entityType: 'SUPPLIER',
        entityId: id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: supplierAuditMessage('DELETE', existing.name, session.user.email),
          ...buildSupplierAuditSnapshot(existing),
        },
      },
    })

    notifySupplierLifecycle({
      familyId: existing.familyId,
      supplierId: id,
      supplierName: existing.name,
      event: 'deleted',
      actorName: session.user.email,
    }).catch(err => console.error('[NOTIFICATION] supplier lifecycle:', err))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[DELETE /api/inventory/suppliers/[id]]', err)
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 })
  }
}
