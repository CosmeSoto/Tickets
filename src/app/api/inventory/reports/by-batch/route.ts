import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryReportService } from '@/lib/services/inventory-report.service'
import { requireInventoryModuleAccess } from '@/lib/inventory/require-inventory-api'

/**
 * GET /api/inventory/reports/by-batch
 * Obtiene reportes de inventario agrupados por lote
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
    const batchId = searchParams.get('batchId') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const supplierId = searchParams.get('supplierId') || undefined

    const data = await InventoryReportService.getEquipmentByBatch({
      familyId,
      batchId,
      supplierId,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error generando reporte por lote:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
