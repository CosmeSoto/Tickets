import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'

/**
 * POST /api/inventory/contracts/[id]/renew
 * Renueva un contrato existente creando uno nuevo vinculado
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { newStartDate, newEndDate, updateTerms } = body

    // Validaciones
    if (!newStartDate || !newEndDate) {
      return NextResponse.json({ error: 'Fechas de inicio y fin son requeridas' }, { status: 400 })
    }

    const startDate = new Date(newStartDate)
    const endDate = new Date(newEndDate)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Fechas inválidas' }, { status: 400 })
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'La fecha de inicio debe ser anterior a la fecha de fin' },
        { status: 400 }
      )
    }

    // Renovar contrato
    const renewedContract = await ContractService.renewContract({
      contractId: params.id,
      newStartDate: startDate,
      newEndDate: endDate,
      updateTerms,
      userId: session.user.id,
    })

    return NextResponse.json(renewedContract, { status: 201 })
  } catch (error) {
    console.error('Error renovando contrato:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al renovar contrato',
      },
      { status: 500 }
    )
  }
}
