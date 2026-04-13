import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/suppliers
 * Lista proveedores con filtros opcionales: ?type=, ?active=, ?search=
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || undefined
    const activeParam = searchParams.get('active')
    const search = searchParams.get('search') || undefined

    const where: Record<string, unknown> = {}

    if (type) {
      where.type = type
    }

    if (activeParam !== null && activeParam !== undefined) {
      where.isActive = activeParam === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { taxId: { contains: search, mode: 'insensitive' } },
      ]
    }

    const suppliers = await prisma.suppliers.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(suppliers)
  } catch {
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

    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const body = await request.json()
    const { name, typeId, taxId, email, phone, address, website, contactName } = body

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

    // Verificar unicidad de taxId
    if (taxId) {
      const existing = await prisma.suppliers.findUnique({ where: { taxId } })
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe un proveedor con ese RUC/NIT' },
          { status: 409 }
        )
      }
    }

    const supplier = await prisma.suppliers.create({
      data: {
        name: name.trim(),
        typeId: typeId || null,
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
        action: 'CREATE',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        userId: session.user.id,
        userEmail: session.user.email,
        details: {
          message: `Proveedor "${supplier.name}" creado por ${session.user.email}`,
          supplierName: supplier.name,
          supplierType: supplier.type,
          taxId: supplier.taxId,
        },
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 })
  }
}
