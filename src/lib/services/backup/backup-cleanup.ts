import { unlink, access } from 'fs/promises'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getBackupConfig } from './backup-utils'

export async function cleanOldBackups() {
  try {
    const config = await getBackupConfig()
    const completedBackups = await prisma.backups.findMany({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
    })

    if (completedBackups.length <= config.maxBackups) {
      return
    }

    const backupsToDelete = completedBackups.slice(config.maxBackups)

    for (const backup of backupsToDelete) {
      try {
        await deleteBackupFiles(backup.filepath)
        await prisma.backups.delete({ where: { id: backup.id } })
        console.log(`Respaldo antiguo eliminado: ${backup.filename}`)
      } catch (error) {
        console.warn(`Error eliminando respaldo ${backup.filename}:`, error)
      }
    }
  } catch (error) {
    console.error('Error al limpiar respaldos antiguos:', error)
  }
}

async function deleteBackupFiles(filepath: string) {
  try {
    await access(filepath)
    await unlink(filepath)
  } catch {
    // Ignorar si el archivo no existe
  }

  try {
    const metadataPath = `${filepath}.meta.json`
    await access(metadataPath)
    await unlink(metadataPath)
  } catch {
    // Ignorar si el archivo no existe
  }
}

export async function deleteBackup(backupId: string): Promise<void> {
  try {
    const backup = await prisma.backups.findUnique({
      where: { id: backupId },
    })

    if (!backup) {
      console.log(`Backup ${backupId} no encontrado en la base de datos`)
      return
    }

    try {
      await deleteBackupFiles(backup.filepath)
      console.log(`Archivos de respaldo eliminados: ${backup.filepath}`)
    } catch (error) {
      console.warn(`No se pudo eliminar los archivos de respaldo: ${backup.filepath}`, error)
    }

    try {
      await prisma.backups.delete({
        where: { id: backupId },
      })
      console.log(`Registro de respaldo eliminado: ${backupId}`)
    } catch (dbError) {
      if (
        dbError instanceof Error &&
        dbError.message.includes('Record to delete does not exist')
      ) {
        console.log(`Registro de respaldo ${backupId} ya no existe`)
        return
      }
      throw dbError
    }

    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'backup_deleted',
          entityType: 'System',
          entityId: backupId,
          createdAt: new Date(),
          details: {
            filename: backup.filename,
            deletedAt: new Date(),
          },
        },
      })
    } catch (auditError) {
      console.warn('No se pudo registrar eliminación en auditoría:', auditError)
    }
  } catch (error) {
    console.error('Error al eliminar respaldo:', error)
    throw error
  }
}
