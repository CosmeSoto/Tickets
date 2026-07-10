import { unlink, access } from 'fs/promises'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getBackupConfig } from './backup-utils'
import { inferEngineFromRecord } from './backup-engine'
import { hidePgBackRestLabel } from './backup-settings'

export async function cleanOldBackups() {
  try {
    const config = await getBackupConfig()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - config.retentionDays)

    // Limpiar registros pgBackRest antiguos (retención real la maneja pgBackRest)
    await prisma.backups.deleteMany({
      where: {
        engine: 'pgbackrest',
        createdAt: { lt: cutoff },
      },
    })

    // Exports: límite por cantidad + retención por días
    const exportBackups = await prisma.backups.findMany({
      where: { status: 'completed', engine: { in: ['export', 'import'] } },
      orderBy: { createdAt: 'desc' },
    })

    const exportsToDelete = exportBackups
      .filter(b => b.createdAt < cutoff)
      .concat(exportBackups.slice(config.maxBackups))

    const seen = new Set<string>()
    for (const backup of exportsToDelete) {
      if (seen.has(backup.id)) continue
      seen.add(backup.id)
      try {
        await deleteBackupFiles(backup.filepath)
        await prisma.backups.delete({ where: { id: backup.id } })
      } catch (error) {
        console.warn(`Error eliminando export ${backup.filename}:`, error)
      }
    }
  } catch (error) {
    console.error('Error al limpiar respaldos antiguos:', error)
  }
}

async function deleteBackupFiles(filepath: string) {
  if (filepath.startsWith('pgbackrest://')) return

  try {
    await access(filepath)
    await unlink(filepath)
  } catch {}

  try {
    const metadataPath = `${filepath}.meta.json`
    await access(metadataPath)
    await unlink(metadataPath)
  } catch {}
}

export async function deleteBackup(backupId: string): Promise<void> {
  try {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup) return

    const engine = inferEngineFromRecord(backup)

    if (engine === 'pgbackrest') {
      const label = backup.label || backup.filename.replace(/\.pgbackrest$/, '')
      if (label) {
        await hidePgBackRestLabel(label)
      }
      await prisma.backups.delete({ where: { id: backupId } })
      console.log(
        `[BACKUP] Registro pgBackRest oculto del historial (repo intacto): ${label || backup.filename}`
      )
    } else {
      await deleteBackupFiles(backup.filepath)
      await prisma.backups.delete({ where: { id: backupId } })
    }

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'backup_deleted',
          entityType: 'System',
          entityId: backupId,
          createdAt: new Date(),
          details: {
            filename: backup.filename,
            engine,
            deletedAt: new Date(),
          },
        },
      })
      .catch(() => {})
  } catch (error) {
    console.error('Error al eliminar respaldo:', error)
    throw error
  }
}
