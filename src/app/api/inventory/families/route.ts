import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/families
 * Lista familias de inventario.
 * - ADMIN: todas las activas (o todas si ?includeInactive=true)
 * - Gestor (canManageInventory): solo las familias asignadas a él
 * - TECHNICIAN / CLIENT: todas las activas (solo lectura, para filtros de UI)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isManager = !isAdmin && await canManageInventory(user.id, user.role)

    const includeInactive =
      isAdmin && request.nextUrl.searchParams.get('includeInactive') === 'true'

    // ADMIN: todas las familias
    if (isAdmin) {
      const families = await prisma.families.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: { order: 'asc' },
      })
      return NextResponse.json({ families })
    }

    // Gestor: solo familias asignadas y activas
    if (isManager) {
      const assignments = await prisma.inventory_manager_families.findMany({
        where: { managerId: user.id },
        include: { family: true },
      })
      const families = assignments
        .map((a) => a.family)
        .filter((f) => f.isActive)
        .sort((a, b) => a.order - b.order)
      return NextResponse.json({ families })
    }

    // TECHNICIAN / CLIENT: todas las familias activas (solo lectura para filtros)
    const families = await prisma.families.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, code: true, color: true, icon: true, order: true },
    })
    return NextResponse.json({ families })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener familias' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/families
 * Crea una nueva familia de inventario.
 * Solo ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, icon, color, order, description } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Generar code a partir del nombre si no se provee
    const familyCode: string = code
      ? String(code).toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
      : name.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')

    const family = await prisma.families.create({
      data: {
        id: randomUUID(),
        code: familyCode,
        name: name.trim(),
        icon: icon ?? null,
        color: color ?? '#6B7280',
        order: order ?? 0,
        description: description ?? null,
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'CREATE',
        entityType: 'inventory_family',
        entityId: family.id,
        userId: session.user.id,
        details: { name: family.name },
      },
    }).catch(err => console.warn('[audit] families POST:', err?.message))

    return NextResponse.json({ family }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Error al crear la familia' },
      { status: 500 }
    )
  }
}
