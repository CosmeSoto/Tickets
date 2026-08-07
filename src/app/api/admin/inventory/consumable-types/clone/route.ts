/**
 * POST /api/admin/inventory/consumable-types/clone
 * Copia un tipo de suministro (con todos sus atributos) a otra familia.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getInventoryManageFamilyIds } from '@/lib/inventory/family-access'
import { canManageInventory } from '@/lib/inventory-access'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
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
    const {
      sourceTypeId,
      targetFamilyId,
      newName,
      copyAttributes = true,
    } = body as {
      sourceTypeId: string
      targetFamilyId: string
      newName?: string
      copyAttributes?: boolean
    }

    if (!sourceTypeId || !targetFamilyId) {
      return NextResponse.json(
        { error: 'sourceTypeId y targetFamilyId son requeridos' },
        { status: 400 }
      )
    }

    const manageable = await getInventoryManageFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      canManage
    )
    if (manageable !== undefined && !manageable.includes(targetFamilyId)) {
      return NextResponse.json({ error: 'Sin acceso a la familia destino' }, { status: 403 })
    }

    const source = await prisma.consumable_types.findUnique({
      where: { id: sourceTypeId },
      include: { attributes: { orderBy: { order: 'asc' } } },
    })
    if (!source) return NextResponse.json({ error: 'Tipo origen no encontrado' }, { status: 404 })

    const finalName = newName?.trim() || source.name
    const baseCode = slugify(finalName)
    const existing = await prisma.consumable_types.findMany({
      where: { familyId: targetFamilyId, code: { startsWith: baseCode } },
      select: { code: true },
    })
    const usedCodes = new Set(existing.map(t => t.code))
    let finalCode = baseCode
    let suffix = 1
    while (usedCodes.has(finalCode)) {
      finalCode = `${baseCode}-${suffix++}`
    }

    const newType = await prisma.$transaction(async tx => {
      const created = await tx.consumable_types.create({
        data: {
          id: randomUUID(),
          code: finalCode,
          name: finalName,
          description: source.description,
          icon: source.icon,
          family: { connect: { id: targetFamilyId } },
          isActive: source.isActive,
          order: source.order,
        },
      })

      if (copyAttributes && source.attributes.length > 0) {
        await tx.consumable_type_attributes.createMany({
          data: source.attributes.map(a => ({
            id: randomUUID(),
            consumableTypeId: created.id,
            attributeName: a.attributeName,
            attributeLabel: a.attributeLabel,
            attributeType: a.attributeType,
            ...(a.options !== null && a.options !== undefined
              ? { options: a.options as object }
              : {}),
            isRequired: a.isRequired,
            isVisible: a.isVisible,
            order: a.order,
            helpText: a.helpText,
          })),
        })
      }

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'TYPE_CLONED',
          entityType: 'consumable_type',
          entityId: created.id,
          userId: session.user.id,
          details: {
            sourceTypeId,
            sourceTypeName: source.name,
            targetFamilyId,
            attributesCopied: copyAttributes ? source.attributes.length : 0,
          },
        },
      })
      return created
    })

    return NextResponse.json({
      success: true,
      type: newType,
      attributesCopied: copyAttributes ? source.attributes.length : 0,
    })
  } catch (error) {
    console.error('[POST consumable-types/clone]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al copiar tipo' },
      { status: 500 }
    )
  }
}
