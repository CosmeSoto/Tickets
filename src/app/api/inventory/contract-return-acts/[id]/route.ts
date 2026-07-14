import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** GET /api/inventory/contract-return-acts/[id]?token= */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const token = request.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 401 })
    }

    const act = await prisma.contract_return_acts.findFirst({
      where: { id, acceptanceToken: token },
    })

    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada o token inválido' }, { status: 404 })
    }

    const isExpired = act.expirationDate < new Date()
    const canAccept = act.status === 'PENDING' && !isExpired

    return NextResponse.json({ act, canAccept, isExpired })
  } catch (error) {
    console.error('[GET contract-return-act]', error)
    return NextResponse.json({ error: 'Error al obtener acta' }, { status: 500 })
  }
}
