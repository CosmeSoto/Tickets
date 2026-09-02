/**
 * GET /api/inventory/equipment-payments
 *
 * Listado global de facturas de adquisición de activos (pestaña "Activos" en
 * /inventory/payments) — mezcla facturas de Equipos (equipment_invoices) y de
 * Licencias (license_invoices), cada una etiquetada con `assetKind`. El
 * nombre de la ruta quedó de cuando solo cubría equipos; se conserva para no
 * romper el único consumidor (la propia página de Pagos).
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
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'
import type { AcquisitionPaymentStatus } from '@/lib/services/equipment-invoice.service'

const STATUS_SORT: Record<string, number> = { OVERDUE: 0, PENDING: 1, PAID: 2, CANCELLED: 3 }

function sortInvoices(
  a: { status: string; dueDate: Date | null },
  b: { status: string; dueDate: Date | null }
) {
  const s = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9)
  if (s !== 0) return s
  const da = a.dueDate ? a.dueDate.getTime() : Infinity
  const db = b.dueDate ? b.dueDate.getTime() : Infinity
  return da - db
}

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
        return NextResponse.json({ invoices: [], total: 0, page, pageSize, totalPages: 0 })
      }
    }

    if (familyId && allowedFamilyIds && !allowedFamilyIds.includes(familyId)) {
      return NextResponse.json({ invoices: [], total: 0, page, pageSize, totalPages: 0 })
    }

    // El front pide siempre pageSize=500 y pagina del lado del cliente (igual
    // que la pestaña Contratos) — se trae hasta pageSize de cada tabla y se
    // mezcla, en vez de paginar cada modelo por separado (Prisma no puede
    // hacer un UNION entre equipment_invoices y license_invoices).
    const [equipmentResult, licenseResult] = await Promise.all([
      EquipmentInvoiceService.listGlobal({
        status,
        familyId,
        allowedFamilyIds,
        search,
        page: 1,
        pageSize,
        fromDate,
        toDate,
      }),
      LicenseInvoiceService.listGlobal({
        status,
        familyId,
        allowedFamilyIds,
        search,
        fromDate,
        toDate,
        take: pageSize,
      }),
    ])

    const merged = [
      ...equipmentResult.invoices.map(inv => ({ ...inv, assetKind: 'EQUIPMENT' as const })),
      ...licenseResult.invoices.map(inv => ({ ...inv, assetKind: 'LICENSE' as const })),
    ]
      .sort(sortInvoices)
      .slice(0, pageSize)

    const total = equipmentResult.total + licenseResult.total

    return NextResponse.json({
      invoices: merged,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('[GET /api/inventory/equipment-payments]', error)
    return NextResponse.json({ error: 'Error al listar facturas de activos' }, { status: 500 })
  }
}
