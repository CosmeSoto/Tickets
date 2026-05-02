import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ReturnActService } from '@/lib/services/return-act.service'

/**
 * POST /api/inventory/return-acts/[id]/accept
 * Acepta un acta de devolución y registra la firma digital
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    // Verificar que el acta existe y el usuario es el deliverer (quien recibe la devolución)
    const act = await ReturnActService.getActById(id)
    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    const isDeliverer = (act.delivererInfo as any)?.id === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isDeliverer && !isAdmin) {
      return NextResponse.json(
        { error: 'Solo el responsable de recibir la devolución puede aceptar este acta' },
        { status: 403 }
      )
    }

    // Extraer IP y user agent
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    const updated = await ReturnActService.acceptAct(id, ipAddress, userAgent)

    return NextResponse.json({
      success: true,
      message: 'Acta de devolución aceptada correctamente',
      act: updated,
    })
  } catch (error) {
    console.error('Error en POST /api/inventory/return-acts/[id]/accept:', error)
    const msg = error instanceof Error ? error.message : 'Error al aceptar acta'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
