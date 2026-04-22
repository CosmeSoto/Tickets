import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

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

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const { id } = await params

    const supplier = await prisma.suppliers.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            equipment: true,
            consumables: true,
            software_licenses: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch {
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

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const { id } = await params

    const existing = await prisma.suppliers.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { name, typeId, taxId, email, phone, address, website, contactName, familyId } = body

    // Validar nombre
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del proveedor es obligatorio' }, { status: 400 })
    }

    // Validar al menos email o teléfono
    if (!email && !phone) {
      return NextResponse.json(
        { error: 'Debe proporcionar al menos un email o teléfono de contacto' },
        { status: 400 }
      )
    }

    // Verificar unicidad de taxId excluyendo el propio
    if (taxId) {
      const duplicate = await prisma.suppliers.findFirst({
        where: { taxId, id: { not: id } },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'Ya existe un proveedor con ese RUC/NIT' },
          { status: 409 }
        )
      }
    }

    const supplier = await (prisma.suppliers.update as any)({
      where: { id },
      data: {
        name: name.trim(),
        type: typeId || null,
        familyId: familyId || null,
        taxId: taxId || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        contactName: contactName || null,
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: `Proveedor "${supplier.name}" actualizado por ${session.user.email}`,
          supplierName: supplier.name,
          supplierType: (supplier as any).type,
        },
      },
    })

    return NextResponse.json(supplier)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/suppliers/[id]
 * Desactivar proveedor.
 * Solo ADMIN/SuperAdmin. No se puede desactivar si tiene activos asociados.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN puede desactivar — gestores solo pueden crear/editar
    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (role !== 'ADMIN' && !isSuperAdmin) {
      return inventoryForbidden()
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

    // Verificar que no tenga activos asociados antes de desactivar
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

    const supplier = await prisma.suppliers.update({
      where: { id },
      data: { isActive: false },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DEACTIVATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: `Proveedor "${supplier.name}" desactivado por ${session.user.email}`,
          supplierName: supplier.name,
        },
      },
    })

    return NextResponse.json(supplier)
  } catch {
    return NextResponse.json({ error: 'Error al desactivar proveedor' }, { status: 500 })
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
      return inventoryForbidden()
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
          message: `Proveedor "${existing.name}" eliminado por ${session.user.email}`,
          supplierName: existing.name,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 })
  }
}
