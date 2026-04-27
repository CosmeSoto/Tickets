import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InventoryReportService } from '@/lib/services/inventory-report.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { withReportCache } from '@/lib/api-cache'

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
    const reportParams = { startDate: startDate?.toISOString(), endDate: endDate?.toISOString(), departmentId, days }

    switch (reportType) {
      case 'equipment-summary':
        data = await withReportCache('inventory:equipment-summary', reportParams,
          () => InventoryReportService.getEquipmentSummaryReport({ startDate, endDate, departmentId }), 600)
        break
      case 'assignments':
        data = await withReportCache('inventory:assignments', reportParams,
          () => InventoryReportService.getAssignmentsReport({ startDate, endDate }), 300)
        break
      case 'pending-acts':
        data = await withReportCache('inventory:pending-acts', {},
          () => InventoryReportService.getPendingActsReport(), 120)
        break
      case 'maintenance-costs':
        data = await withReportCache('inventory:maintenance-costs', reportParams,
          () => InventoryReportService.getMaintenanceCostsReport({ startDate, endDate }), 600)
        break
      case 'consumable-usage':
        data = await withReportCache('inventory:consumable-usage', reportParams,
          () => InventoryReportService.getConsumableUsageReport({ startDate, endDate }), 300)
        break
      case 'license-expiration':
        data = await withReportCache('inventory:license-expiration', { days },
          () => InventoryReportService.getLicenseExpirationReport(days), 600)
        break
      case 'inventory-value':
        data = await withReportCache('inventory:inventory-value', {},
          () => InventoryReportService.getInventoryValueReport(), 900)
        break
      case 'rental-equipment':
        data = await withReportCache('inventory:rental-equipment', {},
          () => InventoryReportService.getRentalEquipmentReport(), 600)
        break
      case 'acts-history':
        data = await withReportCache('inventory:acts-history', reportParams,
          () => getActsHistoryReport({ startDate, endDate }), 300)
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

async function getActsHistoryReport({ startDate, endDate }: { startDate?: Date; endDate?: Date }) {
  const dateFilter = startDate || endDate
    ? { createdAt: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
    : {}

  const [deliveryActs, returnActs, decommissionRequests] = await Promise.all([
    prisma.delivery_acts.findMany({
      where: dateFilter,
      include: {
        assignment: {
          include: {
            equipment: { select: { id: true, brand: true, model: true, code: true } },
            receiver: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.return_acts.findMany({
      where: dateFilter,
      include: {
        assignment: {
          include: {
            equipment: { select: { id: true, brand: true, model: true, code: true } },
            receiver: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.decommission_requests.findMany({
      where: dateFilter,
      include: {
        equipment: { select: { id: true, brand: true, model: true, code: true } },
        requester: { select: { name: true } },
        act: { select: { folio: true, approvedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const rows = [
    ...deliveryActs.map(a => ({
      tipo: 'Acta de Entrega',
      folio: a.folio,
      equipo: a.assignment?.equipment
        ? `${a.assignment.equipment.brand} ${a.assignment.equipment.model} (${a.assignment.equipment.code})`
        : '—',
      equipoId: a.assignment?.equipment?.id ?? null,
      persona: a.assignment?.receiver?.name ?? '—',
      estado: a.status,
      fecha: a.createdAt.toISOString(),
      hasPdf: !!a.pdfPath,
      actId: a.id,
    })),
    ...returnActs.map(a => ({
      tipo: 'Acta de Devolución',
      folio: a.folio,
      equipo: a.assignment?.equipment
        ? `${a.assignment.equipment.brand} ${a.assignment.equipment.model} (${a.assignment.equipment.code})`
        : '—',
      equipoId: a.assignment?.equipment?.id ?? null,
      persona: a.assignment?.receiver?.name ?? '—',
      estado: a.status,
      fecha: a.createdAt.toISOString(),
      hasPdf: !!a.pdfPath,
      actId: a.id,
    })),
    ...decommissionRequests.map(r => ({
      tipo: 'Solicitud de Baja',
      folio: r.act?.folio ?? '—',
      equipo: r.equipment
        ? `${r.equipment.brand} ${r.equipment.model} (${r.equipment.code})`
        : '—',
      equipoId: r.equipment?.id ?? null,
      persona: r.requester?.name ?? '—',
      estado: r.status,
      fecha: r.createdAt.toISOString(),
      hasPdf: false,
      actId: r.act ? r.id : null,
    })),
  ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return {
    total: rows.length,
    byType: {
      delivery: deliveryActs.length,
      return: returnActs.length,
      decommission: decommissionRequests.length,
    },
    rows,
  }
}
