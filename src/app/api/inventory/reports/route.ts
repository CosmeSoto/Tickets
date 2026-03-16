import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { InventoryReportService } from '@/lib/services/inventory-report.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/inventory/reports
 * Genera reportes de inventario según el tipo solicitado
 * Solo ADMIN puede acceder
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para ver reportes' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const reportType = searchParams.get('type') || 'equipment-summary'
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const days = parseInt(searchParams.get('days') || '30')

    let data: any

    switch (reportType) {
      case 'equipment-summary':
        data = await InventoryReportService.getEquipmentSummaryReport({ startDate, endDate, departmentId })
        break
      case 'assignments':
        data = await InventoryReportService.getAssignmentsReport({ startDate, endDate })
        break
      case 'pending-acts':
        data = await InventoryReportService.getPendingActsReport()
        break
      case 'maintenance-costs':
        data = await InventoryReportService.getMaintenanceCostsReport({ startDate, endDate })
        break
      case 'consumable-usage':
        data = await InventoryReportService.getConsumableUsageReport({ startDate, endDate })
        break
      case 'license-expiration':
        data = await InventoryReportService.getLicenseExpirationReport(days)
        break
      case 'inventory-value':
        data = await InventoryReportService.getInventoryValueReport()
        break
      case 'rental-equipment':
        data = await InventoryReportService.getRentalEquipmentReport()
        break
      default:
        return NextResponse.json({ error: 'Tipo de reporte no válido' }, { status: 400 })
    }

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.INVENTORY_REPORT_GENERATED,
      entityType: 'inventory',
      entityId: reportType,
      userId: session.user.id,
      details: { reportType, startDate, endDate, departmentId },
    })

    return NextResponse.json({ reportType, data, generatedAt: new Date().toISOString() })
  } catch (error) {
    console.error('Error en GET /api/inventory/reports:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
