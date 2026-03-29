import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  EQUIPMENT_STATUS_ES,
  CONSUMABLE_STATUS_ES,
  formatDate,
  formatCurrency,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface SummaryRow {
  familia: string
  subtipo: string
  cantidad: number
  valorTotal: string
  estado: string
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
    const familyId = searchParams.get('familyId') || undefined
    const subtype = searchParams.get('subtype') || undefined
    const format = searchParams.get('format') || undefined

    // Obtener familias accesibles
    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

    // Construir filtro de familias para equipment_types
    let familyFilter: string[] | undefined
    if (accessibleFamilyIds !== null) {
      familyFilter = familyId
        ? accessibleFamilyIds.includes(familyId)
          ? [familyId]
          : []
        : accessibleFamilyIds
    } else if (familyId) {
      familyFilter = [familyId]
    }

    // ── Equipos ──────────────────────────────────────────────────────────────
    const equipmentWhere: Record<string, unknown> = {}
    if (familyFilter) {
      equipmentWhere.type = { familyId: { in: familyFilter } }
    }

    const equipmentData = await prisma.equipment.findMany({
      where: equipmentWhere,
      select: {
        status: true,
        purchasePrice: true,
        type: {
          select: {
            family: { select: { name: true } },
          },
        },
      },
    })

    // ── Consumibles ───────────────────────────────────────────────────────────
    const consumableWhere: Record<string, unknown> = {}
    if (familyFilter) {
      consumableWhere.consumableType = { familyId: { in: familyFilter } }
    }

    const consumableData = await prisma.consumables.findMany({
      where: consumableWhere,
      select: {
        status: true,
        costPerUnit: true,
        currentStock: true,
        consumableType: {
          select: {
            family: { select: { name: true } },
          },
        },
      },
    })

    // ── Licencias ─────────────────────────────────────────────────────────────
    const licenseWhere: Record<string, unknown> = {}
    if (familyFilter) {
      licenseWhere.licenseType = { familyId: { in: familyFilter } }
    }

    const licenseData = await prisma.software_licenses.findMany({
      where: licenseWhere,
      select: {
        cost: true,
        licenseType: {
          select: {
            family: { select: { name: true } },
          },
        },
      },
    })

    // ── Construir filas del reporte ───────────────────────────────────────────
    const rows: SummaryRow[] = []

    // Agrupar equipos por familia y estado
    const equipByFamilyStatus = new Map<string, { count: number; value: number }>()
    for (const eq of equipmentData) {
      const familia = eq.type?.family?.name ?? 'Sin familia'
      const estado = EQUIPMENT_STATUS_ES[eq.status] ?? eq.status
      const key = `${familia}||EQUIPMENT||${estado}`
      const prev = equipByFamilyStatus.get(key) ?? { count: 0, value: 0 }
      equipByFamilyStatus.set(key, {
        count: prev.count + 1,
        value: prev.value + (eq.purchasePrice ?? 0),
      })
    }
    for (const [key, { count, value }] of equipByFamilyStatus) {
      const [familia, , estado] = key.split('||')
      if (!subtype || subtype === 'EQUIPMENT') {
        rows.push({ familia, subtipo: 'Equipo', cantidad: count, valorTotal: formatCurrency(value), estado })
      }
    }

    // Agrupar consumibles por familia y estado
    const consByFamilyStatus = new Map<string, { count: number; value: number }>()
    for (const c of consumableData) {
      const familia = c.consumableType?.family?.name ?? 'Sin familia'
      const estado = CONSUMABLE_STATUS_ES[c.status] ?? c.status
      const key = `${familia}||MRO||${estado}`
      const prev = consByFamilyStatus.get(key) ?? { count: 0, value: 0 }
      consByFamilyStatus.set(key, {
        count: prev.count + 1,
        value: prev.value + (c.costPerUnit ?? 0) * c.currentStock,
      })
    }
    for (const [key, { count, value }] of consByFamilyStatus) {
      const [familia, , estado] = key.split('||')
      if (!subtype || subtype === 'MRO') {
        rows.push({ familia, subtipo: 'Material MRO', cantidad: count, valorTotal: formatCurrency(value), estado })
      }
    }

    // Agrupar licencias por familia
    const licByFamily = new Map<string, { count: number; value: number }>()
    for (const lic of licenseData) {
      const familia = lic.licenseType?.family?.name ?? 'Sin familia'
      const key = `${familia}||LICENSE`
      const prev = licByFamily.get(key) ?? { count: 0, value: 0 }
      licByFamily.set(key, { count: prev.count + 1, value: prev.value + (lic.cost ?? 0) })
    }
    for (const [key, { count, value }] of licByFamily) {
      const [familia] = key.split('||')
      if (!subtype || subtype === 'LICENSE') {
        rows.push({ familia, subtipo: 'Licencia/Contrato', cantidad: count, valorTotal: formatCurrency(value), estado: 'Activo' })
      }
    }

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const totalActivos = equipmentData.length + consumableData.length + licenseData.length
    const totalValor = [
      ...equipmentData.map((e) => e.purchasePrice ?? 0),
      ...consumableData.map((c) => (c.costPerUnit ?? 0) * c.currentStock),
      ...licenseData.map((l) => l.cost ?? 0),
    ].reduce((a, b) => a + b, 0)

    const equipRetired = equipmentData.filter((e) => e.status === 'RETIRED').length
    const equipActive = equipmentData.length - equipRetired

    const summary = [
      {
        title: 'Total de activos',
        value: totalActivos,
        description: `${equipActive} equipos activos, ${consumableData.length} materiales MRO, ${licenseData.length} licencias`,
      },
      {
        title: 'Valor total estimado',
        value: formatCurrency(totalValor),
        description: 'Suma del precio de compra de todos los activos',
      },
      {
        title: 'Activos dados de baja',
        value: equipRetired,
        description: `${equipRetired} equipos con estado "Dado de baja"`,
      },
    ]

    const filters: Record<string, unknown> = {
      familyId: familyId ?? null,
      subtype: subtype ?? null,
    }

    const response: ReportResponse<SummaryRow> = {
      summary,
      data: rows,
      filters,
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Familia: r.familia,
        Subtipo: r.subtipo,
        Cantidad: r.cantidad,
        'Valor Total': r.valorTotal,
        Estado: r.estado,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-inventario.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Familia', 'Subtipo', 'Cantidad', 'Valor Total', 'Estado']
      const pdfRows = rows.map((r) => [r.familia, r.subtipo, String(r.cantidad), r.valorTotal, r.estado])
      const pdfBuffer = await generateReportPDF('¿Qué tenemos? — Inventario Total', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-inventario.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/summary:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
