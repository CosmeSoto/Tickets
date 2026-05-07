import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryReportService } from '@/lib/services/inventory-report.service'

/**
 * GET /api/inventory/reports/by-model
 * Obtiene reportes de inventario agrupados por modelo
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'inventory'
    const modelId = searchParams.get('modelId') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    const user = session.user as any

    let data: any

    switch (reportType) {
      case 'inventory':
        data = await InventoryReportService.getEquipmentByModel({
          familyId,
          modelId,
          userId: user.id,
          userRole: user.role,
        })
        break

      case 'maintenance':
        data = await InventoryReportService.getMaintenanceByModel({
          familyId,
          modelId,
          startDate,
          endDate,
        })
        break

      default:
        return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error generando reporte por modelo:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
