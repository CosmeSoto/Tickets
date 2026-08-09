import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractAlertService } from '@/lib/services/contract-alert.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/contracts/expiring
 * Obtiene lista de contratos próximos a vencer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const denied = await requireInventoryModuleAccess(session.user)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId') || undefined
    const daysParam = searchParams.get('days')
    const days = daysParam != null ? parseInt(daysParam, 10) : undefined

    const contracts = await ContractAlertService.getExpiringContracts(familyId, days)

    return NextResponse.json(contracts)
  } catch (error) {
    console.error('Error obteniendo contratos próximos a vencer:', error)
    return NextResponse.json({ error: 'Error al obtener contratos' }, { status: 500 })
  }
}
