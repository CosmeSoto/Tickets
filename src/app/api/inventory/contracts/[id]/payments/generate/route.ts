import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/inventory/contracts/[id]/payments/generate
 * Genera pagos programados automáticamente según el ciclo de facturación del contrato
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener contrato
    const contract = await prisma.contracts.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        billingCycle: true,
        monthlyCost: true,
        totalValue: true,
        currency: true,
      },
    })

    if (!contract) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    }

    if (!contract.startDate || !contract.endDate) {
      return NextResponse.json(
        { error: 'El contrato debe tener fechas de inicio y fin' },
        { status: 400 }
      )
    }

    // Determinar monto del pago
    let amount: number
    if (contract.billingCycle === 'ONE_TIME') {
      amount = contract.totalValue || 0
    } else {
      amount = contract.monthlyCost || 0
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'El contrato debe tener un monto válido (monthlyCost o totalValue)' },
        { status: 400 }
      )
    }

    // Generar pagos
    const payments = await ContractPaymentService.generateScheduledPayments({
      contractId: params.id,
      startDate: contract.startDate,
      endDate: contract.endDate,
      billingCycle: contract.billingCycle,
      amount,
      currency: contract.currency,
      createdBy: session.user.id,
    })

    return NextResponse.json(
      {
        success: true,
        paymentsGenerated: payments.length,
        payments,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error generando pagos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar pagos' },
      { status: 500 }
    )
  }
}
