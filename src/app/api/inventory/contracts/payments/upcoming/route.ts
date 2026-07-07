import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/contracts/payments/upcoming
 * Obtiene pagos próximos a vencer
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
    const days = parseInt(searchParams.get('days') || '30')
    const familyId = searchParams.get('familyId') || undefined

    const payments = await ContractPaymentService.getUpcomingPayments(days, familyId)

    return NextResponse.json(payments)
  } catch (error) {
    console.error('Error obteniendo pagos próximos:', error)
    return NextResponse.json({ error: 'Error al obtener pagos próximos' }, { status: 500 })
  }
}
