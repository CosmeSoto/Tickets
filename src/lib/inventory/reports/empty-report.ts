import type { ReportResponse } from './types'

export function emptyReportResponse(
  filters: Record<string, unknown> = {},
  meta?: ReportResponse['meta']
): ReportResponse {
  return {
    summary: [],
    data: [],
    filters,
    generatedAt: new Date().toISOString(),
    totalCount: 0,
    meta,
  }
}
