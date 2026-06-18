export interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: Date
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  checksum?: string
  compressed?: boolean
  encrypted?: boolean
  module?: string | null
}

export interface BackupStats {
  totalBackups: number
  totalSize: number
  lastBackup?: Date
  oldestBackup?: Date
  successRate: number
  avgSize: number
  compressionRatio?: number
}

export interface BackupMetadata {
  version: string
  createdAt: string
  tableCounts: Record<string, number>
  totalRecords: number
  fileSize: number
  // Campos opcionales para trazabilidad
  importedFrom?: string
  dumpFormat?: 'pg_dump_custom' | 'sql' | 'json'
  modules?: string[]
  dbVersion?: string
}

export interface DatabaseConfig {
  host: string
  port: string
  database: string
  username: string
  password: string
}

export interface BackupConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly'
  retentionDays: number
  maxBackups: number
  compression: boolean
  encryption: boolean
  cloudStorage: boolean
  cloudProvider: string | null
  notifications: boolean
  emailNotifications: string[]
  verifyIntegrity: boolean
  scheduleTime: string
  cronScope: 'tickets' | 'full'
}

export type BackupModuleId =
  | 'tickets'
  | 'news'
  | 'patrols'
  | 'families'
  | 'audits'
  | 'configurations'
  | 'users'
  | 'inventory'
