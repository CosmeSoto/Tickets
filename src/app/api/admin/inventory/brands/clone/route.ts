/**
 * POST /api/admin/inventory/brands/clone
 *
 * Copia marcas de una familia origen a otra (o varias) familias destino.
 *
 * Body:
 *   sourceFamilyId   string    — familia origen
 *   targetFamilyIds  string[]  — familias destino
 *   brandIds?        string[]  — marcas específicas (todas si se omite)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getInventoryManageFamilyIds } from '@/lib/inventory/family-access'
import { canManageInventory } from '@/lib/inventory-access'

function uniqueCode(baseCode: string, familyCode: string) {
  if (baseCode.endsWith(`_${familyCode}`)) return baseCode
  return `${baseCode}_${familyCode}`
}

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
    const { sourceFamilyId, targetFamilyIds, brandIds } = body as {
      sourceFamilyId: string
      targetFamilyIds: string[]
      brandIds?: string[]
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

    const sourceBrands = await prisma.equipment_brands.findMany({
      where: {
        familyId: sourceFamilyId,
        isActive: true,
        ...(brandIds?.length ? { id: { in: brandIds } } : {}),
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    if (sourceBrands.length === 0) {
      return NextResponse.json({ error: 'No hay marcas para copiar en la familia origen' }, { status: 404 })
    }

    const targetFamilies = await prisma.families.findMany({
      where: { id: { in: targetFamilyIds } },
      select: { id: true, code: true, name: true },
    })

    let created = 0
    let skipped = 0

    for (const target of targetFamilies) {
      if (target.id === sourceFamilyId) continue

      for (const brand of sourceBrands) {
        const code = uniqueCode(brand.code, target.code)
        const existing = await prisma.equipment_brands.findUnique({ where: { code } })
        if (existing) {
          skipped++
          continue
        }

        await prisma.equipment_brands.create({
          data: {
            id: randomUUID(),
            code,
            name: brand.name,
            description: brand.description,
            logoUrl: brand.logoUrl,
            order: brand.order,
            familyId: target.id,
            isActive: true,
          },
        })
        created++
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      sourceCount: sourceBrands.length,
      targets: targetFamilies.map(f => f.name),
    })
  } catch (error) {
    console.error('[POST brands/clone]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al copiar marcas' },
      { status: 500 }
    )
  }
}
