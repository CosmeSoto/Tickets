import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  ContractPaymentService,
  PaymentsAlreadyExistError,
} from '@/lib/services/contract-payment.service'
import { prisma } from '@/lib/prisma'
import {
  assertContractAccess,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { amountDueOnDate, linesHavePricedItems } from '@/lib/contracts/line-billing'

/**
 * POST /api/inventory/contracts/[id]/payments/generate
 * Genera pagos programados automáticamente según el ciclo de facturación del contrato
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertContractAccess(toInventoryAccessUser(session.user), id, 'write')
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    // Obtener contrato
    const contract = await prisma.contracts.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        billingCycle: true,
        monthlyCost: true,
        totalValue: true,
        currency: true,
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            serviceStartDate: true,
            serviceEndDate: true,
          },
        },
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

    const headerAmount =
      contract.billingCycle === 'ONE_TIME' ? contract.totalValue || 0 : contract.monthlyCost || 0

    if (!linesHavePricedItems(contract.lines) && headerAmount <= 0) {
      return NextResponse.json(
        {
          error:
            'Indica un costo en el contrato o precios en las líneas (equipos) para generar pagos.',
        },
        { status: 400 }
      )
    }

    const payments = await ContractPaymentService.generateScheduledPayments({
      contractId: id,
      startDate: contract.startDate,
      endDate: contract.endDate,
      billingCycle: contract.billingCycle,
      amount: headerAmount,
      amountForDueDate: due => amountDueOnDate(contract.lines, contract, due),
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
    if (error instanceof PaymentsAlreadyExistError) {
      return NextResponse.json(
        { error: error.message, code: 'PAYMENTS_ALREADY_EXIST' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar pagos' },
      { status: 500 }
    )
  }
}
