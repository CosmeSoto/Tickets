/**
 * POST /api/admin/inventory/warehouses/clone
 *
 * Copia bodegas de una familia origen a otra (o varias) familias destino.
 *
 * Body:
 *   sourceFamilyId    string
 *   targetFamilyIds   string[]
 *   warehouseIds?     string[]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getInventoryManageFamilyIds } from '@/lib/inventory/family-access'
import { canManageInventory } from '@/lib/inventory-access'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const canManage = await canManageInventory(session.user.id, session.user.role)
    if (session.user.role !== 'ADMIN' && !canManage) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()
    const { sourceFamilyId, targetFamilyIds, warehouseIds } = body as {
      sourceFamilyId: string
      targetFamilyIds: string[]
      warehouseIds?: string[]
    }

    if (!sourceFamilyId || !Array.isArray(targetFamilyIds) || targetFamilyIds.length === 0) {
      return NextResponse.json(
        { error: 'sourceFamilyId y targetFamilyIds son requeridos' },
        { status: 400 }
      )
    }

    const manageable = await getInventoryManageFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      canManage
    )
    const canAccess = (familyId: string) =>
      manageable === undefined || manageable.includes(familyId)

    if (!canAccess(sourceFamilyId)) {
      return NextResponse.json({ error: 'Sin acceso a la familia origen' }, { status: 403 })
    }
    for (const targetId of targetFamilyIds) {
      if (!canAccess(targetId)) {
        return NextResponse.json({ error: 'Sin acceso a una familia destino' }, { status: 403 })
      }
    }

    const admin = await prisma.users.findFirst({
      where: { email: 'internet.freecom@gmail.com' },
      select: { id: true },
    })

    const sourceWarehouses = await prisma.warehouses.findMany({
      where: {
        familyId: sourceFamilyId,
        isActive: true,
        ...(warehouseIds?.length ? { id: { in: warehouseIds } } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    if (sourceWarehouses.length === 0) {
      return NextResponse.json(
        { error: 'No hay bodegas para copiar en la familia origen' },
        { status: 404 }
      )
    }

    const targetFamilies = await prisma.families.findMany({
      where: { id: { in: targetFamilyIds } },
      select: { id: true, name: true },
    })

    let created = 0
    let skipped = 0

    for (const target of targetFamilies) {
      if (target.id === sourceFamilyId) continue

      const maxOrder = await prisma.warehouses.aggregate({
        where: { familyId: target.id },
        _max: { order: true },
      })
      let nextOrder = (maxOrder._max.order ?? -1) + 1

      for (const warehouse of sourceWarehouses) {
        const existing = await prisma.warehouses.findFirst({
          where: { familyId: target.id, name: warehouse.name },
        })
        if (existing) {
          skipped++
          continue
        }

        await prisma.warehouses.create({
          data: {
            id: randomUUID(),
            name: warehouse.name,
            location: warehouse.location,
            description: warehouse.description,
            familyId: target.id,
            managerId: admin?.id ?? warehouse.managerId,
            isActive: true,
            order: nextOrder++,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      sourceCount: sourceWarehouses.length,
      targets: targetFamilies.map(f => f.name),
    })
  } catch (error) {
    console.error('[POST warehouses/clone]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al copiar bodegas' },
      { status: 500 }
    )
  }
}
