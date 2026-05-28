import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, readdir, stat, unlink, access, readFile } from 'fs/promises'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { BackupCloudService, type CloudProvider } from './backup-cloud-service'
import {
  exportTicketsModuleData,
  exportNewsModuleData,
  exportPatrolsModuleData,
  exportFamiliesModuleData,
  exportAuditsModuleData,
  exportConfigurationsModuleData,
  exportUsersModuleData,
  isBackupModuleId,
  TICKETS_MODULE_RESTORE_ORDER,
  NEWS_MODULE_RESTORE_ORDER,
  PATROLS_MODULE_RESTORE_ORDER,
  FAMILIES_MODULE_RESTORE_ORDER,
  AUDITS_MODULE_RESTORE_ORDER,
  CONFIGURATIONS_MODULE_RESTORE_ORDER,
  USERS_MODULE_RESTORE_ORDER,
  type BackupModuleId,
} from './backup-modules'

const execAsync = promisify(exec)

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
  /** null / undefined = respaldo completo de base de datos */
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

export class BackupService {
  private static BACKUP_DIR: string = (() => {
    // Primero intenta usar la variable de entorno
    if (process.env.BACKUP_DIR) {
      return process.env.BACKUP_DIR
    }
    // Luego intenta usar el directorio de trabajo actual (más seguro para Docker)
    return join(process.cwd(), 'backups')
  })()
  private static readonly MAX_BACKUP_SIZE = 1024 * 1024 * 1024 // 1GB
  private static readonly COMPRESSION_LEVEL = 6

  private static async ensureBackupDirectory() {
    try {
      await mkdir(this.BACKUP_DIR, { recursive: true, mode: 0o755 })
      console.log(`Directorio de backups asegurado: ${this.BACKUP_DIR}`)
    } catch (error) {
      console.error(
        'Error al crear directorio de backups (ruta principal):',
        this.BACKUP_DIR,
        error
      )
      // Intentar usar una ruta alternativa si la principal falla
      const altDir = join('/tmp', 'sistema-tickets-backups')
      console.log(`Intentando usar directorio alternativo: ${altDir}`)
      await mkdir(altDir, { recursive: true, mode: 0o755 })
      console.log(`Directorio alternativo asegurado: ${altDir}`)
      ;(this as any).BACKUP_DIR = altDir
    }
  }

  static async createBackup(
    type: 'manual' | 'automatic' = 'manual',
    options?: { module?: BackupModuleId | null }
  ): Promise<BackupInfo> {
    if (type !== 'manual' && type !== 'automatic') {
      throw new Error('Tipo de backup inválido. Debe ser "manual" o "automatic"')
    }

    await this.ensureBackupDirectory()

    const moduleKey: BackupModuleId | null =
      options?.module != null && isBackupModuleId(options.module) ? options.module : null

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    // Verificar si pg_dump está disponible
    const hasPgDump = await this.hasPgTools()

    // Determinar formato del backup:
    // - pg_dump disponible → formato custom (.dump) que permite restauración selectiva nativa
    // - sin pg_dump → fallback a JSON con Prisma
    const filename = hasPgDump ? `backup-${timestamp}.dump` : `backup-${timestamp}.json`
    const filepath = join(this.BACKUP_DIR, filename)

    // Crear registro inicial
    const backupRecord = await prisma.backups.create({
      data: {
        id: randomUUID(),
        filename,
        filepath,
        size: 0,
        type,
        status: 'in_progress',
        module: moduleKey,
        createdAt: new Date(),
      },
    })

    try {
      const config = await this.getBackupConfig()
      const dbConfig = this.parseDatabaseUrl()

      console.log(`[BACKUP] Iniciando: ${filename} (método: ${hasPgDump ? 'pg_dump' : 'prisma'})`)

      if (hasPgDump) {
        // ═══ MÉTODO PRINCIPAL: pg_dump formato custom ═══
        // Formato custom (-Fc) permite:
        // - Restauración selectiva por tabla con pg_restore --table
        // - Compresión integrada (no necesita gzip adicional)
        // - Paralelismo en restauración
        // - Reordenamiento automático de datos
        const command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -Fc --no-owner --no-privileges --verbose -f "${filepath}"`

        await execAsync(command, {
          timeout: 600000, // 10 minutos
          maxBuffer: 1024 * 1024 * 50,
        })

        console.log('[BACKUP] pg_dump completado exitosamente')
      } else {
        // ═══ FALLBACK: Export con Prisma (solo si pg_dump no está disponible) ═══
        console.warn('[BACKUP] pg_dump no disponible, usando fallback Prisma/JSON')
        await this.createBackupWithPrisma(filepath)
      }

      // Verificar que el archivo se creó correctamente
      const fileStats = await stat(filepath)
      if (fileStats.size === 0) {
        throw new Error('El backup está vacío')
      }
      console.log(`[BACKUP] Archivo creado: ${fileStats.size} bytes`)

      // Calcular checksum
      let checksum: string | undefined
      try {
        if (config.verifyIntegrity) {
          checksum = await this.calculateChecksum(filepath)
        }
      } catch (error) {
        console.warn('No se pudo calcular checksum:', error)
      }

      // Aplicar encriptación si está habilitada
      let finalFilepath = filepath
      let finalFilename = filename
      let encrypted = false

      if (config.encryption) {
        try {
          finalFilepath = await this.encryptFile(filepath)
          finalFilename = filename + '.enc'
          encrypted = true
          console.log('[BACKUP] Encriptado exitosamente')
        } catch (encryptionError) {
          console.warn('Error en encriptación, usando archivo sin encriptar:', encryptionError)
        }
      }

      // Actualizar registro
      const finalStats = await stat(finalFilepath)
      await prisma.backups.update({
        where: { id: backupRecord.id },
        data: {
          filename: finalFilename,
          filepath: finalFilepath,
          size: finalStats.size,
          status: 'completed',
          checksum: checksum ?? null,
          compressed: hasPgDump, // pg_dump -Fc ya comprime
          encrypted,
        },
      })

      // Limpiar backups antiguos
      await this.cleanOldBackups()

      // Subir a cloud si está habilitado
      if (config.cloudStorage && config.cloudProvider) {
        this.uploadToCloud(backupRecord.id, finalFilepath, config.cloudProvider as any).catch(err =>
          console.error('[CLOUD] Error subiendo backup:', err)
        )
      }

      // Notificaciones
      try {
        if (config.notifications) {
          await this.sendBackupNotification('success', {
            filename: finalFilename,
            size: finalStats.size,
            type,
          })
        }
      } catch (error) {
        console.warn('No se pudo enviar notificación:', error)
      }

      // Auditoría
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'backup_created',
            entityType: 'System',
            entityId: backupRecord.id,
            createdAt: new Date(),
            details: {
              filename: finalFilename,
              size: finalStats.size,
              type,
              method: hasPgDump ? 'pg_dump_custom' : 'prisma_json',
              checksum: checksum || null,
            },
          },
        })
      } catch (error) {
        console.warn('No se pudo registrar en auditoría:', error)
      }

      return {
        id: backupRecord.id,
        filename: finalFilename,
        size: finalStats.size,
        createdAt: backupRecord.createdAt,
        type: backupRecord.type as 'manual' | 'automatic',
        status: 'completed',
        checksum,
        compressed: hasPgDump,
        encrypted,
        module: moduleKey,
      }
    } catch (error) {
      console.error('[BACKUP] Error:', error)

      await prisma.backups.update({
        where: { id: backupRecord.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
      })

      try {
        const config = await this.getBackupConfig()
        if (config.notifications) {
          await this.sendBackupNotification('error', {
            filename,
            error: error instanceof Error ? error.message : 'Error desconocido',
            type,
          })
        }
      } catch {}

      throw error
    }
  }

  /** Verifica si pg_dump y pg_restore están disponibles */
  private static async hasPgTools(): Promise<boolean> {
    try {
      await execAsync('pg_dump --version')
      await execAsync('pg_restore --version')
      return true
    } catch {
      return false
    }
  }

  /** Parsea DATABASE_URL y devuelve los componentes de conexión */
  private static parseDatabaseUrl() {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no configurada')
    }
    const url = new URL(databaseUrl)
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
    }
  }

  static async verifyBackupIntegrity(backupId: string): Promise<boolean> {
    try {
      const backup = await prisma.backups.findUnique({
        where: { id: backupId },
      })

      if (!backup || backup.status !== 'completed') {
        return false
      }

      // Verificar que el archivo existe
      try {
        await access(backup.filepath)
      } catch {
        return false
      }

      // Verificar checksum si existe
      if (backup.checksum) {
        const currentChecksum = await this.calculateChecksum(backup.filepath)
        return currentChecksum === backup.checksum
      }

      // Verificar que el archivo no está corrupto intentando leerlo
      const stats = await stat(backup.filepath)
      return stats.size > 0
    } catch (error) {
      console.error('Error al verificar integridad del backup:', error)
      return false
    }
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
      console.error('Error al obtener estadísticas de backup:', error)
      return {
        totalBackups: 0,
        totalSize: 0,
        successRate: 0,
        avgSize: 0,
      }
    }
  }

  private static async calculateChecksum(filepath: string): Promise<string> {
    try {
      const { readFile } = await import('fs/promises')
      const { createHash } = await import('crypto')

      // Para archivos grandes, usar streaming
      const stats = await stat(filepath)
      if (stats.size > 50 * 1024 * 1024) {
        // 50MB
        return this.calculateChecksumStream(filepath)
      }

      const data = await readFile(filepath)
      return createHash('sha256').update(data).digest('hex')
    } catch (error) {
      console.error('Error calculando checksum:', error)
      throw new Error('No se pudo calcular el checksum del archivo')
    }
  }

  private static async calculateChecksumStream(filepath: string): Promise<string> {
    const { createReadStream } = await import('fs')
    const { createHash } = await import('crypto')

    return new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      const stream = createReadStream(filepath)

      stream.on('data', data => hash.update(data))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  private static async compressFile(filepath: string): Promise<string> {
    const { createGzip } = await import('zlib')
    const { createReadStream, createWriteStream } = await import('fs')
    const { pipeline } = await import('stream/promises')

    const compressedPath = filepath + '.gz'

    await pipeline(
      createReadStream(filepath),
      createGzip({ level: this.COMPRESSION_LEVEL }),
      createWriteStream(compressedPath)
    )

    // Eliminar archivo original
    await unlink(filepath)

    return compressedPath
  }

  /**
   * Encripta un archivo de backup usando AES-256-GCM.
   *
   * Formato del archivo .enc:
   *   [4 bytes: longitud del IV] [16 bytes: IV] [16 bytes: auth tag] [N bytes: datos cifrados]
   *
   * Requiere la variable de entorno BACKUP_ENCRYPTION_KEY (mínimo 32 caracteres).
   * Genera un IV aleatorio por cada backup para garantizar que dos backups del mismo
   * contenido produzcan archivos cifrados distintos.
   */
  private static async encryptFile(filepath: string): Promise<string> {
    const key = process.env.BACKUP_ENCRYPTION_KEY
    if (!key || key.length < 32) {
      throw new Error(
        'BACKUP_ENCRYPTION_KEY no configurada o demasiado corta (mínimo 32 caracteres). ' +
          'Genera una con: openssl rand -hex 32'
      )
    }

    const { createCipheriv, randomBytes, createHash: nodeCreateHash } = await import('crypto')
    const { createReadStream, createWriteStream } = await import('fs')
    const { pipeline } = await import('stream/promises')

    // Derivar clave de 32 bytes desde la variable de entorno (SHA-256)
    const keyBuffer = nodeCreateHash('sha256').update(key).digest()

    // IV aleatorio de 16 bytes (recomendado para GCM: 12 bytes, pero 16 también funciona)
    const iv = randomBytes(16)

    const encryptedPath = filepath + '.enc'

    // Cifrar con AES-256-GCM (autenticado — detecta tampering)
    const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

    await pipeline(createReadStream(filepath), cipher, createWriteStream(encryptedPath))

    // El auth tag se obtiene DESPUÉS de que el pipeline termina
    const authTag = cipher.getAuthTag() // 16 bytes

    // Prepend: [4 bytes ivLen][iv][16 bytes authTag] al inicio del archivo cifrado
    // Leemos el archivo cifrado, anteponemos el header y reescribimos
    const { readFile: fsReadFile, writeFile: fsWriteFile } = await import('fs/promises')
    const encryptedData = await fsReadFile(encryptedPath)

    const ivLenBuf = Buffer.alloc(4)
    ivLenBuf.writeUInt32BE(iv.length, 0)

    const finalBuffer = Buffer.concat([ivLenBuf, iv, authTag, encryptedData])
    await fsWriteFile(encryptedPath, finalBuffer)

    // Eliminar archivo original sin cifrar
    await unlink(filepath)

    console.log(`Backup cifrado con AES-256-GCM: ${encryptedPath} (${finalBuffer.length} bytes)`)
    return encryptedPath
  }

  /**
   * Descifra un archivo .enc generado por encryptFile().
   * Devuelve la ruta del archivo descifrado (sin extensión .enc).
   */
  private static async decryptFile(encryptedPath: string): Promise<string> {
    const key = process.env.BACKUP_ENCRYPTION_KEY
    if (!key || key.length < 32) {
      throw new Error(
        'BACKUP_ENCRYPTION_KEY no configurada. No se puede descifrar el backup. ' +
          'Asegúrate de que la variable de entorno esté definida con la misma clave usada al cifrar.'
      )
    }

    const { createDecipheriv, createHash: nodeCreateHash } = await import('crypto')
    const { createWriteStream } = await import('fs')
    const { pipeline } = await import('stream/promises')
    const { readFile: fsReadFile } = await import('fs/promises')

    const keyBuffer = nodeCreateHash('sha256').update(key).digest()

    // Leer el archivo completo para extraer el header
    const fileData = await fsReadFile(encryptedPath)

    // Parsear header: [4 bytes ivLen][iv][16 bytes authTag][datos cifrados]
    const ivLen = fileData.readUInt32BE(0)
    const iv = fileData.subarray(4, 4 + ivLen)
    const authTag = fileData.subarray(4 + ivLen, 4 + ivLen + 16)
    const encryptedData = fileData.subarray(4 + ivLen + 16)

    // Descifrar
    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
    decipher.setAuthTag(authTag)

    const decryptedPath = encryptedPath.replace(/\.enc$/, '')
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(), // lanza error si el auth tag no coincide (archivo alterado)
    ])

    const { writeFile: fsWriteFile } = await import('fs/promises')
    await fsWriteFile(decryptedPath, decryptedData)

    console.log(`Backup descifrado: ${decryptedPath}`)
    return decryptedPath
  }

  private static async getBackupConfig() {
    try {
      const settings = await prisma.system_settings.findMany({
        where: {
          key: {
            in: [
              'backupEnabled',
              'backupFrequency',
              'backupRetention',
              'backupMaxCount',
              'backupCompression',
              'backupEncryption',
              'backupCloudStorage',
              'backupCloudProvider',
              'backupNotifications',
              'backupEmailNotifications',
              'backupVerifyIntegrity',
              'backupScheduleTime',
              'backupCronScope',
            ],
          },
        },
      })

      const raw = settings.reduce(
        (acc, s) => {
          acc[s.key] = s.value
          return acc
        },
        {} as Record<string, string>
      )

      return {
        enabled: raw.backupEnabled !== undefined ? raw.backupEnabled === 'true' : true,
        frequency: (raw.backupFrequency as 'daily' | 'weekly' | 'monthly') ?? 'daily',
        retentionDays: raw.backupRetention !== undefined ? parseInt(raw.backupRetention) : 30,
        maxBackups: raw.backupMaxCount !== undefined ? parseInt(raw.backupMaxCount) : 100,
        compression: raw.backupCompression !== undefined ? raw.backupCompression === 'true' : true,
        encryption: raw.backupEncryption !== undefined ? raw.backupEncryption === 'true' : false,
        cloudStorage:
          raw.backupCloudStorage !== undefined ? raw.backupCloudStorage === 'true' : false,
        cloudProvider: raw.backupCloudProvider ?? null,
        notifications:
          raw.backupNotifications !== undefined ? raw.backupNotifications === 'true' : true,
        emailNotifications: raw.backupEmailNotifications
          ? (() => {
              try {
                return JSON.parse(raw.backupEmailNotifications)
              } catch {
                return []
              }
            })()
          : [],
        verifyIntegrity:
          raw.backupVerifyIntegrity !== undefined ? raw.backupVerifyIntegrity === 'true' : true,
        scheduleTime: raw.backupScheduleTime ?? '02:00',
        cronScope: raw.backupCronScope === 'tickets' ? 'tickets' : 'full',
      }
    } catch (error) {
      console.error('Error loading backup config:', error)
      return {
        enabled: true,
        frequency: 'daily' as const,
        retentionDays: 30,
        maxBackups: 100,
        compression: true,
        encryption: false,
        cloudStorage: false,
        cloudProvider: null,
        notifications: true,
        emailNotifications: [],
        verifyIntegrity: true,
        scheduleTime: '02:00',
        cronScope: 'full' as const,
      }
    }
  }

  /** Ámbito del backup automático (cron): completo o solo módulo tickets. */
  static async getBackupCronModule(): Promise<BackupModuleId | null> {
    try {
      const row = await prisma.system_settings.findUnique({ where: { key: 'backupCronScope' } })
      if (row?.value === 'tickets' && isBackupModuleId('tickets')) {
        return 'tickets'
      }
    } catch {
      /* ignorar */
    }
    return null
  }

  private static async sendBackupNotification(type: 'success' | 'error', data: any) {
    try {
      // Obtener emails de notificación
      const emailSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupEmailNotifications' },
      })

      if (!emailSetting?.value) {
        console.log(`Notificación de backup ${type} (sin emails configurados):`, data)
        return
      }

      const emails = JSON.parse(emailSetting.value)
      if (!emails.length) {
        console.log(`Notificación de backup ${type} (sin emails):`, data)
        return
      }

      // TODO: Implementar envío de emails real
      console.log(`Notificación de backup ${type}:`, data, 'a emails:', emails)
    } catch (error) {
      console.error('Error al enviar notificación de backup:', error)
      // No lanzar error para no interrumpir el proceso de backup
    }
  }

  // Mantener métodos existentes
  static async verifyAndFixBackupStates(): Promise<void> {
    try {
      console.log('Verificando estados de backups...')

      const backups = await prisma.backups.findMany({
        where: {
          status: 'in_progress',
        },
      })

      for (const backup of backups) {
        try {
          const stats = await stat(backup.filepath)

          if (stats.size > 0) {
            // El archivo existe y tiene contenido, corregir estado
            await prisma.backups.update({
              where: { id: backup.id },
              data: {
                status: 'completed',
                size: stats.size,
                error: null,
              },
            })
            console.log(`Estado corregido para backup: ${backup.filename}`)
          } else {
            // El archivo está vacío, marcar como fallido
            await prisma.backups.update({
              where: { id: backup.id },
              data: {
                status: 'failed',
                error: 'Archivo de backup vacío',
              },
            })
          }
        } catch (error) {
          // El archivo no existe, marcar como fallido
          await prisma.backups.update({
            where: { id: backup.id },
            data: {
              status: 'failed',
              error: 'Archivo de backup no encontrado',
            },
          })
        }
      }
    } catch (error) {
      console.error('Error verificando estados de backup:', error)
    }
  }

  static async listBackups(): Promise<BackupInfo[]> {
    try {
      // Verificar y corregir estados inconsistentes automáticamente
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
      console.error('Error al listar backups:', error)
      return []
    }
  }

  static async deleteBackup(backupId: string): Promise<void> {
    try {
      const backup = await prisma.backups.findUnique({
        where: { id: backupId },
      })

      if (!backup) {
        // Si el backup no existe en la BD, considerarlo como ya eliminado
        console.log(
          `Backup ${backupId} no encontrado en la base de datos, posiblemente ya eliminado`
        )
        return // No lanzar error, simplemente retornar
      }

      // Intentar eliminar archivo físico (no fallar si no existe)
      try {
        await access(backup.filepath)
        await unlink(backup.filepath)
        console.log(`Archivo de backup eliminado: ${backup.filepath}`)
      } catch (error) {
        console.warn(
          `No se pudo eliminar el archivo de backup (puede que no exista): ${backup.filepath}`,
          error
        )
        // No lanzar error aquí, continuar con la eliminación del registro
      }

      // Eliminar registro de base de datos
      try {
        await prisma.backups.delete({
          where: { id: backupId },
        })
        console.log(`Registro de backup eliminado: ${backupId}`)
      } catch (dbError) {
        // Si el registro ya no existe, no es un error
        if (
          dbError instanceof Error &&
          dbError.message.includes('Record to delete does not exist')
        ) {
          console.log(`Registro de backup ${backupId} ya no existe en la base de datos`)
          return
        }
        throw dbError
      }

      // Registrar eliminación en auditoría
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
        // No fallar por esto
      }
    } catch (error) {
      console.error('Error al eliminar backup:', error)
      throw error
    }
  }

  static async restoreBackup(backupId: string, restoreModules?: string[]): Promise<void> {
    try {
      const backup = await prisma.backups.findUnique({
        where: { id: backupId },
      })

      if (!backup) {
        throw new Error('Backup no encontrado')
      }

      if (backup.status !== 'completed') {
        throw new Error('El backup no está completo')
      }

      // Verificar que el archivo existe
      await stat(backup.filepath)

      // Verificar integridad
      try {
        const isValid = await this.verifyBackupIntegrity(backupId)
        if (!isValid) {
          console.warn('[RESTORE] Advertencia: integridad no verificada, continuando...')
        }
      } catch (error) {
        console.warn('[RESTORE] No se pudo verificar integridad:', error)
      }

      // ── Descifrar si está encriptado ──
      let workingFilepath = backup.filepath
      let decryptedTempPath: string | null = null

      if (backup.filepath.endsWith('.enc')) {
        console.log('[RESTORE] Descifrando backup...')
        try {
          workingFilepath = await this.decryptFile(backup.filepath)
          decryptedTempPath = workingFilepath
        } catch (decryptError) {
          throw new Error(
            `No se pudo descifrar el backup: ${decryptError instanceof Error ? decryptError.message : 'Error desconocido'}. ` +
              'Verifica que BACKUP_ENCRYPTION_KEY sea la misma que se usó al crear el backup.'
          )
        }
      }

      // ── Detectar formato del backup ──
      const isDumpFormat = workingFilepath.endsWith('.dump')
      let isJsonBackup = false
      let isSqlBackup = false

      if (!isDumpFormat) {
        // Descomprimir gzip si es necesario
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
        `[RESTORE] Formato: ${format}` +
          (restoreModules?.length ? ` | Módulos: [${restoreModules.join(', ')}]` : ' | Completa')
      )

      // ── Ejecutar restauración según formato ──
      const hasPgRestore = await this.hasPgTools()
      const dbConfig = this.parseDatabaseUrl()

      if (isDumpFormat && hasPgRestore) {
        // ═══ MÉTODO PRINCIPAL: pg_restore (formato custom) ═══
        await this.restoreWithPgRestore(workingFilepath, dbConfig, restoreModules)
      } else if (isSqlBackup && hasPgRestore) {
        // Backup SQL plano — usar psql
        if (restoreModules?.length) {
          throw new Error(
            'La restauración selectiva no está disponible para backups SQL plano. ' +
              'Crea un nuevo backup (formato .dump) para usar restauración selectiva.'
          )
        }
        await this.restoreFromSQL({ ...backup, filepath: workingFilepath })
      } else if (isJsonBackup) {
        // Fallback JSON/Prisma
        await this.restoreFromJSON({ ...backup, filepath: workingFilepath }, restoreModules)
      } else if (isDumpFormat && !hasPgRestore) {
        throw new Error(
          'pg_restore no está disponible en el servidor. ' +
            'Instala postgresql-client para restaurar backups en formato .dump'
        )
      } else {
        throw new Error('No se pudo detectar el formato del backup')
      }

      // Limpiar archivos temporales
      if (decryptedTempPath) {
        try {
          await unlink(decryptedTempPath)
        } catch {}
      }

      // Auditoría
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'backup_restored',
          entityType: 'System',
          entityId: 'backup',
          createdAt: new Date(),
          details: {
            backupId: backup.id,
            filename: backup.filename,
            method: format,
            restoreModules: restoreModules?.join(', ') || 'full',
            restoredAt: new Date(),
          },
        },
      })

      console.log('[RESTORE] Restauración completada exitosamente')
    } catch (error) {
      console.error('[RESTORE] Error:', error)
      throw error
    }
  }

  /**
   * Restaura usando pg_restore (formato custom .dump).
   * Soporta restauración selectiva por tablas usando --table.
   */
  private static async restoreWithPgRestore(
    filepath: string,
    dbConfig: { host: string; port: string; database: string; username: string; password: string },
    restoreModules?: string[]
  ): Promise<void> {
    let tableFlags = ''

    if (restoreModules?.length) {
      // Restauración selectiva: obtener las tablas de cada módulo
      const tables = this.getTablesForModules(restoreModules)
      // pg_restore --table acepta múltiples --table flags
      tableFlags = tables.map(t => `--table="${t}"`).join(' ')
      console.log(
        `[RESTORE] Restauración selectiva: ${tables.length} tablas de ${restoreModules.length} módulo(s)`
      )
    }

    // pg_restore con formato custom:
    // --clean: DROP antes de CREATE (solo para las tablas que restaura)
    // --if-exists: no falla si la tabla no existe
    // --no-owner: no intenta cambiar ownership
    // --single-transaction: todo o nada
    const command =
      `PGPASSWORD="${dbConfig.password}" pg_restore ` +
      `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
      `--clean --if-exists --no-owner --no-privileges --single-transaction ` +
      `${tableFlags} ` +
      `"${filepath}" 2>&1 || true`

    console.log('[RESTORE] Ejecutando pg_restore...')

    const { stdout } = await execAsync(command, {
      timeout: 600000, // 10 minutos
      maxBuffer: 1024 * 1024 * 50,
    })

    // pg_restore puede reportar warnings que no son errores fatales
    if (stdout && stdout.includes('ERROR')) {
      const errors = stdout.split('\n').filter(l => l.includes('ERROR'))
      // Filtrar errores no críticos (tabla no existe para DROP, etc.)
      const criticalErrors = errors.filter(
        e => !e.includes('does not exist') && !e.includes('already exists')
      )
      if (criticalErrors.length > 0) {
        console.warn('[RESTORE] Errores durante pg_restore:', criticalErrors.slice(0, 5).join('\n'))
      }
    }

    console.log('[RESTORE] pg_restore completado')
  }

  /**
   * Mapea módulos a sus tablas correspondientes en la BD.
   */
  private static getTablesForModules(modules: string[]): string[] {
    const moduleTableMap: Record<string, readonly string[]> = {
      tickets: TICKETS_MODULE_RESTORE_ORDER,
      news: NEWS_MODULE_RESTORE_ORDER,
      patrols: PATROLS_MODULE_RESTORE_ORDER,
      families: FAMILIES_MODULE_RESTORE_ORDER,
      audits: AUDITS_MODULE_RESTORE_ORDER,
      configurations: CONFIGURATIONS_MODULE_RESTORE_ORDER,
      users: USERS_MODULE_RESTORE_ORDER,
    }

    const tables: string[] = []
    for (const mod of modules) {
      const modTables = moduleTableMap[mod]
      if (modTables) {
        tables.push(...modTables)
      }
    }
    // Eliminar duplicados
    return [...new Set(tables)]
  }

  /**
   * Restaura un backup SQL usando psql.
   */
  private static async restoreFromSQL(backup: {
    id: string
    filename: string
    filepath: string
  }): Promise<void> {
    console.log('[RESTORE] Iniciando restauración SQL...')

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL no configurada')

    const url = new URL(databaseUrl)
    const dbConfig = {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
    }

    let sourceFile = backup.filepath

    // Descomprimir si es necesario
    if (backup.filepath.endsWith('.gz')) {
      console.log('[RESTORE] Descomprimiendo backup...')
      const decompressedPath = backup.filepath.replace('.gz', '')
      await execAsync(`gunzip -c "${backup.filepath}" > "${decompressedPath}"`)
      sourceFile = decompressedPath
    }

    console.log(`[RESTORE] Archivo de backup: ${sourceFile}`)
    console.log(`[RESTORE] Conectando a ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)

    try {
      // Intentar con psql directamente
      console.log('[RESTORE] Intentando con psql...')
      await execAsync('which psql')
      console.log('[RESTORE] psql está disponible')

      const command = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${sourceFile}" --single-transaction`

      const { stderr, stdout } = await execAsync(command, {
        timeout: 600000,
        maxBuffer: 1024 * 1024 * 100,
      })

      if (stdout) console.log('[RESTORE] Salida:', stdout)
      if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
        console.warn('[RESTORE] Advertencias:', stderr)
      }

      console.log('[RESTORE] Restauración SQL completada exitosamente!')
      return
    } catch (psqlError) {
      console.error('[RESTORE] Error con psql:', psqlError)
      throw new Error(
        'No se pudo restaurar el backup. Asegúrate de que el contenedor de la app tenga postgresql-client instalado. ' +
          'Si usas Docker, reconstruye el contenedor con: docker compose -f docker-compose.dev.yml up --build'
      )
    } finally {
      // Limpiar archivo descomprimido temporal
      if (sourceFile !== backup.filepath) {
        try {
          await unlink(sourceFile)
        } catch {
          /* ignorar */
        }
      }
    }
  }

  /**
   * Restaura un backup JSON generado por el método Prisma.
   * Si se pasa restoreModules, solo restaura las tablas de esos módulos (restauración selectiva).
   */
  private static async restoreFromJSON(
    backup: {
      id: string
      filename: string
      filepath: string
    },
    restoreModules?: string[]
  ): Promise<void> {
    // Leer el contenido del backup
    const backupContent = await readFile(backup.filepath, 'utf-8')

    let backupData: any
    try {
      backupData = JSON.parse(backupContent)
    } catch (error) {
      throw new Error(
        'El archivo de backup no tiene un formato JSON válido. Si es un backup SQL (.sql), asegúrate de que psql esté instalado.'
      )
    }

    // Detectar y normalizar el formato del backup
    let normalizedData: any

    if (backupData.metadata && backupData.data) {
      // Formato v2 (nuevo — tabla directa por nombre real)
      console.log('Detectado formato de backup v2 (Prisma completo)')
      normalizedData = backupData.data
    } else if (backupData.tables) {
      // Formato v1 (anterior — nombres de tabla en camelCase)
      console.log('Detectado formato de backup v1 (Prisma básico)')
      normalizedData = backupData.tables
    } else {
      throw new Error(
        'El archivo de backup no tiene una estructura reconocida. Claves encontradas: ' +
          Object.keys(backupData).join(', ')
      )
    }

    console.log('Iniciando restauración JSON:', backup.filename)
    console.log('Tablas disponibles:', Object.keys(normalizedData))

    // Mapear nombres de tablas del formato v1 al nombre real de Prisma
    const tableMapping: Record<string, string> = {
      users: 'users',
      categories: 'categories',
      tickets: 'tickets',
      ticketComments: 'comments',
      comments: 'comments',
      notifications: 'notifications',
      auditLogs: 'audit_logs',
      technician_assignments: 'technician_assignments',
      ticketRatings: 'ticket_ratings',
      ticket_ratings: 'ticket_ratings',
      ticketHistory: 'ticket_history',
      ticket_history: 'ticket_history',
      attachments: 'attachments',
      notificationPreferences: 'notification_preferences',
      notification_preferences: 'notification_preferences',
      oauthAccounts: 'oauth_accounts',
      oauth_accounts: 'oauth_accounts',
      accounts: 'accounts',
      sessions: 'sessions',
      pages: 'pages',
      siteConfig: 'site_config',
      site_config: 'site_config',
      systemSettings: 'system_settings',
      system_settings: 'system_settings',
      systemModules: 'system_modules',
      system_modules: 'system_modules',
      backups: 'backups',
      verificationTokens: 'verification_tokens',
      verification_tokens: 'verification_tokens',
      passwordResetTokens: 'password_reset_tokens',
      password_reset_tokens: 'password_reset_tokens',
      userSettings: 'user_settings',
      user_settings: 'user_settings',
      adminFamilyAssignments: 'admin_family_assignments',
      admin_family_assignments: 'admin_family_assignments',
      clientFamilyAssignments: 'client_family_assignments',
      client_family_assignments: 'client_family_assignments',
      technicianFamilyAssignments: 'technician_family_assignments',
      technician_family_assignments: 'technician_family_assignments',
      inventoryManagerFamilies: 'inventory_manager_families',
      inventory_manager_families: 'inventory_manager_families',
    }

    // Normalizar nombres de tablas (v1 → nombre real)
    const mappedData: Record<string, any[]> = {}
    for (const [oldName, data] of Object.entries(normalizedData)) {
      const realName = tableMapping[oldName] ?? oldName
      mappedData[realName] = Array.isArray(data) ? data : []
    }

    console.log('Tablas a restaurar:', Object.keys(mappedData))

    // Determinar los módulos a restaurar:
    // 1. Si el usuario pidió restaurar módulos específicos (restoreModules), usar esos
    // 2. Si el backup ya es de un módulo específico (backupModule), usar ese
    // 3. Si ninguno, restaurar todo
    const backupModule = backupData.metadata?.module as string | undefined
    const effectiveModules: string[] = restoreModules?.length
      ? restoreModules
      : backupModule
        ? [backupModule]
        : []

    if (effectiveModules.length > 0) {
      // Restaurar cada módulo secuencialmente
      for (const effectiveModule of effectiveModules) {
        let restoreOrder
        switch (effectiveModule) {
          case 'tickets':
            restoreOrder = TICKETS_MODULE_RESTORE_ORDER
            break
          case 'news':
            restoreOrder = NEWS_MODULE_RESTORE_ORDER
            break
          case 'patrols':
            restoreOrder = PATROLS_MODULE_RESTORE_ORDER
            break
          case 'families':
            restoreOrder = FAMILIES_MODULE_RESTORE_ORDER
            break
          case 'audits':
            restoreOrder = AUDITS_MODULE_RESTORE_ORDER
            break
          case 'configurations':
            restoreOrder = CONFIGURATIONS_MODULE_RESTORE_ORDER
            break
          case 'users':
            restoreOrder = USERS_MODULE_RESTORE_ORDER
            break
          default:
            throw new Error(`Módulo no soportado para restauración: ${effectiveModule}`)
        }
        const scoped: Record<string, any[]> = {}
        for (const key of restoreOrder) {
          scoped[key] = mappedData[key] ?? []
        }

        // Verificar que el backup contiene datos para este módulo
        const hasData = Object.values(scoped).some(arr => arr.length > 0)
        if (!hasData) {
          console.warn(
            `[RESTORE] El backup no contiene datos para el módulo "${effectiveModule}", omitiendo.`
          )
          continue
        }

        console.log(`[RESTORE] Restauración selectiva: módulo "${effectiveModule}"`)
        await this.restoreModuleFromJSON(effectiveModule, scoped, restoreOrder)
      }
      return
    }

    // Orden de restauración respetando dependencias de FK
    const restoreOrder = [
      // Tablas base
      'users',
      'departments',
      'families',
      'categories',
      'system_settings',
      'system_modules',
      'site_config',
      'pages',
      'oauth_configs',
      'equipment_types',
      'suppliers',
      'warehouses',
      // Asignaciones de familia
      'admin_family_assignments',
      'technician_family_assignments',
      'client_family_assignments',
      'inventory_manager_families',
      // Usuarios relacionados
      'user_settings',
      'notification_preferences',
      'technician_assignments',
      'oauth_accounts',
      'sessions',
      'accounts',
      'password_reset_tokens',
      // Tickets
      'tickets',
      'comments',
      'attachments',
      'ticket_history',
      'ticket_ratings',
      'ticket_collaborators',
      'notifications',
      'audit_logs',
      // SLA
      'sla_policies',
      'sla_violations',
      'ticket_sla_metrics',
      // Conocimiento
      'knowledge_articles',
      'article_votes',
      'ticket_knowledge_articles',
      // Inventario
      'equipment',
      'equipment_assignments',
      'equipment_attachments',
      'maintenance_records',
      'software_licenses',
      'license_attachments',
      'consumables',
      'stock_movements',
      'delivery_acts',
      'return_acts',
      'decommission_requests',
      'decommission_acts',
      'decommission_attachments',
      // Contratos
      'contracts',
      'contract_lines',
      'contract_attachments',
      // Planes
      'resolution_plans',
      'resolution_tasks',
      // Webhooks
      'webhooks',
      'webhook_logs',
      // Landing
      'landing_page_content',
      'landing_page_services',
      'landing_page_banners',
      // Otros
      'email_queue',
      'category_analytics',
      'backups',
      'verification_tokens',
    ]

    await prisma.$transaction(
      async tx => {
        // Deshabilitar FK constraints para limpiar en cualquier orden
        await tx.$executeRaw(Prisma.sql`SET session_replication_role = replica;`)

        // Limpiar todas las tablas que vamos a restaurar
        for (const tableName of [...restoreOrder].reverse()) {
          if (mappedData[tableName]?.length > 0) {
            try {
              await tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${tableName}"`)};`)
            } catch (err) {
              console.warn(`⚠ No se pudo limpiar tabla ${tableName}:`, (err as Error).message)
            }
          }
        }

        // Rehabilitar FK constraints
        await tx.$executeRaw(Prisma.sql`SET session_replication_role = DEFAULT;`)

        // Restaurar en orden correcto
        for (const tableName of restoreOrder) {
          const tableData = mappedData[tableName]
          if (!tableData?.length) continue

          console.log(`Restaurando ${tableData.length} registros → ${tableName}`)

          const processed = tableData.map(r => this.processRecordForRestore(r))

          // Usar SAVEPOINT para que un error en una tabla no aborte toda la transacción
          try {
            await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_table;`)
            await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
            await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_table;`)
          } catch (bulkErr) {
            await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_table;`)
            console.warn(
              `createMany falló para ${tableName}: ${(bulkErr as Error).message?.slice(0, 150)}`
            )
            console.warn(`Intentando inserción individual para ${tableName}...`)

            let insertedCount = 0
            for (let i = 0; i < processed.length; i++) {
              try {
                await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_record;`)
                await (tx as any)[tableName].create({ data: processed[i] })
                await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_record;`)
                insertedCount++
              } catch (recordErr) {
                await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_record;`)
                if (i === 0) {
                  // Solo loguear el primer error para no saturar los logs
                  console.warn(
                    `⚠ ${tableName} registro ${i + 1} omitido: ${(recordErr as Error).message?.slice(0, 120)}`
                  )
                }
              }
            }
            console.log(`${tableName}: ${insertedCount}/${processed.length} registros insertados`)
          }
        }
      },
      { timeout: 600000 }
    ) // 10 minutos

    console.log('Restauración JSON completada exitosamente')
  }

  /**
   * Restaura solo filas del módulo especificado incluidas en el backup (no borra el resto de la BD).
   * Usa estrategia upsert: borra solo los registros por ID que va a reinsertar, no toda la tabla.
   */
  private static async restoreModuleFromJSON(
    moduleId: string,
    mappedData: Record<string, any[]>,
    restoreOrder: readonly string[]
  ): Promise<void> {
    await prisma.$transaction(
      async tx => {
        // Deshabilitar FK constraints para poder borrar/insertar en cualquier orden
        await tx.$executeRaw(Prisma.sql`SET session_replication_role = replica;`)

        // Insertar/actualizar datos en orden correcto
        for (const tableName of restoreOrder) {
          const tableData = mappedData[tableName]
          if (!tableData?.length) continue

          const processed = tableData.map((r: any) => this.processRecordForRestore(r))

          console.log(
            `[módulo ${moduleId}] Restaurando ${processed.length} registros → ${tableName}`
          )

          // Borrar SOLO los registros que vamos a reinsertar (por ID), no toda la tabla
          const ids = processed.map((r: any) => r.id).filter(Boolean)
          if (ids.length > 0) {
            try {
              const idList = ids.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',')
              await tx.$executeRaw(
                Prisma.sql`DELETE FROM ${Prisma.raw(`"${tableName}"`)} WHERE id IN (${Prisma.raw(idList)});`
              )
            } catch (delErr) {
              console.warn(
                `[módulo ${moduleId}] ⚠ No se pudo limpiar IDs de ${tableName}: ${(delErr as Error).message?.slice(0, 100)}`
              )
            }
          }

          // Insertar los registros
          try {
            await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_table;`)
            await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
            await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_table;`)
          } catch (bulkErr) {
            await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_table;`)
            console.warn(
              `[módulo ${moduleId}] createMany falló para ${tableName}: ${(bulkErr as Error).message?.slice(0, 150)}`
            )
            console.warn(`[módulo ${moduleId}] Intentando upsert individual para ${tableName}...`)

            let insertedCount = 0
            for (let i = 0; i < processed.length; i++) {
              try {
                await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_record;`)
                if (processed[i].id) {
                  await (tx as any)[tableName].upsert({
                    where: { id: processed[i].id },
                    update: processed[i],
                    create: processed[i],
                  })
                } else {
                  await (tx as any)[tableName].create({ data: processed[i] })
                }
                await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_record;`)
                insertedCount++
              } catch (recordErr) {
                await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_record;`)
                if (i < 3) {
                  console.warn(
                    `[módulo ${moduleId}] ⚠ ${tableName}[${i}] error: ${(recordErr as Error).message?.slice(0, 150)}`
                  )
                }
              }
            }
            console.log(
              `[módulo ${moduleId}] ${tableName}: ${insertedCount}/${processed.length} registros restaurados`
            )
          }
        }

        await tx.$executeRaw(Prisma.sql`SET session_replication_role = DEFAULT;`)
      },
      { timeout: 600000 }
    )

    console.log(`Restauración JSON módulo ${moduleId} completada`)
  }

  private static processRecordForRestore(record: any): any {
    const processed = { ...record }

    // Eliminar campos que son relaciones de Prisma (objetos o arrays anidados)
    // Estos no deben enviarse en create/createMany
    for (const [key, value] of Object.entries(processed)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        // Si es un array o un objeto anidado (relación), eliminarlo
        if (Array.isArray(value) || (typeof value === 'object' && !ArrayBuffer.isView(value))) {
          // Excepto si es un JSON field legítimo (como 'details', 'metadata', 'config', etc.)
          const jsonFields = [
            'details',
            'metadata',
            'config',
            'settings',
            'preferences',
            'data',
            'content',
            'options',
            'filters',
            'headers',
            'payload',
            'response',
            'context',
          ]
          if (!jsonFields.includes(key)) {
            delete processed[key]
          }
        }
      }
    }

    // Convertir campos de fecha de string a Date
    const dateFields = [
      'createdAt',
      'updatedAt',
      'lastLogin',
      'dueDate',
      'resolvedAt',
      'closedAt',
      'firstResponseAt',
      'slaDeadline',
      'startDate',
      'targetDate',
      'completedDate',
      'completedAt',
      'notifiedAt',
      'expectedAt',
      'actualAt',
    ]

    for (const field of dateFields) {
      if (processed[field] && typeof processed[field] === 'string') {
        processed[field] = new Date(processed[field])
      }
    }

    return processed
  }

  static async cleanOldBackups(): Promise<void> {
    try {
      // Obtener configuración de retención
      // La clave en system_settings es 'backupRetention' (sin 'Days')
      const retentionSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupRetention' },
      })

      const retentionDays = retentionSetting ? parseInt(retentionSetting.value) : 30

      // Validar valor de retención
      if (isNaN(retentionDays) || retentionDays < 1) {
        console.warn('Valor de retención inválido, usando 30 días por defecto')
        return
      }

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      console.log(`Limpiando backups automáticos anteriores a ${cutoffDate.toISOString()}`)

      // Buscar backups antiguos (solo automáticos)
      const oldBackups = await prisma.backups.findMany({
        where: {
          createdAt: { lt: cutoffDate },
          type: 'automatic', // Solo eliminar backups automáticos
          status: 'completed', // Solo eliminar backups completados
        },
      })

      if (oldBackups.length === 0) {
        console.log('No hay backups antiguos para limpiar')
        return
      }

      let deletedCount = 0
      let failedCount = 0

      // Eliminar backups antiguos
      for (const backup of oldBackups) {
        try {
          // Intentar eliminar archivo físico
          try {
            await access(backup.filepath)
            await unlink(backup.filepath)
          } catch (fileError) {
            console.warn(`Archivo no encontrado o no se pudo eliminar: ${backup.filepath}`)
          }

          // Eliminar registro de base de datos
          await prisma.backups.delete({
            where: { id: backup.id },
          })

          deletedCount++
        } catch (error) {
          console.error(`Error al eliminar backup ${backup.id}:`, error)
          failedCount++
        }
      }

      console.log(
        `Limpieza completada: ${deletedCount} backups eliminados, ${failedCount} fallidos`
      )
    } catch (error) {
      console.error('Error al limpiar backups antiguos:', error)
      throw new Error(
        `Error en limpieza de backups: ${error instanceof Error ? error.message : 'Error desconocido'}`
      )
    }
  }

  private static async createBackupWithPrisma(filepath: string): Promise<void> {
    try {
      console.log('Creando backup usando método alternativo con Prisma')

      const backupData: Record<string, any[]> = {}

      // ── Tablas base (sin dependencias) ────────────────────────────────────
      const fetchTable = async (name: string, fetcher: () => Promise<any[]>) => {
        try {
          backupData[name] = await fetcher()
          console.log(`  ✓ ${name}: ${backupData[name].length} registros`)
        } catch (err) {
          console.warn(`  ⚠ ${name}: no se pudo exportar —`, (err as Error).message)
          backupData[name] = []
        }
      }

      await fetchTable('users', () => prisma.users.findMany())
      await fetchTable('departments', () => prisma.departments.findMany())
      await fetchTable('families', () => prisma.families.findMany())
      await fetchTable('categories', () => prisma.categories.findMany())
      await fetchTable('system_settings', () => prisma.system_settings.findMany())
      await fetchTable('system_modules', () => prisma.system_modules.findMany())
      await fetchTable('site_config', () => prisma.site_config.findMany())
      await fetchTable('pages', () => prisma.pages.findMany())
      await fetchTable('oauth_configs', () => prisma.oauth_configs.findMany())
      await fetchTable('equipment_types', () => prisma.equipment_types.findMany())
      await fetchTable('suppliers', () => prisma.suppliers.findMany())
      await fetchTable('warehouses', () => prisma.warehouses.findMany())

      // ── Tablas de asignaciones de familia ─────────────────────────────────
      await fetchTable('admin_family_assignments', () => prisma.admin_family_assignments.findMany())
      await fetchTable('technician_family_assignments', () =>
        prisma.technician_family_assignments.findMany()
      )
      await fetchTable('client_family_assignments', () =>
        prisma.client_family_assignments.findMany()
      )
      await fetchTable('inventory_manager_families', () =>
        prisma.inventory_manager_families.findMany()
      )

      // ── Tablas de usuarios ────────────────────────────────────────────────
      await fetchTable('user_settings', () => prisma.user_settings.findMany())
      await fetchTable('notification_preferences', () => prisma.notification_preferences.findMany())
      await fetchTable('technician_assignments', () => prisma.technician_assignments.findMany())
      await fetchTable('oauth_accounts', () => prisma.oauth_accounts.findMany())
      await fetchTable('sessions', () => prisma.sessions.findMany())
      await fetchTable('accounts', () => prisma.accounts.findMany())
      await fetchTable('password_reset_tokens', () => prisma.password_reset_tokens.findMany())

      // ── Tickets y relacionados ────────────────────────────────────────────
      await fetchTable('tickets', () => prisma.tickets.findMany())
      await fetchTable('comments', () => prisma.comments.findMany())
      await fetchTable('attachments', () => prisma.attachments.findMany())
      await fetchTable('ticket_history', () => prisma.ticket_history.findMany())
      await fetchTable('ticket_ratings', () => prisma.ticket_ratings.findMany())
      await fetchTable('ticket_collaborators', () => prisma.ticket_collaborators.findMany())
      await fetchTable('notifications', () => prisma.notifications.findMany())
      await fetchTable('audit_logs', () => prisma.audit_logs.findMany())

      // ── SLA ───────────────────────────────────────────────────────────────
      await fetchTable('sla_policies', () => prisma.sla_policies.findMany())
      await fetchTable('sla_violations', () => prisma.sla_violations.findMany())
      await fetchTable('ticket_sla_metrics', () => prisma.ticket_sla_metrics.findMany())

      // ── Conocimiento ──────────────────────────────────────────────────────
      await fetchTable('knowledge_articles', () => prisma.knowledge_articles.findMany())
      await fetchTable('article_votes', () => prisma.article_votes.findMany())
      await fetchTable('ticket_knowledge_articles', () =>
        prisma.ticket_knowledge_articles.findMany()
      )

      // ── Inventario ────────────────────────────────────────────────────────
      await fetchTable('equipment', () => prisma.equipment.findMany())
      await fetchTable('equipment_assignments', () => prisma.equipment_assignments.findMany())
      await fetchTable('equipment_attachments', () => prisma.equipment_attachments.findMany())
      await fetchTable('maintenance_records', () => prisma.maintenance_records.findMany())
      await fetchTable('software_licenses', () => prisma.software_licenses.findMany())
      await fetchTable('license_attachments', () => prisma.license_attachments.findMany())
      await fetchTable('consumables', () => prisma.consumables.findMany())
      await fetchTable('stock_movements', () => prisma.stock_movements.findMany())
      await fetchTable('delivery_acts', () => prisma.delivery_acts.findMany())
      await fetchTable('return_acts', () => prisma.return_acts.findMany())
      await fetchTable('decommission_requests', () => prisma.decommission_requests.findMany())
      await fetchTable('decommission_acts', () => prisma.decommission_acts.findMany())
      await fetchTable('decommission_attachments', () => prisma.decommission_attachments.findMany())

      // ── Contratos ─────────────────────────────────────────────────────────
      await fetchTable('contracts', () => prisma.contracts.findMany())
      await fetchTable('contract_lines', () => prisma.contract_lines.findMany())
      await fetchTable('contract_attachments', () => prisma.contract_attachments.findMany())

      // ── Resolución y planes ───────────────────────────────────────────────
      await fetchTable('resolution_plans', () => prisma.resolution_plans.findMany())
      await fetchTable('resolution_tasks', () => prisma.resolution_tasks.findMany())

      // ── Webhooks ──────────────────────────────────────────────────────────
      await fetchTable('webhooks', () => prisma.webhooks.findMany())
      await fetchTable('webhook_logs', () => prisma.webhook_logs.findMany())

      // ── Landing page ──────────────────────────────────────────────────────
      await fetchTable('landing_page_content', () => prisma.landing_page_content.findMany())
      await fetchTable('landing_page_services', () => prisma.landing_page_services.findMany())
      await fetchTable('landing_page_banners', () => prisma.landing_page_banners.findMany())

      // ── Otros ─────────────────────────────────────────────────────────────
      await fetchTable('email_queue', () => prisma.email_queue.findMany())
      await fetchTable('category_analytics', () => prisma.category_analytics.findMany())
      await fetchTable('backups', () => prisma.backups.findMany())
      await fetchTable('verification_tokens', () => prisma.verification_tokens.findMany())

      const output = JSON.stringify(
        {
          metadata: {
            version: '2.0',
            timestamp: new Date().toISOString(),
            method: 'prisma',
            tables: Object.keys(backupData),
            totalRecords: Object.values(backupData).reduce((s, t) => s + t.length, 0),
          },
          data: backupData,
        },
        null,
        2
      )

      await writeFile(filepath, output, 'utf-8')
      console.log(
        `Backup Prisma creado: ${Object.keys(backupData).length} tablas, ${output.length} bytes`
      )
    } catch (error) {
      console.error('Error en backup alternativo:', error)
      throw error
    }
  }

  static async importBackupFromFile(
    fileBuffer: Buffer,
    originalFilename: string
  ): Promise<BackupInfo> {
    await this.ensureBackupDirectory()

    let filename = originalFilename
    let detectedModule: string | null = null
    let encrypted = false
    let compressed = false

    // Detectar si es cifrado
    if (filename.endsWith('.enc')) {
      encrypted = true
    }

    // Detectar si es comprimido
    if (filename.includes('.gz')) {
      compressed = true
    }

    // Intentar detectar módulo del nombre del archivo
    const moduleNames = [
      'tickets',
      'news',
      'patrols',
      'families',
      'users',
      'audits',
      'configurations',
    ]
    for (const mod of moduleNames) {
      if (filename.includes(mod)) {
        detectedModule = mod
        break
      }
    }

    // Si es JSON sin cifrar ni comprimir, intentar leer metadata
    if (!encrypted && !compressed && filename.endsWith('.json')) {
      try {
        const content = fileBuffer.toString('utf-8').slice(0, 500)
        const partial = JSON.parse(
          content.includes('"data"') ? content.split('"data"')[0] + '"data":{}}' : content
        )
        if (partial?.metadata?.module) {
          detectedModule = partial.metadata.module
        }
      } catch {
        // No se pudo parsear, usar detección por nombre
      }
    }

    if (!filename.startsWith('backup-')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const ext = filename.split('.').slice(1).join('.') || 'sql'
      filename = detectedModule
        ? `backup-${detectedModule}-imported-${timestamp}.${ext}`
        : `backup-imported-${timestamp}.${ext}`
    }

    const filepath = join(this.BACKUP_DIR, filename)
    await writeFile(filepath, fileBuffer)

    const stats = await stat(filepath)

    if (stats.size === 0) {
      await unlink(filepath)
      throw new Error('El archivo de backup está vacío')
    }

    const backupRecord = await prisma.backups.create({
      data: {
        id: randomUUID(),
        filename,
        filepath,
        size: stats.size,
        type: 'manual',
        status: 'completed',
        module: detectedModule,
        compressed,
        encrypted,
        createdAt: new Date(),
      },
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_imported',
        entityType: 'System',
        entityId: backupRecord.id,
        createdAt: new Date(),
        details: {
          filename,
          originalFilename,
          size: stats.size,
          detectedModule,
          encrypted,
          compressed,
          importedAt: new Date(),
        },
      },
    })

    return {
      id: backupRecord.id,
      filename: backupRecord.filename,
      size: stats.size,
      createdAt: backupRecord.createdAt,
      type: 'manual',
      status: 'completed',
      module: detectedModule,
      compressed,
      encrypted,
    }
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  static async scheduleAutomaticBackup(): Promise<void> {
    try {
      // Verificar si los backups automáticos están habilitados
      const backupEnabledSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupEnabled' },
      })

      if (!backupEnabledSetting || backupEnabledSetting.value !== 'true') {
        return
      }

      // Obtener frecuencia de backup
      const frequencySetting = await prisma.system_settings.findUnique({
        where: { key: 'backupFrequency' },
      })

      const frequency = frequencySetting?.value || 'daily'

      // Verificar si es necesario crear un backup
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

        switch (frequency) {
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
        await this.createBackup('automatic')
        console.log('Backup automático creado exitosamente')
      }
    } catch (error) {
      console.error('Error en backup automático:', error)
    }
  }

  /**
   * Sube un backup al proveedor cloud configurado.
   * Se llama de forma fire-and-forget desde createBackup.
   */
  private static async uploadToCloud(
    backupId: string,
    filepath: string,
    provider: CloudProvider
  ): Promise<void> {
    try {
      console.log(`[CLOUD] Iniciando subida a ${provider}: ${filepath}`)
      const result = await BackupCloudService.uploadBackup(backupId, filepath, provider)

      // Registrar en auditoría
      await prisma.audit_logs
        .create({
          data: {
            id: randomUUID(),
            action: 'backup_uploaded_cloud',
            entityType: 'System',
            entityId: backupId,
            createdAt: new Date(),
            details: {
              provider: result.provider,
              fileId: result.fileId,
              fileName: result.fileName,
              webViewLink: result.webViewLink ?? null,
              size: result.size,
            },
          },
        })
        .catch(() => {})

      console.log(`[CLOUD] Backup subido exitosamente a ${provider}: ${result.fileId}`)
    } catch (error) {
      console.error(`[CLOUD] Error subiendo backup a ${provider}:`, error)
      // No lanzar — el backup local ya está guardado correctamente
    }
  }
}
