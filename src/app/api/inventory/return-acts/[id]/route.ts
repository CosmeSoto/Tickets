import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'

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

    // Verificar permisos: deliverer, receiver o ADMIN
    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'
    const isParticipant =
      (act.receiverInfo as any)?.id === userId || (act.delivererInfo as any)?.id === userId

    if (!isAdmin && !isParticipant) {
      return NextResponse.json({ error: 'Sin permisos para ver este acta' }, { status: 403 })
    }

    return NextResponse.json(act)
  } catch (error) {
    console.error('Error en GET /api/inventory/return-acts/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener acta' }, { status: 500 })
  }
}
