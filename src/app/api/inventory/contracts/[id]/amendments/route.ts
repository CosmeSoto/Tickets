import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractAmendmentService } from '@/lib/services/contract-amendment.service'
import { createContractAmendmentSchema } from '@/lib/validations/contract-amendment'
import { requireContractAccess } from '@/lib/inventory/require-inventory-api'
import { ZodError } from 'zod'

/** GET /api/inventory/contracts/[id]/amendments */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await context.params
  const accessDenied = await requireContractAccess(session.user, id, 'read')
  if (accessDenied) return accessDenied

  const amendments = await ContractAmendmentService.listByContract(id)
  return NextResponse.json({ amendments })
}

/** POST /api/inventory/contracts/[id]/amendments */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    const accessDenied = await requireContractAccess(session.user, id, 'write')
    if (accessDenied) return accessDenied

    const body = createContractAmendmentSchema.parse(await request.json())
    const amendment = await ContractAmendmentService.create(id, body, session.user.id)

    return NextResponse.json(amendment, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Datos inválidos', details: error.errors },
        { status: 422 }
      )
    }
    console.error('[POST contract amendments]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar adendum' },
      { status: 400 }
    )
  }
}
