import { prisma } from '@/lib/prisma'
import { generateReportPDF, toCSV } from '@/lib/inventory/report-utils'
import { ALL_FILTER, getTemplateBySlug } from './catalog'
import { exportReportCsv, runInventoryReportDataset } from './engine'
import { resolveReportScope } from './scope'
import { runInventoryReportTemplate } from './template-runner'
import { TEMPLATE_EXPORT } from './respond-report'
import type { InventorySavedReport, ReportRunParams, ReportSummaryItem } from './types'

const EXPORT_LIMIT = 5000

export interface SavedReportRunResult {
  reportName: string
  csv: string
  pdf: Buffer
  rowCount: number
  summary: { title: string; value: string | number }[]
}

function buildRunParams(saved: InventorySavedReport): ReportRunParams {
  const params: ReportRunParams = {
    dataset: saved.kind === 'DATASET' ? saved.targetId : '',
    limit: EXPORT_LIMIT,
    page: 1,
  }

  if (saved.familyId) params.familyId = saved.familyId
  if (saved.visibleColumns.length) params.columns = saved.visibleColumns

  for (const [key, value] of Object.entries(saved.filterValues)) {
    if (value && value !== ALL_FILTER) params[key] = value
  }

  return params
}

function reportToCsv(saved: InventorySavedReport, data: Record<string, unknown>[]): string {
  if (saved.kind === 'DATASET') {
    return exportReportCsv(data)
  }

  const exportCfg = TEMPLATE_EXPORT[saved.targetId]
  if (exportCfg?.csvRowMapper) {
    return toCSV(data.map(row => exportCfg.csvRowMapper(row)))
  }
  return exportReportCsv(data)
}

async function reportToPdf(
  saved: InventorySavedReport,
  data: Record<string, unknown>[],
  summary: ReportSummaryItem[]
): Promise<Buffer> {
  const exportCfg = saved.kind === 'TEMPLATE' ? TEMPLATE_EXPORT[saved.targetId] : undefined
  const template = saved.kind === 'TEMPLATE' ? getTemplateBySlug(saved.targetId) : undefined
  const pdfTitle = exportCfg?.pdfTitle ?? template?.name ?? saved.name

  let headers: string[]
  let pdfRows: string[][]

  if (exportCfg?.pdfHeaders && exportCfg.pdfRowKeys) {
    headers = exportCfg.pdfHeaders
    pdfRows = data.map(row => exportCfg.pdfRowKeys!.map(key => String(row[key] ?? '—')))
  } else if (saved.visibleColumns.length) {
    headers = saved.visibleColumns
    pdfRows = data.map(row => headers.map(h => String(row[h] ?? '—')))
  } else if (data[0]) {
    headers = Object.keys(data[0])
    pdfRows = data.map(row => headers.map(h => String(row[h] ?? '—')))
  } else {
    headers = []
    pdfRows = []
  }

  const pdfBuffer = await generateReportPDF(pdfTitle, summary, headers, pdfRows)
  return Buffer.from(pdfBuffer)
}

export async function runSavedReportForUser(
  saved: InventorySavedReport,
  sessionUser: { id: string; role: string; isSuperAdmin?: boolean }
): Promise<SavedReportRunResult> {
  const scope = await resolveReportScope(sessionUser, saved.familyId ?? undefined)

  let result
  if (saved.kind === 'DATASET') {
    const params = buildRunParams(saved)
    result = await runInventoryReportDataset(saved.targetId, params, scope)
  } else {
    const stringParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(saved.filterValues)) {
      if (value) stringParams[key] = value
    }
    if (saved.familyId) stringParams.familyId = saved.familyId
    result = await runInventoryReportTemplate(saved.targetId, stringParams, scope, {
      role: sessionUser.role,
      isSuperAdmin: sessionUser.isSuperAdmin,
    })
  }

  const csv = reportToCsv(saved, result.data as Record<string, unknown>[])
  const pdf = await reportToPdf(saved, result.data as Record<string, unknown>[], result.summary)

  return {
    reportName: saved.name,
    csv,
    pdf,
    rowCount: result.totalCount,
    summary: result.summary.map(s => ({ title: s.title, value: s.value })),
  }
}

export async function runSavedReportById(savedReportId: string): Promise<SavedReportRunResult | null> {
  const saved = await prisma.inventory_saved_reports.findUnique({
    where: { id: savedReportId },
    select: {
      id: true,
      name: true,
      kind: true,
      targetId: true,
      familyId: true,
      filterValues: true,
      visibleColumns: true,
      pinned: true,
      pinnedOrder: true,
      pinnedSpan: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!saved) return null

  const user = await prisma.users.findUnique({
    where: { id: saved.userId },
    select: { id: true, role: true, isSuperAdmin: true, email: true, isActive: true },
  })

  if (!user?.isActive) return null

  const serialized: InventorySavedReport = {
    id: saved.id,
    name: saved.name,
    kind: saved.kind,
    targetId: saved.targetId,
    familyId: saved.familyId,
    filterValues: (saved.filterValues as Record<string, string>) ?? {},
    visibleColumns: (saved.visibleColumns as string[]) ?? [],
    pinned: saved.pinned,
    pinnedOrder: saved.pinnedOrder,
    pinnedSpan: saved.pinnedSpan,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  }

  return runSavedReportForUser(serialized, {
    id: user.id,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  })
}
