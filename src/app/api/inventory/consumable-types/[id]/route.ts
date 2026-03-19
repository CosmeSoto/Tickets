import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const { id } = await params
    const { name, description, icon, order, isActive } = await request.json()

    const existing = await prisma.consumable_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de consumible no encontrado' }, { status: 404 })
    }

    const updated = await prisma.consumable_types.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_TYPE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: updated.name, code: updated.code },
      oldValues: { name: existing.name, description: existing.description, icon: existing.icon, order: existing.order, isActive: existing.isActive },
      newValues: { name: updated.name, description: updated.description, icon: updated.icon, order: updated.order, isActive: updated.isActive },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de tipo de consumible:', err))

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error en PUT /api/inventory/consumable-types/[id]:', error)
    return NextResponse.json(
      { error: error?.code === 'P2025' ? 'Tipo de consumible no encontrado' : 'Error al actualizar tipo de consumible' },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden eliminar tipos de consumible' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.consumable_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de consumible no encontrado' }, { status: 404 })
    }

    const count = await prisma.consumables.count({ where: { typeId: id } })
    if (count > 0) {
      const updated = await prisma.consumable_types.update({ where: { id }, data: { isActive: false } })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.CONSUMABLE_TYPE_UPDATED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, code: existing.code, action: 'desactivado', reason: `${count} consumible(s) usan este tipo` },
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err => console.error('[AUDIT] Error registrando desactivación de tipo de consumible:', err))

      return NextResponse.json({ message: `Tipo desactivado. ${count} consumible(s) usan este tipo.`, type: updated })
    }

    await prisma.consumable_types.delete({ where: { id } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_TYPE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing.name, code: existing.code },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de tipo de consumible:', err))

    return NextResponse.json({ message: 'Tipo eliminado permanentemente' })
  } catch (error: any) {
    console.error('Error en DELETE /api/inventory/consumable-types/[id]:', error)
    const message = error?.code === 'P2003'
      ? 'No se puede eliminar: hay registros que dependen de este tipo'
      : error?.code === 'P2025'
        ? 'Tipo de consumible no encontrado'
        : 'Error al eliminar tipo de consumible'
    return NextResponse.json(
      { error: message },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}
