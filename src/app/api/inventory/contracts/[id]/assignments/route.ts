import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageAsset, canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { assertContractViewAccess } from '@/lib/contracts/access'
import { ContractService } from '@/lib/services/contract-service'
import { ContractAssignmentService } from '@/lib/services/contract-assignment.service'

/** GET /api/inventory/contracts/[id]/assignments */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hasAccess =
    session.user.role === 'ADMIN' ||
    session.user.role === 'CLIENT' ||
    (await canManageInventory(session.user.id, session.user.role))
  if (!hasAccess) return inventoryForbidden()

  const { id } = await context.params

  try {
    await assertContractViewAccess(
      {
        id: session.user.id,
        role: session.user.role,
        isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin,
      },
      id
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sin permiso' },
      { status: 403 }
    )
  }

  const contract = await ContractService.getById(id)
  if (!contract) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
  if (session.user.role !== 'CLIENT' && !isSuperAdmin && contract.familyId) {
    const allowed = await canManageAsset(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      contract.familyId
    )
    if (!allowed) return inventoryForbidden()
  }

  const assignments = await ContractAssignmentService.listByContract(id)
  const active = assignments.find(a => a.isActive) ?? null

  return NextResponse.json({ assignments, active })
}
