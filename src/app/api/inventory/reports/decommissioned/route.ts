import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import {
  ReportResponse,
  DECOMMISSION_REASON_ES,
  formatDate,
  getAccessibleFamilyIds,
  toCSV,
  generateReportPDF,
} from '@/lib/inventory/report-utils'

interface DecommissionedRow {
  folio: string
  fechaBaja: string
  tipoActivo: string
  nombreActivo: string
  codigoActivo: string
  familia: string
  motivo: string
  solicitadoPor: string
  aprobadoPor: string
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
    const familyId = searchParams.get('familyId') || undefined
    const reason = searchParams.get('reason') || undefined
    const format = searchParams.get('format') || undefined

    const accessibleFamilyIds = await getAccessibleFamilyIds(user.id, user.role)

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

    // Construir where para decommission_acts
    const where: Record<string, unknown> = {}

    if (dateFrom || dateTo) {
      where.approvedAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      }
    }

    // Filtros en la request
    const requestWhere: Record<string, unknown> = {}
    if (reason) {
      requestWhere.reason = { contains: reason, mode: 'insensitive' }
    }
    if (familyFilter) {
      requestWhere.OR = [
        { equipment: { type: { familyId: { in: familyFilter } } } },
        { license: { licenseType: { familyId: { in: familyFilter } } } },
      ]
    }
    if (Object.keys(requestWhere).length > 0) {
      where.request = requestWhere
    }

    const acts = await prisma.decommission_acts.findMany({
      where,
      include: {
        request: {
          include: {
            equipment: {
              select: {
                code: true,
                brand: true,
                model: true,
                type: { select: { family: { select: { name: true } } } },
              },
            },
            license: {
              select: {
                name: true,
                licenseType: { select: { family: { select: { name: true } } } },
              },
            },
            requester: { select: { name: true } },
          },
        },
        approvedBy: { select: { name: true } },
      },
      orderBy: { approvedAt: 'desc' },
    })

    const rows: DecommissionedRow[] = acts.map((act) => {
      const req = act.request
      const isEquipment = req.assetType === 'EQUIPMENT'
      const nombreActivo = isEquipment
        ? req.equipment
          ? `${req.equipment.brand} ${req.equipment.model}`
          : '—'
        : req.license?.name ?? '—'
      const codigoActivo = isEquipment ? req.equipment?.code ?? '—' : req.licenseId?.slice(0, 8).toUpperCase() ?? '—'
      const familia = isEquipment
        ? req.equipment?.type?.family?.name ?? '—'
        : req.license?.licenseType?.family?.name ?? '—'

      return {
        folio: act.folio,
        fechaBaja: formatDate(act.approvedAt),
        tipoActivo: isEquipment ? 'Equipo' : 'Licencia/Contrato',
        nombreActivo,
        codigoActivo,
        familia,
        motivo: DECOMMISSION_REASON_ES[req.reason] ?? req.reason,
        solicitadoPor: req.requester.name ?? '—',
        aprobadoPor: act.approvedBy.name ?? '—',
      }
    })

    // ── Indicadores ejecutivos ────────────────────────────────────────────────
    const totalBajas = rows.length
    const equiposBaja = rows.filter((r) => r.tipoActivo === 'Equipo').length
    const motivoMasComun = (() => {
      const counts = new Map<string, number>()
      rows.forEach((r) => counts.set(r.motivo, (counts.get(r.motivo) ?? 0) + 1))
      let max = 0
      let motivo = '—'
      counts.forEach((v, k) => { if (v > max) { max = v; motivo = k } })
      return motivo
    })()

    const summary = [
      {
        title: 'Total de bajas',
        value: totalBajas,
        description: `${equiposBaja} equipos y ${totalBajas - equiposBaja} licencias/contratos dados de baja`,
      },
      {
        title: 'Equipos dados de baja',
        value: equiposBaja,
        description: 'Equipos físicos retirados del inventario',
      },
      {
        title: 'Motivo más frecuente',
        value: motivoMasComun,
        description: 'Causa principal de baja en el período',
      },
    ]

    const filters: Record<string, unknown> = {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      familyId: familyId ?? null,
      reason: reason ?? null,
    }

    const response: ReportResponse<DecommissionedRow> = {
      summary,
      data: rows,
      filters,
      generatedAt: new Date().toISOString(),
      totalCount: rows.length,
    }

    // ── Exportación ───────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvRows = rows.map((r) => ({
        Folio: r.folio,
        'Fecha Baja': r.fechaBaja,
        'Tipo Activo': r.tipoActivo,
        Nombre: r.nombreActivo,
        Código: r.codigoActivo,
        Familia: r.familia,
        Motivo: r.motivo,
        'Solicitado Por': r.solicitadoPor,
        'Aprobado Por': r.aprobadoPor,
      }))
      const csv = toCSV(csvRows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="reporte-bajas.csv"',
        },
      })
    }

    if (format === 'pdf') {
      const headers = ['Folio', 'Fecha Baja', 'Tipo', 'Nombre', 'Familia', 'Motivo', 'Aprobado Por']
      const pdfRows = rows.map((r) => [
        r.folio,
        r.fechaBaja,
        r.tipoActivo,
        r.nombreActivo,
        r.familia,
        r.motivo,
        r.aprobadoPor,
      ])
      const pdfBuffer = await generateReportPDF('¿Qué se ha dado de baja?', summary, headers, pdfRows)
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="reporte-bajas.pdf"',
        },
      })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error en GET /api/inventory/reports/decommissioned:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
