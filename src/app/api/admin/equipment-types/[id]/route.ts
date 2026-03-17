import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * PUT /api/admin/equipment-types/[id]
 * Actualiza un tipo de equipo (ADMIN y TECHNICIAN)
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

    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, description, icon, order, isActive } = body

    const existing = await prisma.equipment_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    const updated = await prisma.equipment_types.update({
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
      action: AuditActionsComplete.EQUIPMENT_TYPE_UPDATED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: updated.name, code: updated.code },
      oldValues: { name: existing.name, description: existing.description, icon: existing.icon, order: existing.order, isActive: existing.isActive },
      newValues: { name: updated.name, description: updated.description, icon: updated.icon, order: updated.order, isActive: updated.isActive },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando actualización de tipo de equipo:', err))

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error en PUT /api/admin/equipment-types/[id]:', error)
    return NextResponse.json(
      { error: error?.code === 'P2025' ? 'Tipo de equipo no encontrado' : 'Error al actualizar tipo de equipo' },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}

/**
 * DELETE /api/admin/equipment-types/[id]
 * Elimina (desactiva) un tipo de equipo (solo ADMIN)
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
        { error: 'No autorizado. Solo administradores pueden eliminar tipos de equipo.' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verificar que el tipo existe
    const existing = await prisma.equipment_types.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }

    // Verificar si hay equipos usando este tipo
    const equipmentCount = await prisma.equipment.count({
      where: { typeId: id },
    })

    if (equipmentCount > 0) {
      const updated = await prisma.equipment_types.update({
        where: { id },
        data: { isActive: false },
      })

      await AuditServiceComplete.log({
        action: AuditActionsComplete.EQUIPMENT_TYPE_UPDATED,
        entityType: 'inventory',
        entityId: id,
        userId: session.user.id,
        details: { name: existing.name, code: existing.code, action: 'desactivado', reason: `${equipmentCount} equipos usan este tipo` },
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }).catch(err => console.error('[AUDIT] Error registrando desactivación de tipo de equipo:', err))

      return NextResponse.json({
        message: `Tipo desactivado. ${equipmentCount} equipos usan este tipo.`,
        type: updated,
      })
    }

    await prisma.equipment_types.delete({ where: { id } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_TYPE_DELETED,
      entityType: 'inventory',
      entityId: id,
      userId: session.user.id,
      details: { name: existing.name, code: existing.code },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando eliminación de tipo de equipo:', err))

    return NextResponse.json({ message: 'Tipo eliminado permanentemente' })
  } catch (error: any) {
    console.error('Error en DELETE /api/admin/equipment-types/[id]:', error)
    const message = error?.code === 'P2003'
      ? 'No se puede eliminar: hay registros que dependen de este tipo'
      : error?.code === 'P2025'
        ? 'Tipo de equipo no encontrado'
        : 'Error al eliminar tipo de equipo'
    return NextResponse.json(
      { error: message, details: process.env.NODE_ENV === 'development' ? String(error) : undefined },
      { status: error?.code === 'P2025' ? 404 : 500 }
    )
  }
}
