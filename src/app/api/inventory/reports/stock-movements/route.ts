import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  formatDate,
  formatCurrency,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface StockMovementRow {
  fecha: string
  consumible: string
  familia: string
  tipo: string
  cantidad: number
  unidad: string
  motivo: string
  usuario: string
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
    const consumableId = searchParams.get('consumableId') || undefined
    const type = searchParams.get('type') || undefined
    const format = searchParams.get('format') || undefined

    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

    // Construir where
    const where: Record<string, unknown> = {}

    if (consumableId) {
      where.consumableId = consumableId
    }

    if (type) {
      where.type = type
    }

    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    // Filtro de familias para gestores
    if (accessibleFamilyIds !== null) {
      where.consumable = {
        consumableType: { familyId: { in: accessibleFamilyIds } },
      }
    }

    const movements = await prisma.stock_movements.findMany({
      where,
      include: {
        consumable: {
          select: {
            name: true,
            consumableType: {
              select: {
                family: { select: { name: true } },
              },
            },
            unitOfMeasure: { select: { symbol: true } },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const rows: StockMovementRow[] = movements.map((m) => ({
      fecha: formatDate(m.createdAt),
      consumible: m.consumable.name,
      familia: m.consumable.consumableType?.family?.name ?? '—',
      tipo: m.type === 'ENTRY' ? 'Entrada' : m.type === 'EXIT' ? 'Salida' : 'Ajuste',
      cantidad: m.quantity,
      unidad: m.consumable.unitOfMeasure?.symbol ?? '',
      motivo: m.reason ?? '—',
      usuario: m.user.name ?? '—',
    }))

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const totalEntradas = movements.filter((m) => m.type === 'ENTRY').reduce((s, m) => s + m.quantity, 0)
    const totalSalidas = movements.filter((m) => m.type === 'EXIT').reduce((s, m) => s + m.quantity, 0)
    const uniqueConsumables = new Set(movements.map((m) => m.consumableId)).size

    const summary = [
      {
        title: 'Total de movimientos',
        value: movements.length,
        description: `${movements.filter((m) => m.type === 'ENTRY').length} entradas, ${movements.filter((m) => m.type === 'EXIT').length} salidas`,
      },
      {
        title: 'Unidades consumidas (salidas)',
        value: totalSalidas,
        description: `vs ${totalEntradas} unidades ingresadas`,
      },
      {
        title: 'Materiales distintos movidos',
        value: uniqueConsumables,
        description: 'Número de materiales MRO con al menos un movimiento',
      },
    ]

    const filters: Record<string, unknown> = {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      consumableId: consumableId ?? null,
      type: type ?? null,
    }

    const response: ReportResponse<StockMovementRow> = {
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
        Consumible: r.consumible,
        Familia: r.familia,
        Tipo: r.tipo,
        Cantidad: r.cantidad,
        Unidad: r.unidad,
        Motivo: r.motivo,
        Usuario: r.usuario,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-movimientos-stock.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Fecha', 'Consumible', 'Familia', 'Tipo', 'Cantidad', 'Unidad', 'Usuario']
      const pdfRows = rows.map((r) => [
        r.fecha,
        r.consumible,
        r.familia,
        r.tipo,
        String(r.cantidad),
        r.unidad,
        r.usuario,
      ])
      const pdfBuffer = await generateReportPDF('¿Qué se ha consumido? — Movimientos de Stock', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-movimientos-stock.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/stock-movements:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
