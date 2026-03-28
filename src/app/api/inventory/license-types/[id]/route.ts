import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * PUT /api/inventory/license-types/[id]
 * Actualiza un tipo de licencia (ADMIN y TECHNICIAN)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const body = await request.json()
    const { name, description, icon, order, isActive, familyId } = body

    const existing = await prisma.license_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 404 })
    }

    const updated = await prisma.license_types.update({
      where: { id },
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
      action: AuditActionsComplete.LICENSE_TYPE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: updated.name, code: updated.code },
      oldValues: { name: existing.name, description: existing.description, icon: existing.icon, order: existing.order, isActive: existing.isActive },
      newValues: { name: updated.name, description: updated.description, icon: updated.icon, order: updated.order, isActive: updated.isActive },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de tipo de licencia:', err))

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error en PUT /api/inventory/license-types/[id]:', error)
    return NextResponse.json(
      { error: error?.code === 'P2025' ? 'Tipo de licencia no encontrado' : 'Error al actualizar tipo de licencia' },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}

/**
 * DELETE /api/inventory/license-types/[id]
 * Elimina (o desactiva) un tipo de licencia (solo ADMIN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado. Solo administradores pueden eliminar tipos de licencia.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.license_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de licencia no encontrado' }, { status: 404 })
    }

    const licenseCount = await prisma.software_licenses.count({
      where: { typeId: id },
    })

    if (licenseCount > 0) {
      const updated = await prisma.license_types.update({
        where: { id },
        data: { isActive: false },
      })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.LICENSE_TYPE_UPDATED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, code: existing.code, action: 'desactivado', reason: `${licenseCount} licencia(s) usan este tipo` },
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err => console.error('[AUDIT] Error registrando desactivación de tipo de licencia:', err))

      return NextResponse.json({
        message: `Tipo desactivado. ${licenseCount} licencia(s) usan este tipo.`,
        type: updated,
      })
    }

    await prisma.license_types.delete({ where: { id } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_TYPE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing.name, code: existing.code },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de tipo de licencia:', err))

    return NextResponse.json({ message: 'Tipo eliminado permanentemente' })
  } catch (error: any) {
    console.error('Error en DELETE /api/inventory/license-types/[id]:', error)
    const message = error?.code === 'P2003'
      ? 'No se puede eliminar: hay registros que dependen de este tipo'
      : error?.code === 'P2025'
        ? 'Tipo de licencia no encontrado'
        : 'Error al eliminar tipo de licencia'
    return NextResponse.json(
      { error: message },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}
