import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import {
  requireContractAccess,
  requireInventoryModuleAccess,
} from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/contracts/payments/stats
 * Obtiene estadísticas de pagos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contractId') || undefined

    if (contractId) {
      const accessDenied = await requireContractAccess(session.user, contractId, 'read')
      if (accessDenied) return accessDenied
    } else {
      const denied = await requireInventoryModuleAccess(session.user)
      if (denied) return denied
    }

    const stats = await ContractPaymentService.getStats(contractId)

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error obteniendo estadísticas de pagos:', error)
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 })
  }
}
