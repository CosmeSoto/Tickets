/**
 * Types and interfaces for Audit module
 */

export interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  userId: string
  userEmail?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
  users?: {
    name: string
    email: string
    role: string
  }
}

export interface AuditStats {
  totalLogs: number
  actionStats: Array<{
    action: string
    entityType: string
    _count: { id: number }
  }>
  topUsers: Array<{
    userId: string
    _count: { id: number }
  }>
  period: string
}

export interface AuditPagination {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface AuditFilters {
  search: string
  entityType: string
  action: string
  userId: string
  days: string
  familyId: string
  configModule: string
  actionPreset: string
}

export interface ResolvedDetails {
  type:
    | 'changes'
    | 'resolved'
    | 'unresolved'
    | 'error'
    | 'metadata'
    | 'generic'
    | 'raw'
    | 'backup_config_diff'
    | 'config_diff'
    | 'backup_config_legacy'
  data: any
}

export interface AuditChange {
  campo: string
  campoTecnico: string
  anterior: string
  nuevo: string
}
