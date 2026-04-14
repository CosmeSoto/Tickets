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
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!await canManageInventory(session.user.id, session.user.role)) {
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
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!await canManageInventory(session.user.id, session.user.role)) {
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
      return NextResponse.json(
        { error: 'El nombre del proveedor es obligatorio' },
        { status: 400 }
      )
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

    const supplier = await prisma.suppliers.update({
      where: { id },
      data: {
        name: name.trim(),
        typeId: typeId || null,
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
          supplierType: supplier.type,
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
 * Restricción: no se puede desactivar si tiene equipos, consumibles o licencias activos.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!await canManageInventory(session.user.id, session.user.role)) {
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
    const total = existing._count.equipment + existing._count.consumables + existing._count.software_licenses
    if (total > 0) {
      return NextResponse.json(
        { error: `No se puede desactivar: el proveedor tiene ${total} activo(s) asociado(s). Reasígnalos primero.` },
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
