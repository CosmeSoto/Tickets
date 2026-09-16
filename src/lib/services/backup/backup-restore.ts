/**
 * Punto de entrada público de restauración de respaldos. Detecta el motor
 * (pgBackRest / .dump / .sql / JSON) y delega en el archivo correspondiente:
 * - backup-restore-dump.ts  → formato `.dump` (pg_restore), completo y selectivo
 * - backup-restore-sql.ts   → formato `.sql` plano
 * - backup-restore-json.ts  → formato JSON, completo y selectivo por módulo
 * - backup-restore-merge-rules.ts → reglas compartidas por ambos motores
 *   selectivos sobre qué tablas debe "ganar" el backup en modo fusión
 *
 * Solo `restoreBackup`, `RestoreMode` y `RestoreResult` se usan fuera de esta
 * carpeta (ver src/lib/services/backup/index.ts) — todo lo demás, incluidos
 * los tres motores, es implementación interna.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { stat, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { hasPgTools, parseDatabaseUrl, decryptFile, calculateChecksum } from './backup-utils'
import { inferEngineFromRecord, restorePgBackRest, parsePgBackRestFileRef } from './backup-engine'
import { restoreWithPgRestore } from './backup-restore-dump'
import { restoreFromSQL } from './backup-restore-sql'
import { restoreFromJSON } from './backup-restore-json'

const execAsync = promisify(exec)

export type RestoreMode = 'replace' | 'merge'

export type RestoreResult = { async?: boolean; message?: string }

async function verifyBackupIntegrity(backupId: string): Promise<boolean> {
  try {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup || backup.status !== 'completed') {
      return false
    }
    try {
      await stat(backup.filepath)
    } catch {
      return false
    }
    if (backup.checksum) {
      const currentChecksum = await calculateChecksum(backup.filepath)
      return currentChecksum === backup.checksum
    }
    const stats = await stat(backup.filepath)
    return stats.size > 0
  } catch (error) {
    console.error('Error al verificar integridad del respaldo:', error)
    return false
  }
}

export async function restoreBackup(
  backupId: string,
  restoreModules?: string[],
  mode: RestoreMode = 'replace',
  options?: { pitrTarget?: string; userId?: string | null; userEmail?: string | null }
): Promise<RestoreResult> {
  try {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup) {
      throw new Error('Respaldo no encontrado')
    }
    if (backup.status !== 'completed') {
      throw new Error('El respaldo no está completo')
    }

    const engine = inferEngineFromRecord(backup)

    if (engine === 'pgbackrest') {
      if (restoreModules?.length) {
        throw new Error(
          'La restauración selectiva por módulo solo está disponible en exportaciones (.dump). Para pgBackRest usa restauración completa o PITR.'
        )
      }
      const label = backup.label || parsePgBackRestFileRef(backup.filepath)?.label || undefined
      if (!label && !options?.pitrTarget) {
        throw new Error('Etiqueta pgBackRest no encontrada en el respaldo')
      }
      await restorePgBackRest({ label, target: options?.pitrTarget })
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'backup_restore_started',
          entityType: 'System',
          entityId: backupId,
          userId: options?.userId ?? null,
          userEmail: options?.userEmail ?? null,
          createdAt: new Date(),
          details: {
            engine: 'pgbackrest',
            label: label ?? null,
            filename: backup.filename,
            pitrTarget: options?.pitrTarget ?? null,
            mode: 'full',
            async: true,
          },
        },
      })
      return {
        async: true,
        message: 'Restauración pgBackRest iniciada. El sitio quedará fuera de línea unos minutos.',
      }
    }

    await stat(backup.filepath)
    try {
      const isValid = await verifyBackupIntegrity(backupId)
      if (!isValid) {
        console.warn('[RESTORE] Advertencia: integridad no verificada, continuando...')
      }
    } catch (error) {
      console.warn('[RESTORE] No se pudo verificar integridad:', error)
    }

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_restore_started',
        entityType: 'System',
        entityId: backupId,
        userId: options?.userId ?? null,
        userEmail: options?.userEmail ?? null,
        createdAt: new Date(),
        details: {
          engine: inferEngineFromRecord(backup),
          filename: backup.filename,
          label: backup.label ?? null,
          mode,
          restoreModules: restoreModules?.join(', ') || 'full',
          async: false,
        },
      },
    })

    let workingFilepath = backup.filepath
    let decryptedTempPath: string | null = null
    if (backup.filepath.endsWith('.enc')) {
      console.log('[RESTORE] Descifrando respaldo...')
      try {
        workingFilepath = await decryptFile(backup.filepath)
        decryptedTempPath = workingFilepath
      } catch (decryptError) {
        throw new Error(
          `No se pudo descifrar el respaldo: ${
            decryptError instanceof Error ? decryptError.message : 'Error desconocido'
          }. Verifica que BACKUP_ENCRYPTION_KEY sea la misma que se usó al crear el respaldo.`
        )
      }
    }

    const isDumpFormat = workingFilepath.endsWith('.dump')
    let isJsonBackup = false
    let isSqlBackup = false

    if (!isDumpFormat) {
      let isGzipped = false
      try {
        const { stdout } = await execAsync(`file -b "${workingFilepath}"`)
        isGzipped = stdout.includes('gzip compressed')
      } catch {}

      if (isGzipped || workingFilepath.endsWith('.gz')) {
        console.log('[RESTORE] Descomprimiendo...')
        const decompressedPath = workingFilepath.replace(/\.gz$/, '') + '.temp'
        await execAsync(`gunzip -c "${workingFilepath}" > "${decompressedPath}"`)
        workingFilepath = decompressedPath
      }

      try {
        const { stdout: head } = await execAsync(`head -c 200 "${workingFilepath}"`)
        if (head.trim().startsWith('{')) {
          isJsonBackup = true
        } else {
          isSqlBackup = true
        }
      } catch {
        isSqlBackup = workingFilepath.endsWith('.sql')
        isJsonBackup = workingFilepath.endsWith('.json')
      }
    }

    const format = isDumpFormat ? 'pg_dump_custom' : isSqlBackup ? 'SQL' : 'JSON'
    console.log(
      `[RESTORE] Formato: ${format} | Modo: ${mode}` +
        (restoreModules?.length ? ` | Módulos: [${restoreModules.join(', ')}]` : ' | Completa')
    )

    const pgRestoreAvailable = await hasPgTools()
    const dbConfig = parseDatabaseUrl()

    if (isDumpFormat && pgRestoreAvailable) {
      await restoreWithPgRestore(workingFilepath, dbConfig, restoreModules, mode)
    } else if (isSqlBackup && pgRestoreAvailable) {
      if (restoreModules?.length) {
        throw new Error(
          'La restauración selectiva no está disponible para respaldos SQL plano. Crea un nuevo respaldo (formato .dump) para usar restauración selectiva.'
        )
      }
      await restoreFromSQL({ ...backup, filepath: workingFilepath })
    } else if (isJsonBackup) {
      await restoreFromJSON({ ...backup, filepath: workingFilepath }, restoreModules, mode)
    } else if (isDumpFormat && !pgRestoreAvailable) {
      throw new Error(
        'pg_restore no está disponible en el servidor. Instala postgresql-client para restaurar respaldos en formato .dump'
      )
    } else {
      throw new Error('No se pudo detectar el formato del respaldo')
    }

    if (decryptedTempPath) {
      try {
        await unlink(decryptedTempPath)
      } catch {}
    }

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_restored',
        entityType: 'System',
        entityId: backup.id,
        userId: options?.userId ?? null,
        userEmail: options?.userEmail ?? null,
        createdAt: new Date(),
        details: {
          engine: inferEngineFromRecord(backup),
          backupId: backup.id,
          filename: backup.filename,
          label: backup.label ?? null,
          method: format,
          mode,
          restoreModules: restoreModules?.join(', ') || 'full',
          restoredAt: new Date(),
          async: false,
        },
      },
    })

    console.log('[RESTORE] Restauración completada exitosamente')
    return {}
  } catch (error) {
    console.error('[RESTORE] Error:', error)
    throw error
  }
}
