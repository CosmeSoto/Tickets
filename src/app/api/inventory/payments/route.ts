import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractPaymentService } from '@/lib/services/contract-payment.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/payments
 *
 * Scope de familias por rol:
 *   Super Admin → sin restricción (undefined)
 *   Admin no-super → familia nativa + grants del módulo 'inventory'
 *   Gestor (canManageInventory, rol ≠ ADMIN) → solo grants del módulo 'inventory'
 *
 * Query params soportados:
 *   status, familyId, search, page, pageSize, fromDate, toDate
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
    const fromDateStr = searchParams.get('fromDate') || undefined
    const toDateStr = searchParams.get('toDate') || undefined
    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined
    const toDate = toDateStr ? new Date(toDateStr) : undefined

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    let allowedFamilyIds: string[] | undefined

    if (!isSuperAdmin) {
      // Scope correcto para inventario: familia nativa + grants del módulo 'inventory'
      const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
      allowedFamilyIds = await getModuleFamilyIds(session.user.id, 'inventory')

      if (allowedFamilyIds.length === 0) {
        return NextResponse.json({ payments: [], total: 0, page, pageSize, totalPages: 0 })
      }
    }

    // Si el filtro de familia solicitado está fuera del scope, devolver vacío
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
      fromDate,
      toDate,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/inventory/payments]', error)
    return NextResponse.json({ error: 'Error al listar pagos' }, { status: 500 })
  }
}
