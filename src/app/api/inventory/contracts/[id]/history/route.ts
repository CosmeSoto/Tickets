import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'
import { ContractAmendmentService } from '@/lib/services/contract-amendment.service'
import { requireContractAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/contracts/[id]/history
 * Obtiene el historial completo de renovaciones de un contrato
 * Retorna la cadena completa desde el contrato original hasta el más reciente
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const accessDenied = await requireContractAccess(session.user, id, 'read')
    if (accessDenied) return accessDenied

    const [history, amendments] = await Promise.all([
      ContractService.getRenewalHistory(id),
      ContractAmendmentService.listByContract(id),
    ])

    return NextResponse.json({
      success: true,
      chain: history,
      amendments,
      totalRenewals: history.length - 1,
      totalAmendments: amendments.length,
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
