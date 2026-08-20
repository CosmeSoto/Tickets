/**
 * GET /api/inventory/equipment-payments
 *
 * Listado global de facturas de adquisición de activos (pestaña "Activos" en /inventory/payments).
 *
 * Scope de familias por rol:
 *   Super Admin → sin restricción (undefined)
 *   Admin no-super → familia nativa + grants del módulo 'inventory'
 *   Gestor → solo grants del módulo 'inventory'
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentInvoiceService } from '@/lib/services/equipment-invoice.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'
import type { AcquisitionPaymentStatus } from '@/lib/services/equipment-invoice.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const denied = await requireInventoryModuleAccess(session.user)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || undefined) as AcquisitionPaymentStatus | undefined
    const familyId = searchParams.get('familyId') || undefined
    const search = searchParams.get('search') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)))
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
        return NextResponse.json({ invoices: [], total: 0, page, pageSize, totalPages: 0 })
      }
    }

    if (familyId && allowedFamilyIds && !allowedFamilyIds.includes(familyId)) {
      return NextResponse.json({ invoices: [], total: 0, page, pageSize, totalPages: 0 })
    }

    const result = await EquipmentInvoiceService.listGlobal({
      status,
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
    console.error('[GET /api/inventory/equipment-payments]', error)
    return NextResponse.json({ error: 'Error al listar facturas de activos' }, { status: 500 })
  }
}
