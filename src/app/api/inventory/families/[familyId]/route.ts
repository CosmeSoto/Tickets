import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import {
  assertInventoryFamilyRoute,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { isPrismaForeignKeyViolation } from '@/lib/db/prisma-errors'

/**
 * GET /api/inventory/families/[familyId]
 * Retorna el detalle de una familia con sus tipos activos relacionados.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params

    try {
      await assertInventoryFamilyRoute(toInventoryAccessUser(session.user), familyId, 'read')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      include: {
        equipmentTypes: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
        consumableTypes: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
        licenseTypes: {
          where: { isActive: true },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        },
      },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ family })
  } catch {
    return NextResponse.json({ error: 'Error al obtener la familia' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/families/[familyId]
 * Edita una familia de inventario. Solo Super Admin — misma tabla `families`
 * que administra /api/families, que ya restringe la edición a Super Admin;
 * un ADMIN scoped a una familia no debe poder editar el catálogo global.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const superCheck = await (
      await import('@/lib/auth/require-super-admin')
    ).requireSuperAdmin(session)
    if (!superCheck.ok) {
      return NextResponse.json({ error: superCheck.error }, { status: superCheck.status })
    }

    const { familyId } = await params

    const existing = await prisma.families.findUnique({ where: { id: familyId } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { name, icon, color, order, description } = body

    const family = await prisma.families.update({
      where: { id: familyId },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(order !== undefined && { order }),
        ...(description !== undefined && { description }),
      },
    })

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'UPDATE',
          entityType: 'inventory_family',
          entityId: family.id,
          userId: session.user.id,
          details: { name: family.name },
        },
      })
      .catch(err => console.warn('[audit] families PUT:', err?.message))

    return NextResponse.json({ family })
  } catch (err) {
    console.error('[PUT /api/inventory/families/[familyId]]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al editar la familia' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/inventory/families/[familyId]
 * Alterna el estado activo/inactivo de una familia. Solo Super Admin —
 * desactivar una familia tiene efectos en cascada sobre tickets/inventario/
 * rondas de toda la organización, no solo del ámbito de un ADMIN scoped.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const superCheck = await (
      await import('@/lib/auth/require-super-admin')
    ).requireSuperAdmin(session)
    if (!superCheck.ok) {
      return NextResponse.json({ error: superCheck.error }, { status: superCheck.status })
    }

    const { familyId } = await params

    const existing = await prisma.families.findUnique({ where: { id: familyId } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const family = await prisma.families.update({
      where: { id: familyId },
      data: { isActive: !existing.isActive },
    })

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'TOGGLE',
          entityType: 'inventory_family',
          entityId: family.id,
          userId: session.user.id,
          details: { isActive: family.isActive },
        },
      })
      .catch(err => console.warn('[audit] families PATCH:', err?.message))

    return NextResponse.json({ family })
  } catch {
    return NextResponse.json({ error: 'Error al cambiar el estado de la familia' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/families/[familyId]
 * Elimina una familia si no tiene tipos de activo asignados. Solo Super
 * Admin — misma tabla `families` que administra /api/families, que ya
 * restringe la eliminación a Super Admin.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const superCheck = await (
      await import('@/lib/auth/require-super-admin')
    ).requireSuperAdmin(session)
    if (!superCheck.ok) {
      return NextResponse.json({ error: superCheck.error }, { status: superCheck.status })
    }

    const { familyId } = await params

    const existing = await prisma.families.findUnique({ where: { id: familyId } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const [equipmentCount, consumableCount, licenseCount] = await Promise.all([
      prisma.equipment_types.count({ where: { familyId } }),
      prisma.consumable_types.count({ where: { familyId } }),
      prisma.license_types.count({ where: { familyId } }),
    ])

    if (equipmentCount + consumableCount + licenseCount > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar la familia porque tiene tipos de activo asignados. Desactívela en su lugar.',
        },
        { status: 409 }
      )
    }

    try {
      await prisma.families.delete({ where: { id: familyId } })
    } catch (err) {
      // TOCTOU: un tipo pudo crearse entre el conteo y el delete. La FK real
      // de Postgres lo impide (P2003) — se traduce a la misma respuesta 409
      // controlada en vez de dejarla caer al 500 genérico.
      if (isPrismaForeignKeyViolation(err)) {
        return NextResponse.json(
          {
            error:
              'No se puede eliminar la familia porque tiene tipos de activo asignados. Desactívela en su lugar.',
          },
          { status: 409 }
        )
      }
      throw err
    }

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'DELETE',
          entityType: 'inventory_family',
          entityId: familyId,
          userId: session.user.id,
          details: { name: existing.name },
        },
      })
      .catch(err => console.warn('[audit] families DELETE:', err?.message))

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Error al eliminar la familia' }, { status: 500 })
  }
}
