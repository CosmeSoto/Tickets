import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  assertCatalogEntryWrite,
  assertGlobalCatalogDelete,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * PUT /api/inventory/equipment-types/[typeId]
 * Actualiza un tipo de equipo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { typeId } = await params
    const user = toInventoryAccessUser(session.user)
    const body = await request.json()
    const { name, description, icon, order, isActive, familyId } = body

    const existing = await prisma.equipment_types.findUnique({ where: { id: typeId } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    await assertCatalogEntryWrite(user, existing.familyId)
    const targetFamilyId = familyId !== undefined ? familyId : existing.familyId
    if (targetFamilyId !== existing.familyId) {
      await assertCatalogEntryWrite(user, targetFamilyId ?? null)
    }

    const updated = await prisma.equipment_types.update({
      where: { id: typeId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
        ...(familyId !== undefined && { familyId: familyId || null }),
      },
      include: { family: { select: { id: true, name: true, icon: true, color: true } } },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_TYPE_UPDATED,
      entityType: 'inventory',
      entityId: typeId,
      userId: session.user.id,
      details: { name: updated.name, code: updated.code },
      oldValues: {
        name: existing.name,
        description: existing.description,
        icon: existing.icon,
        order: existing.order,
        isActive: existing.isActive,
      },
      newValues: {
        name: updated.name,
        description: updated.description,
        icon: updated.icon,
        order: updated.order,
        isActive: updated.isActive,
      },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err =>
      console.error('[AUDIT] Error registrando actualización de tipo de equipo:', err)
    )

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error en PUT /api/inventory/equipment-types/[typeId]:', error)
    return NextResponse.json(
      {
        error:
          error?.code === 'P2025'
            ? 'Tipo de equipo no encontrado'
            : 'Error al actualizar tipo de equipo',
      },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}

/**
 * DELETE /api/inventory/equipment-types/[typeId]
 * Elimina (o desactiva) un tipo de equipo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await assertGlobalCatalogDelete(toInventoryAccessUser(session.user))

    const { typeId } = await params

    const existing = await prisma.equipment_types.findUnique({ where: { id: typeId } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    const equipmentCount = await prisma.equipment.count({
      where: { typeId },
    })

    if (equipmentCount > 0) {
      const updated = await prisma.equipment_types.update({
        where: { id: typeId },
        data: { isActive: false },
      })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.EQUIPMENT_TYPE_UPDATED,
        entityType: 'inventory',
        entityId: typeId,
        userId: session.user.id,
        details: {
          name: existing.name,
          code: existing.code,
          action: 'desactivado',
          reason: `${equipmentCount} equipo(s) usan este tipo`,
        },
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err =>
        console.error('[AUDIT] Error registrando desactivación de tipo de equipo:', err)
      )

      return NextResponse.json({
        message: `Tipo desactivado. ${equipmentCount} equipo(s) usan este tipo.`,
        type: updated,
      })
    }

    await prisma.equipment_types.delete({ where: { id: typeId } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_TYPE_DELETED,
      entityType: 'inventory',
      entityId: typeId,
      userId: session.user.id,
      details: { name: existing.name, code: existing.code },
      ipAddress:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err =>
      console.error('[AUDIT] Error registrando eliminación de tipo de equipo:', err)
    )

    return NextResponse.json({ message: 'Tipo eliminado permanentemente' })
  } catch (error: any) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error en DELETE /api/inventory/equipment-types/[typeId]:', error)
    const message =
      error?.code === 'P2003'
        ? 'No se puede eliminar: hay registros que dependen de este tipo'
        : error?.code === 'P2025'
          ? 'Tipo de equipo no encontrado'
          : 'Error al eliminar tipo de equipo'
    return NextResponse.json({ error: message }, { status: error?.code === 'P2025' ? 404 : 500 })
  }
}
