import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'

/**
 * GET /api/inventory/contracts/[id]/history
 * Obtiene el historial completo de renovaciones de un contrato
 * Retorna la cadena completa desde el contrato original hasta el más reciente
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const history = await ContractService.getRenewalHistory(params.id)

    return NextResponse.json({
      success: true,
      chain: history,
      totalRenewals: history.length - 1, // -1 porque incluye el original
    })
  } catch (error) {
    console.error('Error obteniendo historial de renovaciones:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al obtener historial',
      },
      { status: 500 }
    )
  }
}
