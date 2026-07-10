export type BackupEngine = 'pgbackrest' | 'export' | 'import'
export type BackupKind = 'full' | 'diff' | 'incr' | 'export'
export type BackupCreateMode = 'infrastructure' | 'export'

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
  engine: BackupEngine
  backupKind: BackupKind
  label?: string | null
  /** @deprecated legacy */
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
  pgbackrestAvailable?: boolean
  lastFullBackup?: Date
  lastDiffBackup?: Date
}

export interface BackupMetadata {
  version: string
  createdAt: string
  tableCounts: Record<string, number>
  totalRecords: number
  fileSize: number
  importedFrom?: string
  dumpFormat?: 'pg_dump_custom' | 'sql' | 'json'
  modules?: string[]
  dbVersion?: string
  pgbackrest?: {
    stanza: string
    label: string
    type: string
    timestamp?: number
  }
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
  weeklyFullDay: number
  /** Restauración pgBackRest desde UI (Config) */
  allowRestore: boolean
}

export interface PgBackRestBackupSet {
  label?: string
  type?: string
  /** pgBackRest 2.58+: number (epoch s) or { start, stop } */
  timestamp?: number | { start?: number; stop?: number }
  size?: number
  info?: { size?: number; 'repository-size'?: number }
}

export interface PgBackRestInfo {
  name?: string
  stanza?: string
  status?: { code?: number; message?: string }
  backup?: PgBackRestBackupSet[]
  archive?: { max?: string; min?: string }[]
}

export interface BackupWorkerHealth {
  status: 'healthy' | 'degraded' | 'unavailable'
  pgbackrestOk: boolean
  stanzaOk: boolean
  stanza: string
  allowRestore: boolean
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
