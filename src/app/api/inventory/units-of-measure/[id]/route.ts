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
    const { name, symbol, description, order, isActive } = await request.json()

    const existing = await prisma.units_of_measure.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Unidad de medida no encontrada' }, { status: 404 })
    }

    const updated = await prisma.units_of_measure.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(symbol !== undefined && { symbol }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.UNIT_OF_MEASURE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: updated.name, code: updated.code },
      oldValues: { name: existing.name, symbol: existing.symbol, description: existing.description, order: existing.order, isActive: existing.isActive },
      newValues: { name: updated.name, symbol: updated.symbol, description: updated.description, order: updated.order, isActive: updated.isActive },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de unidad de medida:', err))

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error en PUT /api/inventory/units-of-measure/[id]:', error)
    return NextResponse.json(
      { error: error?.code === 'P2025' ? 'Unidad de medida no encontrada' : 'Error al actualizar unidad de medida' },
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
      return NextResponse.json({ error: 'Solo administradores pueden eliminar unidades de medida' }, { status: 403 })
    }

    const { id } = await params

    const existing = await prisma.units_of_measure.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Unidad de medida no encontrada' }, { status: 404 })
    }

    const count = await prisma.consumables.count({ where: { unitOfMeasureId: id } })
    if (count > 0) {
      const updated = await prisma.units_of_measure.update({ where: { id }, data: { isActive: false } })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.UNIT_OF_MEASURE_UPDATED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, code: existing.code, action: 'desactivada', reason: `${count} consumible(s) la usan` },
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err => console.error('[AUDIT] Error registrando desactivación de unidad de medida:', err))

      return NextResponse.json({ message: `Unidad desactivada. ${count} consumible(s) la usan.`, unit: updated })
    }

    await prisma.units_of_measure.delete({ where: { id } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.UNIT_OF_MEASURE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing.name, code: existing.code },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de unidad de medida:', err))

    return NextResponse.json({ message: 'Unidad eliminada permanentemente' })
  } catch (error: any) {
    console.error('Error en DELETE /api/inventory/units-of-measure/[id]:', error)
    const message = error?.code === 'P2003'
      ? 'No se puede eliminar: hay registros que dependen de esta unidad'
      : error?.code === 'P2025'
        ? 'Unidad de medida no encontrada'
        : 'Error al eliminar unidad de medida'
    return NextResponse.json(
      { error: message },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}
