import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  ReportResponse,
  formatCurrency,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface FinancialRow {
  familia: string
  equiposActivos: number
  valorEquipos: string
  costoRentaMensual: string
  costoRentaAnual: string
  licencias: number
  valorLicencias: string
  materiales: number
  valorMateriales: string
  costoMantenimiento: string
  valorTotal: string
}

/**
 * GET /api/inventory/reports/financial-summary
 * Resumen financiero global — solo Super Admin
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (session.user.role !== 'ADMIN' || !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede ver el resumen financiero global' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || undefined
    const familyId = searchParams.get('familyId') || undefined

    // ── Obtener todas las familias ────────────────────────────────────────────
    const familiesWhere = familyId ? { id: familyId } : {}
    const families = await prisma.families.findMany({
      where: familiesWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const rows: FinancialRow[] = []

    for (const family of families) {
      // Equipos de esta familia
      const [equipmentStats, licenseStats, consumableStats, maintenanceStats] = await Promise.all([
        prisma.equipment.aggregate({
          where: {
            type: { familyId: family.id },
            status: { not: 'RETIRED' },
          },
          _count: true,
          _sum: { purchasePrice: true, rentalMonthlyCost: true },
        }),
        prisma.software_licenses.aggregate({
          where: { licenseType: { familyId: family.id } },
          _count: true,
          _sum: { cost: true },
        }),
        prisma.consumables.aggregate({
          where: { consumableType: { familyId: family.id } },
          _count: true,
          _sum: { costPerUnit: true },
        }),
        prisma.maintenance_records.aggregate({
          where: {
            equipment: { type: { familyId: family.id } },
            status: 'COMPLETED',
          },
          _sum: { cost: true },
        }),
      ])

      const rentalMensual = equipmentStats._sum.rentalMonthlyCost ?? 0
      const valorEquipos = equipmentStats._sum.purchasePrice ?? 0
      const valorLicencias = licenseStats._sum.cost ?? 0
      const valorMateriales = consumableStats._sum.costPerUnit ?? 0
      const costoMant = maintenanceStats._sum.cost ?? 0
      const valorTotal = valorEquipos + valorLicencias + valorMateriales

      rows.push({
        familia: family.name,
        equiposActivos: equipmentStats._count,
        valorEquipos: formatCurrency(valorEquipos),
        costoRentaMensual: formatCurrency(rentalMensual),
        costoRentaAnual: formatCurrency(rentalMensual * 12),
        licencias: licenseStats._count,
        valorLicencias: formatCurrency(valorLicencias),
        materiales: consumableStats._count,
        valorMateriales: formatCurrency(valorMateriales),
        costoMantenimiento: formatCurrency(costoMant),
        valorTotal: formatCurrency(valorTotal),
      })
    }

    // ── Totales globales ──────────────────────────────────────────────────────
    const [globalEquipment, globalLicenses, globalConsumables, globalMaintenance] = await Promise.all([
      prisma.equipment.aggregate({
        where: { status: { not: 'RETIRED' } },
        _count: true,
        _sum: { purchasePrice: true, rentalMonthlyCost: true },
      }),
      prisma.software_licenses.aggregate({
        _count: true,
        _sum: { cost: true },
      }),
      prisma.consumables.aggregate({
        _count: true,
        _sum: { costPerUnit: true },
      }),
      prisma.maintenance_records.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { cost: true },
      }),
    ])

    const totalValorActivos =
      (globalEquipment._sum.purchasePrice ?? 0) +
      (globalLicenses._sum.cost ?? 0) +
      (globalConsumables._sum.costPerUnit ?? 0)

    const totalRentaMensual = globalEquipment._sum.rentalMonthlyCost ?? 0

    const summary = [
      {
        title: 'Valor total del inventario',
        value: formatCurrency(totalValorActivos),
        description: `Equipos + licencias + materiales de ${families.length} familia${families.length !== 1 ? 's' : ''}`,
      },
      {
        title: 'Costo de renta mensual',
        value: formatCurrency(totalRentaMensual),
        description: `${formatCurrency(totalRentaMensual * 12)} anuales en equipos arrendados`,
      },
      {
        title: 'Costo total de mantenimientos',
        value: formatCurrency(globalMaintenance._sum.cost ?? 0),
        description: 'Suma de todos los mantenimientos completados',
      },
    ]

    const response: ReportResponse<FinancialRow> = {
      summary,
      data: rows,
      filters: { familyId: familyId ?? null },
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Familia: r.familia,
        'Equipos Activos': r.equiposActivos,
        'Valor Equipos': r.valorEquipos,
        'Renta Mensual': r.costoRentaMensual,
        'Renta Anual': r.costoRentaAnual,
        Licencias: r.licencias,
        'Valor Licencias': r.valorLicencias,
        Materiales: r.materiales,
        'Valor Materiales': r.valorMateriales,
        'Costo Mantenimiento': r.costoMantenimiento,
        'Valor Total': r.valorTotal,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-financiero-global.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Familia', 'Equipos', 'Valor Equipos', 'Renta Mensual', 'Licencias', 'Valor Total']
      const pdfRows = rows.map((r) => [
        r.familia,
        String(r.equiposActivos),
        r.valorEquipos,
        r.costoRentaMensual,
        String(r.licencias),
        r.valorTotal,
      ])
      const pdfBuffer = await generateReportPDF('Resumen Financiero Global', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-financiero-global.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/financial-summary:', error)
    return NextResponse.json({ error: 'Error al generar reporte financiero' }, { status: 500 })
  }
}
