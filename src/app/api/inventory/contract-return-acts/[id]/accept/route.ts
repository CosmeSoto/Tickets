import { NextRequest, NextResponse } from 'next/server'
import { ContractReturnActService } from '@/lib/services/contract-return-act.service'

/**
 * POST /api/inventory/contract-return-acts/[id]/accept?token=
 * Acepta acta de retiro de suscripción/contrato (firma del cliente).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined
    const userAgent = request.headers.get('user-agent') || undefined

    await ContractReturnActService.acceptAct(id, token, { ip, userAgent })

    return NextResponse.json({
      success: true,
      message: 'Acta de retiro aceptada correctamente',
    })
  } catch (error) {
    console.error('[contract-return-acts accept]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al aceptar acta' },
      { status: 400 }
    )
  }
}
