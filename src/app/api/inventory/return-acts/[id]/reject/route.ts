import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'

/**
 * POST /api/inventory/return-acts/[id]/reject
 * Rechaza un acta de devolución
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'El motivo de rechazo es requerido (mínimo 5 caracteres)' },
        { status: 400 }
      )
    }

    // Verificar que el acta existe y el usuario tiene permisos
    const act = await ReturnActService.getActById(id)
    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    const isDeliverer = (act.delivererInfo as any)?.id === session.user.id
    const isReceiver = (act.receiverInfo as any)?.id === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isDeliverer && !isReceiver && !isAdmin) {
      return NextResponse.json({ error: 'Sin permisos para rechazar este acta' }, { status: 403 })
    }

    const updated = await ReturnActService.rejectAct(id, reason.trim(), session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Acta de devolución rechazada',
      act: updated,
    })
  } catch (error) {
    console.error('Error en POST /api/inventory/return-acts/[id]/reject:', error)
    const msg = error instanceof Error ? error.message : 'Error al rechazar acta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
