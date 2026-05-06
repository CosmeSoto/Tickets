import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ReportResponse, formatDate, toCSV, generateReportPDF } from '@/lib/inventory/report-utils'

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  DISCOUNT: 'Descuento de rol',
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
}

interface SalesRow {
  codigo: string
  equipo: string
  tipo: string
  serie: string
  comprador: string
  empresa: string
  ruc: string
  precioVenta: string
  precioCompra: string
  valorLibro: string
  resultado: string
  fechaVenta: string
  formaPago: string
  factura: string
  estado: string
  solicitadoPor: string
  aprobadoPor: string
}

function calcBookValue(
  purchasePrice: number | null,
  purchaseDate: Date | null,
  usefulLifeYears: number | null,
  residualValue: number | null,
  saleDate: Date
): number | null {
  if (!purchasePrice || !purchaseDate || !usefulLifeYears) return null
  const years = (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const depPerYear = (purchasePrice - (residualValue ?? 0)) / usefulLifeYears
  return Math.max(purchasePrice - depPerYear * years, residualValue ?? 0)
}

function fmtCurrency(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isSuperAdmin = (user as any).isSuperAdmin === true
    if (!isAdmin && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver este reporte' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const status = searchParams.get('status') || undefined
    const format = searchParams.get('format') || undefined

    const where: Record<string, unknown> = {}

    if (status && status !== 'all') {
      where.status = status
    }

    if (dateFrom || dateTo) {
      where.saleDate = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59') } : {}),
      }
    }

    const sales = await prisma.equipment_sales.findMany({
      where,
      include: {
        equipment: {
          select: {
            code: true,
            brand: true,
            model: true,
            serialNumber: true,
            purchasePrice: true,
            purchaseDate: true,
            usefulLifeYears: true,
            residualValue: true,
            type: { select: { name: true } },
          },
        },
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { saleDate: 'desc' },
    })

    const rows: SalesRow[] = sales.map(s => {
      const bookValue = calcBookValue(
        s.equipment.purchasePrice,
        s.equipment.purchaseDate,
        s.equipment.usefulLifeYears,
        s.equipment.residualValue,
        s.saleDate
      )
      const profit = bookValue !== null ? s.salePrice - bookValue : null

      return {
        codigo: s.equipment.code,
        equipo: `${s.equipment.brand} ${s.equipment.model}`,
        tipo: s.equipment.type.name,
        serie: s.equipment.serialNumber,
        comprador: s.buyerName,
        empresa: s.buyerCompany ?? '—',
        ruc: s.buyerIdNumber ?? '—',
        precioVenta: fmtCurrency(s.salePrice),
        precioCompra: fmtCurrency(s.equipment.purchasePrice),
        valorLibro: fmtCurrency(bookValue),
        resultado:
          profit !== null ? (profit >= 0 ? `+${fmtCurrency(profit)}` : fmtCurrency(profit)) : '—',
        fechaVenta: formatDate(s.saleDate),
        formaPago: s.paymentMethod ? (PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod) : '—',
        factura: s.invoiceNumber ?? '—',
        estado: STATUS_LABELS[s.status] ?? s.status,
        solicitadoPor: s.requestedBy.name,
        aprobadoPor: s.approvedBy?.name ?? '—',
      }
    })

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const approved = sales.filter(s => s.status === 'APPROVED')
    const totalRevenue = approved.reduce((sum, s) => sum + s.salePrice, 0)
    const totalProfit = approved.reduce((sum, s) => {
      const bv = calcBookValue(
        s.equipment.purchasePrice,
        s.equipment.purchaseDate,
        s.equipment.usefulLifeYears,
        s.equipment.residualValue,
        s.saleDate
      )
      return bv !== null ? sum + (s.salePrice - bv) : sum
    }, 0)

    const summary = [
      {
        title: 'Ventas aprobadas',
        value: approved.length,
        description: `${sales.filter(s => s.status === 'PENDING').length} pendientes de aprobación`,
      },
      {
        title: 'Ingresos por ventas',
        value: fmtCurrency(totalRevenue),
        description: 'Total recaudado en ventas aprobadas',
      },
      {
        title: 'Resultado financiero',
        value: fmtCurrency(totalProfit),
        description: totalProfit >= 0 ? 'Ganancia vs valor libro' : 'Pérdida vs valor libro',
      },
    ]

    const response: ReportResponse<SalesRow> = {
      summary,
      data: rows,
      filters: { dateFrom: dateFrom ?? null, dateTo: dateTo ?? null, status: status ?? null },
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    if (format === 'csv') {
      const csvRows = rows.map(r => ({
        Código: r.codigo,
        Equipo: r.equipo,
        Tipo: r.tipo,
        'N° Serie': r.serie,
        Comprador: r.comprador,
        Empresa: r.empresa,
        'RUC/Cédula': r.ruc,
        'Precio Venta': r.precioVenta,
        'Precio Compra': r.precioCompra,
        'Valor Libro': r.valorLibro,
        Resultado: r.resultado,
        'Fecha Venta': r.fechaVenta,
        'Forma Pago': r.formaPago,
        Factura: r.factura,
        Estado: r.estado,
        'Solicitado Por': r.solicitadoPor,
        'Aprobado Por': r.aprobadoPor,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-ventas.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = [
        'Código',
        'Equipo',
        'Comprador',
        'Precio Venta',
        'Resultado',
        'Fecha',
        'Estado',
      ]
      const pdfRows = rows.map(r => [
        r.codigo,
        r.equipo,
        r.comprador,
        r.precioVenta,
        r.resultado,
        r.fechaVenta,
        r.estado,
      ])
      const pdfBuffer = await generateReportPDF('¿Qué se ha vendido?', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-ventas.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/sales:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
