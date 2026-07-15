import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  canAccessDataset,
  getDatasetById,
  getTemplateBySlug,
  resolveUserReportRole,
} from '@/lib/inventory/reports/catalog'
import { exportReportCsv, exportReportXlsx, runInventoryReportDataset } from '@/lib/inventory/reports/engine'
import { handleInventoryReportRequest } from '@/lib/inventory/reports/handle-report-request'
import { resolveReportScope } from '@/lib/inventory/reports/scope'
import { resolveCanManageInventory } from '@/lib/inventory/inventory-session'
import { InventoryAccessError } from '@/lib/inventory/inventory-resource-access'
import type { ReportRunParams } from '@/lib/inventory/reports/types'

function parseRunParams(searchParams: URLSearchParams): ReportRunParams {
  const params: ReportRunParams = {
    dataset: searchParams.get('dataset') ?? '',
  }

  for (const [key, value] of searchParams.entries()) {
    if (key === 'columns') {
      params.columns = value.split(',').filter(Boolean)
    } else if (key === 'page' || key === 'limit') {
      params[key] = parseInt(value, 10)
    } else {
      params[key] = value
    }
  }

  return params
}

/**
 * GET /api/inventory/reports/run?dataset=equipment&...
 * GET /api/inventory/reports/run?template=summary&...
 * Motor unificado de reportes explorables (dataset) y plantillas fijas (template).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const templateSlug = searchParams.get('template')

    if (templateSlug) {
      if (!getTemplateBySlug(templateSlug)) {
        return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
      }
      return handleInventoryReportRequest(templateSlug, request)
    }

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const params = parseRunParams(searchParams)
    const datasetId = String(params.dataset ?? '')

    if (!datasetId) {
      return NextResponse.json(
        { error: 'Parámetro dataset o template es requerido' },
        { status: 400 }
      )
    }

    const dataset = getDatasetById(datasetId)
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const canManage = await resolveCanManageInventory(session.user.id, session.user.role)
    const userRole = resolveUserReportRole(session.user.role, isSuperAdmin, canManage)

    if (!canAccessDataset(datasetId, userRole)) {
      return NextResponse.json({ error: 'No tienes permiso para este dataset' }, { status: 403 })
    }

    const scope = await resolveReportScope(
      session.user,
      params.familyId ? String(params.familyId) : undefined
    )

    const result = await runInventoryReportDataset(datasetId, params, scope)

    const format = searchParams.get('format')
    if (format === 'csv') {
      const csv = exportReportCsv(result.data)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reporte-${datasetId}.csv"`,
        },
      })
    }

    if (format === 'xlsx') {
      const buffer = await exportReportXlsx(result.data, dataset.name)
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="reporte-${datasetId}.xlsx"`,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('Error en GET /api/inventory/reports/run:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al ejecutar reporte' },
      { status: 500 }
    )
  }
}
