import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/return-acts/[id]
 * Obtiene el detalle de un acta de devolución
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const act = await ReturnActService.getActById(id)

    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'
    const canManage = await canManageInventory(userId, session.user.role)
    const isParticipant =
      (act.receiverInfo as any)?.id === userId || (act.delivererInfo as any)?.id === userId

    if (!isAdmin && !canManage && !isParticipant) {
      return NextResponse.json({ error: 'Sin permisos para ver este acta' }, { status: 403 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const isExpired = ReturnActService.isActExpired(act)
    const canAccept = act.status === 'PENDING' && !isExpired && isParticipant
    const accessLevel = isSuperAdmin ? 'superadmin' : isAdmin ? 'admin' : canManage ? 'manager' : 'participant'

    return NextResponse.json({ act, canAccept, isExpired, accessLevel })
  } catch (error) {
    console.error('Error en GET /api/inventory/return-acts/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener acta' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/return-acts/[id]
 * Elimina un acta de devolución. Solo SuperAdmin.
 * La auditoría se mantiene en audit_logs.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede eliminar actas de devolución' },
        { status: 403 }
      )
    }

    const { id } = await params
    const act = await ReturnActService.getActById(id)
    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    // Registrar auditoría ANTES de eliminar
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'DELETE',
        entityType: 'return_act',
        entityId: id,
        userId: session.user.id,
        details: {
          folio: act.folio,
          status: act.status,
          deletedBy: session.user.email,
          reason: 'Eliminación por Super Administrador',
        },
      },
    })

    await (prisma.return_acts.delete as any)({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/return-acts/[id]:', error)
    return NextResponse.json({ error: 'Error al eliminar acta' }, { status: 500 })
  }
}
