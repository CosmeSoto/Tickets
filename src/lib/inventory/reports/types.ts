export type InventoryReportRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER'

export type ReportCategoryId =
  | 'inventory'
  | 'operations'
  | 'financial'
  | 'contracts'
  | 'analysis'

export type ReportFilterType = 'date' | 'select' | 'text' | 'number'

export interface ReportFilterOption {
  value: string
  label: string
}

export interface ReportFilterDef {
  key: string
  label: string
  type: ReportFilterType
  options?: ReportFilterOption[]
  placeholder?: string
  defaultValue?: string
}

export interface ReportColumnDef {
  key: string
  label: string
  defaultVisible?: boolean
}

export interface ReportSummaryItem {
  title: string
  value: string | number
  description: string
}

export interface ReportResponse<T = Record<string, unknown>> {
  summary: ReportSummaryItem[]
  data: T[]
  filters: Record<string, unknown>
  generatedAt: string
  totalCount: number
  meta?: {
    dataset?: string
    template?: string
    page?: number
    limit?: number
    columns?: string[]
    groupBy?: string
    grouped?: boolean
  }
}

export interface ReportTemplateDef {
  slug: string
  categoryId: ReportCategoryId
  name: string
  description: string
  icon: string
  roles: InventoryReportRole[]
  filters: ReportFilterDef[]
  superAdminOnly?: boolean
}

export interface ReportDatasetDef {
  id: string
  categoryId: ReportCategoryId
  name: string
  description: string
  icon: string
  roles: InventoryReportRole[]
  filters: ReportFilterDef[]
  columns: ReportColumnDef[]
}

export interface ReportCategoryDef {
  id: ReportCategoryId
  name: string
  description: string
}

export type ReportRunParams = {
  dataset: string
  familyId?: string
  page?: number
  limit?: number
  columns?: string[]
  format?: 'json' | 'csv'
} & Record<string, string | number | undefined>

export interface InventorySavedReport {
  id: string
  name: string
  kind: 'DATASET' | 'TEMPLATE'
  targetId: string
  familyId: string | null
  filterValues: Record<string, string>
  visibleColumns: string[]
  pinned: boolean
  pinnedOrder: number | null
  pinnedSpan: number
  createdAt: string
  updatedAt: string
  family?: { id: string; name: string; color: string | null } | null
}

export interface InventoryScheduledReport {
  id: string
  savedReportId: string
  savedReportName: string
  savedReportKind: 'DATASET' | 'TEMPLATE'
  savedReportTargetId: string
  enabled: boolean
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  scheduleTime: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  recipients: string[]
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: string | null
  lastError: string | null
  exportFormat: 'CSV' | 'PDF' | 'BOTH'
  createdAt: string
  updatedAt: string
}
