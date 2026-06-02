import { stat, access } from 'fs/promises'
import prisma from '@/lib/prisma'
import { BackupInfo, BackupStats, BackupModuleId } from './backup-types'
import { getBackupConfig, hasPgTools, calculateChecksum, formatFileSize } from './backup-utils'
import { loadBackupMetadata, extractMetadataFromDump } from './backup-metadata'
import { createBackup } from './backup-create'
import { restoreBackup } from './backup-restore'
import { deleteBackup } from './backup-cleanup'
import { importBackupFromFile } from './backup-import'

export * from './backup-types'
export * from './backup-create'
export * from './backup-restore'
export * from './backup-import'
export * from './backup-cleanup'
export * from './backup-metadata'
export * from './backup-utils'

export class BackupService {
  static async createBackup(
    type: 'manual' | 'automatic' = 'manual',
    options?: { module?: BackupModuleId | null }
  ): Promise<BackupInfo> {
    return createBackup(type, options)
  }

  static async listBackups(): Promise<BackupInfo[]> {
    try {
      await this.verifyAndFixBackupStates()
      const backups = await prisma.backups.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return backups.map(backup => ({
        id: backup.id,
        filename: backup.filename,
        size: backup.size,
        createdAt: backup.createdAt,
        type: backup.type as 'manual' | 'automatic',
        status: backup.status as 'completed' | 'failed' | 'in_progress',
        checksum: backup.checksum ?? undefined,
        compressed: backup.compressed,
        encrypted: backup.encrypted,
        module: backup.module ?? null,
      }))
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
    mode: 'replace' | 'merge' = 'replace'
  ): Promise<void> {
    return restoreBackup(backupId, restoreModules, mode)
  }

  static async importBackupFromFile(
    fileBuffer: Buffer,
    originalFilename: string
  ): Promise<BackupInfo> {
    return importBackupFromFile(fileBuffer, originalFilename)
  }

  static async getBackupStats(): Promise<BackupStats> {
    try {
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
      return {
        totalBackups: stats._count.id || 0,
        totalSize: stats._sum.size || 0,
        lastBackup: stats._max.createdAt || undefined,
        oldestBackup: stats._min.createdAt || undefined,
        successRate,
        avgSize: stats._avg.size || 0,
      }
    } catch (error) {
      console.error('Error al obtener estadísticas de respaldo:', error)
      return {
        totalBackups: 0,
        totalSize: 0,
        successRate: 0,
        avgSize: 0,
      }
    }
  }

  static async getBackupCronModule(): Promise<BackupModuleId | null> {
    try {
      const row = await prisma.system_settings.findUnique({ where: { key: 'backupCronScope' } })
      if (row?.value === 'tickets') {
        return 'tickets'
      }
    } catch {}
    return null
  }

  static async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backup = await prisma.backups.findUnique({ where: { id: backupId } })
      if (!backup || backup.status !== 'completed') {
        return false
      }
      try {
        await access(backup.filepath)
      } catch {
        return false
      }
      if (backup.checksum) {
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

  static async getBackupPreview(backupId: string): Promise<{
    tables: Array<{ name: string; recordCount: number; size?: string }>
    totalRecords: number
    totalSize: string
    databaseVersion?: string
    createdAt: string
    backupType: string
  }> {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup) {
      throw new Error('Respaldo no encontrado')
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
        const pgToolsAvailable = await hasPgTools()
        if (pgToolsAvailable) {
          metadata = await extractMetadataFromDump(backup.filepath)
        }
      } catch {}
    }

    if (!metadata) {
      const fileStats = await stat(backup.filepath)
      return {
        tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(fileStats.size) }],
        totalRecords: 1,
        totalSize: formatFileSize(fileStats.size),
        createdAt: backup.createdAt.toISOString(),
        backupType: 'Archivo',
      }
    }

    const tables = Object.entries(metadata.tableCounts || {}).map(([name, count]) => ({
      name,
      recordCount: count as number,
    }))

    tables.sort((a, b) => b.recordCount - a.recordCount)

    const fileStats = await stat(backup.filepath)

    return {
      tables: tables.map(t => ({ ...t, size: 'Desde respaldo' })),
      totalRecords: metadata.totalRecords || 0,
      totalSize: formatFileSize(metadata.fileSize || fileStats.size),
      databaseVersion: metadata.version,
      createdAt: metadata.createdAt || backup.createdAt.toISOString(),
      backupType: backup.type === 'manual' ? 'Manual' : 'Automático',
    }
  }

  static async verifyAndFixBackupStates(): Promise<void> {
    try {
      console.log('Verificando estados de respaldos...')
      const backups = await prisma.backups.findMany({
        where: { status: 'in_progress' },
      })

      for (const backup of backups) {
        try {
          const fileStats = await stat(backup.filepath)
          if (fileStats.size > 0) {
            await prisma.backups.update({
              where: { id: backup.id },
              data: {
                status: 'completed',
                size: fileStats.size,
                error: null,
              },
            })
            console.log(`Estado corregido para respaldo: ${backup.filename}`)
          } else {
            await prisma.backups.update({
              where: { id: backup.id },
              data: {
                status: 'failed',
                error: 'Archivo de respaldo vacío',
              },
            })
          }
        } catch (error) {
          await prisma.backups.update({
            where: { id: backup.id },
            data: {
              status: 'failed',
              error: 'Archivo de respaldo no encontrado',
            },
          })
        }
      }
    } catch (error) {
      console.error('Error verificando estados de respaldo:', error)
    }
  }

  static async scheduleAutomaticBackup(): Promise<void> {
    try {
      const config = await getBackupConfig()
      if (!config.enabled) {
        return
      }

      const lastBackup = await prisma.backups.findFirst({
        where: {
          type: 'automatic',
          status: 'completed',
        },
        orderBy: { createdAt: 'desc' },
      })

      let shouldCreateBackup = false
      const now = new Date()

      if (!lastBackup) {
        shouldCreateBackup = true
      } else {
        const timeDiff = now.getTime() - lastBackup.createdAt.getTime()
        const hoursDiff = timeDiff / (1000 * 60 * 60)
        switch (config.frequency) {
          case 'daily':
            shouldCreateBackup = hoursDiff >= 24
            break
          case 'weekly':
            shouldCreateBackup = hoursDiff >= 24 * 7
            break
          case 'monthly':
            shouldCreateBackup = hoursDiff >= 24 * 30
            break
        }
      }

      if (shouldCreateBackup) {
        const backupModule = await this.getBackupCronModule()
        await this.createBackup('automatic', { module: backupModule })
        console.log('Respaldo automático creado exitosamente')
      }
    } catch (error) {
      console.error('Error en respaldo automático:', error)
    }
  }

  static formatFileSize = formatFileSize
}
