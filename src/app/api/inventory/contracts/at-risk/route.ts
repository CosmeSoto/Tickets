import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { ContractService } from '@/lib/services/contract-service'

/** GET /api/inventory/contracts/at-risk — suscripciones con datos incompletos o sin custodio */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hasAccess =
    session.user.role === 'ADMIN' ||
    (await canManageInventory(session.user.id, session.user.role))
  if (!hasAccess) return inventoryForbidden()

  const familyId = request.nextUrl.searchParams.get('familyId') ?? undefined
  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

  const items = await ContractService.listAtRisk({
    familyId,
    userId: session.user.id,
    userRole: session.user.role,
    isSuperAdmin,
  })

  return NextResponse.json({ items, total: items.length })
}
