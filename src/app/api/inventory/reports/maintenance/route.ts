import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  MAINTENANCE_STATUS_ES,
  formatDate,
  formatCurrency,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface MaintenanceRow {
  fecha: string
  equipo: string
  codigoEquipo: string
  familia: string
  tipo: string
  estado: string
  descripcion: string
  tecnico: string
  costo: string
  fechaCompletado: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const hasAccess = isAdmin || (await canManageInventory(user.id, user.role))
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes permiso para ver reportes' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const equipmentId = searchParams.get('equipmentId') || undefined
    const status = searchParams.get('status') || undefined
    const format = searchParams.get('format') || undefined

    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

    // Construir where
    const where: Record<string, unknown> = {}

    if (equipmentId) {
      where.equipmentId = equipmentId
    }

    if (status) {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    if (accessibleFamilyIds !== null) {
      where.equipment = { type: { familyId: { in: accessibleFamilyIds } } }
    }

    const records = await prisma.maintenance_records.findMany({
      where,
      include: {
        equipment: {
          select: {
            code: true,
            brand: true,
            model: true,
            type: { select: { family: { select: { name: true } } } },
          },
        },
        technician: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    })

    const rows: MaintenanceRow[] = records.map((r) => ({
      fecha: formatDate(r.date),
      equipo: `${r.equipment.brand} ${r.equipment.model}`,
      codigoEquipo: r.equipment.code,
      familia: r.equipment.type?.family?.name ?? '—',
      tipo: r.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo',
      estado: MAINTENANCE_STATUS_ES[r.status] ?? r.status,
      descripcion: r.description,
      tecnico: r.technician?.name ?? '—',
      costo: formatCurrency(r.cost),
      fechaCompletado: r.completedAt ? formatDate(r.completedAt) : '—',
    }))

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const totalMantenimientos = rows.length
    const completados = records.filter((r) => r.status === 'COMPLETED').length
    const costoTotal = records.reduce((s, r) => s + (r.cost ?? 0), 0)

    const summary = [
      {
        title: 'Total de mantenimientos',
        value: totalMantenimientos,
        description: `${completados} completados, ${totalMantenimientos - completados} en proceso o pendientes`,
      },
      {
        title: 'Costo total',
        value: formatCurrency(costoTotal),
        description: 'Suma de costos de todos los mantenimientos en el período',
      },
      {
        title: 'Tasa de completado',
        value: totalMantenimientos > 0 ? `${Math.round((completados / totalMantenimientos) * 100)}%` : '0%',
        description: `${completados} de ${totalMantenimientos} mantenimientos completados`,
      },
    ]

    const filters: Record<string, unknown> = {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      equipmentId: equipmentId ?? null,
      status: status ?? null,
    }

    const response: ReportResponse<MaintenanceRow> = {
      summary,
      data: rows,
      filters,
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Fecha: r.fecha,
        Equipo: r.equipo,
        Código: r.codigoEquipo,
        Familia: r.familia,
        Tipo: r.tipo,
        Estado: r.estado,
        Descripción: r.descripcion,
        Técnico: r.tecnico,
        Costo: r.costo,
        'Fecha Completado': r.fechaCompletado,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-mantenimientos.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Fecha', 'Equipo', 'Código', 'Familia', 'Tipo', 'Estado', 'Técnico', 'Costo']
      const pdfRows = rows.map((r) => [
        r.fecha,
        r.equipo,
        r.codigoEquipo,
        r.familia,
        r.tipo,
        r.estado,
        r.tecnico,
        r.costo,
      ])
      const pdfBuffer = await generateReportPDF('Historial de Mantenimientos', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-mantenimientos.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/maintenance:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
