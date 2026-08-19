import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/payments
 * Listado operativo de cuotas (todas las familias visibles del gestor).
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
    const status = searchParams.get('status') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const search = searchParams.get('search') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    let allowedFamilyIds: string[] | undefined
    if (!isSuperAdmin) {
      if (session.user.role === 'ADMIN') {
        const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
        const scope = await getAdminFamilyScope(session.user.id, false)
        allowedFamilyIds = scope.familyIds ?? undefined
      } else {
        const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
        allowedFamilyIds = await getUserModuleFamilyGrantIds(session.user.id, 'inventory')
        if (allowedFamilyIds.length === 0) {
          return NextResponse.json({ payments: [], total: 0, page, pageSize, totalPages: 0 })
        }
      }
    }

    if (familyId && allowedFamilyIds && !allowedFamilyIds.includes(familyId)) {
      return NextResponse.json({ payments: [], total: 0, page, pageSize, totalPages: 0 })
    }

    const result = await ContractPaymentService.list({
      status: status as 'SCHEDULED' | 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED' | undefined,
      familyId,
      allowedFamilyIds,
      search,
      page,
      pageSize,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/inventory/payments]', error)
    return NextResponse.json({ error: 'Error al listar pagos' }, { status: 500 })
  }
}
