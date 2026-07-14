import { stat, access } from 'fs/promises'
import prisma from '@/lib/prisma'
import { BackupInfo, BackupStats, BackupCreateMode, BackupKind } from './backup-types'
import { getBackupConfig, hasPgTools, calculateChecksum, formatFileSize } from './backup-utils'
import { loadBackupMetadata, extractMetadataFromDump } from './backup-metadata'
import { createBackup } from './backup-create'
import { restoreBackup } from './backup-restore'
import { deleteBackup, reconcileStaleBackupRecords } from './backup-cleanup'
import { importBackupFromFile } from './backup-import'
import {
  getBackupWorkerHealth,
  syncPgBackRestToDatabase,
  inferEngineFromRecord,
} from './backup-engine'

export * from './backup-types'
export * from './backup-create'
export * from './backup-restore'
export * from './backup-import'
export * from './backup-cleanup'
export * from './backup-metadata'
export * from './backup-utils'
export * from './backup-engine'

function mapBackupRecord(backup: {
  id: string
  filename: string
  size: number
  createdAt: Date
  type: string
  status: string
  checksum: string | null
  compressed: boolean
  encrypted: boolean
  engine?: string | null
  backupKind?: string | null
  label?: string | null
  module?: string | null
}): BackupInfo {
  return {
    id: backup.id,
    filename: backup.filename,
    size: backup.size,
    createdAt: backup.createdAt,
    type: backup.type as 'manual' | 'automatic',
    status: backup.status as 'completed' | 'failed' | 'in_progress',
    checksum: backup.checksum ?? undefined,
    compressed: backup.compressed,
    encrypted: backup.encrypted,
    engine: inferEngineFromRecord(backup),
    backupKind: (backup.backupKind as BackupKind) || 'full',
    label: backup.label ?? null,
    module: backup.module ?? null,
  }
}

export class BackupService {
  static async createBackup(
    type: 'manual' | 'automatic' = 'manual',
    options?: {
      mode?: BackupCreateMode
      backupKind?: BackupKind
      userId?: string | null
      userEmail?: string | null
    }
  ): Promise<BackupInfo> {
    return createBackup(type, options)
  }

  static async listBackups(): Promise<BackupInfo[]> {
    try {
      await syncPgBackRestToDatabase().catch(() => {})
      await reconcileStaleBackupRecords()
      const backups = await prisma.backups.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      })
      return backups.map(mapBackupRecord)
    } catch (error) {
      console.error('Error al listar respaldos:', error)
      return []
    }
  }

  static async deleteBackup(backupId: string): Promise<void> {
    return deleteBackup(backupId)
  }

  static async restoreBackup(
    backupId: string,
    restoreModules?: string[],
    mode: 'replace' | 'merge' = 'replace',
    options?: { pitrTarget?: string; userId?: string | null; userEmail?: string | null }
  ) {
    return restoreBackup(backupId, restoreModules, mode, options)
  }

  static async importBackupFromFile(
    fileBuffer: Buffer,
    originalFilename: string
  ): Promise<BackupInfo> {
    return importBackupFromFile(fileBuffer, originalFilename)
  }

  static async getBackupStats(): Promise<BackupStats> {
    try {
      const workerHealth = await getBackupWorkerHealth()
      const stats = await prisma.backups.aggregate({
        _count: { id: true },
        _sum: { size: true },
        _max: { createdAt: true },
        _min: { createdAt: true },
        _avg: { size: true },
        where: { status: 'completed' },
      })
      const totalBackups = await prisma.backups.count()
      const completedBackups = await prisma.backups.count({
        where: { status: 'completed' },
      })
      const successRate = totalBackups > 0 ? (completedBackups / totalBackups) * 100 : 0

      const lastFull = await prisma.backups.findFirst({
        where: { engine: 'pgbackrest', backupKind: 'full', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      })
      const lastDiff = await prisma.backups.findFirst({
        where: { engine: 'pgbackrest', backupKind: 'diff', status: 'completed' },
        orderBy: { createdAt: 'desc' },
      })

      return {
        totalBackups: stats._count.id || 0,
        totalSize: stats._sum.size || 0,
        lastBackup: stats._max.createdAt || undefined,
        oldestBackup: stats._min.createdAt || undefined,
        successRate,
        avgSize: stats._avg.size || 0,
        pgbackrestAvailable: workerHealth.status === 'healthy',
        lastFullBackup: lastFull?.createdAt,
        lastDiffBackup: lastDiff?.createdAt,
      }
    } catch (error) {
      console.error('Error al obtener estadísticas de respaldo:', error)
      return {
        totalBackups: 0,
        totalSize: 0,
        successRate: 0,
        avgSize: 0,
        pgbackrestAvailable: false,
      }
    }
  }

  static async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backup = await prisma.backups.findUnique({ where: { id: backupId } })
      if (!backup || backup.status !== 'completed') return false

      if (inferEngineFromRecord(backup) === 'pgbackrest') {
        return Boolean(backup.label)
      }

      try {
        await access(backup.filepath)
      } catch {
        return false
      }
      if (backup.checksum && !backup.checksum.startsWith('pgbackrest:')) {
        const currentChecksum = await calculateChecksum(backup.filepath)
        return currentChecksum === backup.checksum
      }
      const fileStats = await stat(backup.filepath)
      return fileStats.size > 0
    } catch (error) {
      console.error('Error al verificar integridad del respaldo:', error)
      return false
    }
  }

  static async getBackupPreview(backupId: string) {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup) throw new Error('Respaldo no encontrado')

    if (inferEngineFromRecord(backup) === 'pgbackrest') {
      return {
        tables: [
          {
            name: 'cluster_completo',
            recordCount: 1,
            size: formatFileSize(backup.size),
          },
        ],
        totalRecords: 1,
        totalSize: formatFileSize(backup.size),
        databaseVersion: 'PostgreSQL (pgBackRest)',
        createdAt: backup.createdAt.toISOString(),
        backupType: `pgBackRest ${backup.backupKind || 'full'}`,
      }
    }

    let metadata = null
    if (backup.metadata) {
      try {
        metadata = JSON.parse(backup.metadata)
      } catch {}
    }

    if (!metadata) {
      try {
        metadata = await loadBackupMetadata(backup.filepath, backup.metadata)
      } catch {}
    }

    if (!metadata && backup.filename.endsWith('.dump')) {
      try {
        if (await hasPgTools()) {
          metadata = await extractMetadataFromDump(backup.filepath)
        }
      } catch {}
    }

    if (!metadata) {
      const fileStats = await stat(backup.filepath).catch(() => null)
      return {
        tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(backup.size) }],
        totalRecords: 1,
        totalSize: formatFileSize(fileStats?.size || backup.size),
        createdAt: backup.createdAt.toISOString(),
        backupType: 'Archivo',
      }
    }

    const tables = Object.entries(metadata.tableCounts || {}).map(([name, count]) => ({
      name,
      recordCount: count as number,
    }))
    tables.sort((a, b) => b.recordCount - a.recordCount)

    return {
      tables: tables.map(t => ({ ...t, size: 'Desde respaldo' })),
      totalRecords: metadata.totalRecords || 0,
      totalSize: formatFileSize(metadata.fileSize || backup.size),
      databaseVersion: metadata.version,
      createdAt: metadata.createdAt || backup.createdAt.toISOString(),
      backupType: backup.type === 'manual' ? 'Manual' : 'Automático',
    }
  }

  static async verifyAndFixBackupStates(): Promise<void> {
    await reconcileStaleBackupRecords()
  }

  static formatFileSize = formatFileSize
}
