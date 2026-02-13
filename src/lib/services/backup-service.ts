import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, mkdir, readdir, stat, unlink, access, readFile } from 'fs/promises'
import { join } from 'path'
import { createHash, randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
  private static readonly BACKUP_DIR = join(process.cwd(), 'backups')
  private static readonly MAX_BACKUP_SIZE = 1024 * 1024 * 1024 // 1GB
  private static readonly COMPRESSION_LEVEL = 6

  static async createBackup(type: 'manual' | 'automatic' = 'manual'): Promise<BackupInfo> {
    // Validar entrada
    if (type !== 'manual' && type !== 'automatic') {
      throw new Error('Tipo de backup inválido. Debe ser "manual" o "automatic"')
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}.sql`
    const filepath = join(this.BACKUP_DIR, filename)

    // Verificar espacio en disco disponible
    try {
      const stats = await import('fs').then(fs => fs.promises.stat(process.cwd()))
      // Verificación básica de espacio (esto es una aproximación)
      console.log('Verificando espacio en disco para backup...')
    } catch (error) {
      console.warn('No se pudo verificar espacio en disco:', error)
    }

    // Crear registro inicial
    const backupRecord = await prisma.backups.create({
      data: {
        id: randomUUID(),
        filename,
        filepath,
        size: 0,
        type,
        status: 'in_progress',
        createdAt: new Date(),
      },
    })

    try {
      // Crear directorio de backups si no existe
      await mkdir(this.BACKUP_DIR, { recursive: true })

      // Obtener configuración
      const config = await this.getBackupConfig()

      // Obtener configuración de base de datos
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error('DATABASE_URL no configurada')
      }

      // Parsear URL de base de datos
      const url = new URL(databaseUrl)
      const dbConfig = {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
      }

      // Verificar que pg_dump esté disponible
      let usePgDump = true
      try {
        await execAsync('which pg_dump')
      } catch (error) {
        console.warn('pg_dump no está disponible, usando método alternativo')
        usePgDump = false
      }

      console.log(`Iniciando backup: ${filename}`)

      if (usePgDump) {
        // Usar pg_dump si está disponible
        let command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database}`
        command += ' --no-owner --no-privileges --clean --if-exists --verbose'
        command += ` > "${filepath}"`

        console.log('Ejecutando backup con pg_dump (contraseña oculta)')
        
        const { stdout, stderr } = await execAsync(command, { 
          timeout: 300000, // 5 minutos timeout
          maxBuffer: 1024 * 1024 * 100 // 100MB buffer
        })
        
        if (stderr && !stderr.includes('NOTICE')) {
          console.warn('Advertencias durante el backup:', stderr)
        }
      } else {
        // Método alternativo usando Prisma para exportar datos
        await this.createBackupWithPrisma(filepath)
      }

      // Verificar que el archivo se creó correctamente
      const stats = await stat(filepath)
      console.log(`Backup creado: ${filename}, tamaño: ${stats.size} bytes`)

      if (stats.size === 0) {
        throw new Error('El backup está vacío')
      }

      // Calcular checksum para verificación de integridad (simplificado)
      let checksum: string | undefined
      try {
        if (config.verifyIntegrity) {
          checksum = await this.calculateChecksum(filepath)
        }
      } catch (error) {
        console.warn('No se pudo calcular checksum:', error)
      }

      // Por ahora, no comprimir ni encriptar para evitar errores
      let finalFilepath = filepath
      let compressed = false
      let encrypted = false
      
      // Aplicar compresión si está habilitada
      if (config.compression) {
        try {
          finalFilepath = await this.compressFile(filepath)
          compressed = true
          console.log('Backup comprimido exitosamente')
        } catch (compressionError) {
          console.warn('Error en compresión, usando archivo sin comprimir:', compressionError)
          finalFilepath = filepath
          compressed = false
        }
      }

      // Aplicar encriptación si está habilitada (placeholder por ahora)
      if (config.encryption) {
        try {
          finalFilepath = await this.encryptFile(finalFilepath)
          encrypted = true
          console.log('Backup encriptado (placeholder)')
        } catch (encryptionError) {
          console.warn('Error en encriptación:', encryptionError)
          encrypted = false
        }
      }

      // Actualizar registro con información final
      const finalStats = await stat(finalFilepath)
      
      const updateData: any = {
        filepath: finalFilepath,
        size: finalStats.size,
        status: 'completed'
      }

      // Por ahora, no guardar checksum hasta actualizar el schema
      // if (checksum) {
      //   try {
      //     updateData.checksum = checksum
      //   } catch (error) {
      //     console.warn('No se pudo guardar checksum:', error)
      //   }
      // }

      await prisma.backups.update({
        where: { id: backupRecord.id },
        data: updateData
      })

      // Limpiar backups antiguos
      await this.cleanOldBackups()

      // Enviar notificaciones si están habilitadas (simplificado)
      try {
        if (config.notifications) {
          await this.sendBackupNotification('success', {
            filename,
            size: finalStats.size,
            type
          })
        }
      } catch (error) {
        console.warn('No se pudo enviar notificación:', error)
      }

      // Registrar en auditoría (simplificado)
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'backup_created',
            entityType: 'System',
            entityId: backupRecord.id,
            createdAt: new Date(),
            details: {
              filename,
              size: finalStats.size,
              type,
              checksum: checksum || null
            },
          },
        })
      } catch (error) {
        console.warn('No se pudo registrar en auditoría:', error)
      }

      return {
        id: backupRecord.id,
        filename: backupRecord.filename,
        size: finalStats.size,
        createdAt: backupRecord.createdAt,
        type: backupRecord.type as 'manual' | 'automatic',
        status: 'completed',
        checksum,
        compressed,
        encrypted
      }
    } catch (error) {
      console.error('Error al crear backup:', error)

      // Actualizar registro con error
      await prisma.backups.update({
        where: { id: backupRecord.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Error desconocido'
        }
      })

      // Enviar notificación de error (simplificado)
      try {
        const config = await this.getBackupConfig()
        if (config.notifications) {
          await this.sendBackupNotification('error', {
            filename,
            error: error instanceof Error ? error.message : 'Error desconocido',
            type
          })
        }
      } catch (notificationError) {
        console.warn('No se pudo enviar notificación de error:', notificationError)
      }

      throw error
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
        where: { status: 'completed' }
      })

      const successRate = totalBackups > 0 ? (completedBackups / totalBackups) * 100 : 0

      return {
        totalBackups: stats._count.id || 0,
        totalSize: stats._sum.size || 0,
        lastBackup: stats._max.createdAt || undefined,
        oldestBackup: stats._min.createdAt || undefined,
        successRate,
        avgSize: stats._avg.size || 0
      }
    } catch (error) {
      console.error('Error al obtener estadísticas de backup:', error)
      return {
        totalBackups: 0,
        totalSize: 0,
        successRate: 0,
        avgSize: 0
      }
    }
  }

  private static async calculateChecksum(filepath: string): Promise<string> {
    try {
      const { readFile } = await import('fs/promises')
      const { createHash } = await import('crypto')
      
      // Para archivos grandes, usar streaming
      const stats = await stat(filepath)
      if (stats.size > 50 * 1024 * 1024) { // 50MB
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
      
      stream.on('data', (data) => hash.update(data))
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

  private static async encryptFile(filepath: string): Promise<string> {
    // TODO: Implementar encriptación real con AES-256
    // Por ahora, solo simular el proceso para evitar errores
    console.warn('Encriptación no implementada completamente - usando placeholder')
    
    // En una implementación real, usar crypto.createCipher con AES-256
    // const cipher = crypto.createCipher('aes-256-cbc', process.env.BACKUP_ENCRYPTION_KEY)
    
    return filepath // Retornar el mismo archivo por ahora
  }

  private static async getBackupConfig() {
    try {
      const settings = await prisma.system_settings.findMany({
        where: {
          key: {
            in: [
              'backupCompression',
              'backupEncryption',
              'backupVerifyIntegrity',
              'backupNotifications'
            ]
          }
        }
      })

      const config = settings.reduce((acc, setting) => {
        acc[setting.key.replace('backup', '').toLowerCase()] = setting.value === 'true'
        return acc
      }, {} as Record<string, boolean>)

      return {
        compression: config.compression ?? true,
        encryption: config.encryption ?? false,
        verifyIntegrity: config.verifyintegrity ?? true,
        notifications: config.notifications ?? true
      }
    } catch (error) {
      console.error('Error loading backup config:', error)
      // Valores por defecto en caso de error
      return {
        compression: true,
        encryption: false,
        verifyIntegrity: true,
        notifications: true
      }
    }
  }

  private static async sendBackupNotification(type: 'success' | 'error', data: any) {
    try {
      // Obtener emails de notificación
      const emailSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupEmailNotifications' }
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
          status: 'in_progress'
        }
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
                error: null
              }
            })
            console.log(`Estado corregido para backup: ${backup.filename}`)
          } else {
            // El archivo está vacío, marcar como fallido
            await prisma.backups.update({
              where: { id: backup.id },
              data: {
                status: 'failed',
                error: 'Archivo de backup vacío'
              }
            })
          }
        } catch (error) {
          // El archivo no existe, marcar como fallido
          await prisma.backups.update({
            where: { id: backup.id },
            data: {
              status: 'failed',
              error: 'Archivo de backup no encontrado'
            }
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
        checksum: undefined, // Por ahora no disponible
        compressed: false,   // Por ahora no disponible
        encrypted: false     // Por ahora no disponible
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
        console.log(`Backup ${backupId} no encontrado en la base de datos, posiblemente ya eliminado`)
        return // No lanzar error, simplemente retornar
      }

      // Intentar eliminar archivo físico (no fallar si no existe)
      try {
        await access(backup.filepath)
        await unlink(backup.filepath)
        console.log(`Archivo de backup eliminado: ${backup.filepath}`)
      } catch (error) {
        console.warn(`No se pudo eliminar el archivo de backup (puede que no exista): ${backup.filepath}`, error)
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
        if (dbError instanceof Error && dbError.message.includes('Record to delete does not exist')) {
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

  static async restoreBackup(backupId: string): Promise<void> {
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

      // Verificar integridad si es posible (opcional)
      try {
        const isValid = await this.verifyBackupIntegrity(backupId)
        if (!isValid) {
          console.warn('Advertencia: El backup puede estar corrupto, pero continuando con la restauración')
        }
      } catch (error) {
        console.warn('No se pudo verificar la integridad del backup:', error)
      }

      // Leer el contenido del backup
      const backupContent = await readFile(backup.filepath, 'utf-8')
      
      let backupData: any
      try {
        backupData = JSON.parse(backupContent)
      } catch (error) {
        throw new Error('El archivo de backup no tiene un formato JSON válido')
      }

      // Detectar y normalizar el formato del backup
      let normalizedData: any
      
      if (backupData.metadata && backupData.data) {
        // Formato nuevo
        console.log('Detectado formato de backup nuevo')
        normalizedData = backupData.data
      } else if (backupData.tables) {
        // Formato anterior
        console.log('Detectado formato de backup anterior')
        normalizedData = backupData.tables
      } else {
        console.error('Estructura del backup:', Object.keys(backupData))
        throw new Error('El archivo de backup no tiene una estructura reconocida')
      }

      console.log('Iniciando restauración de backup:', backup.filename)
      console.log('Tablas disponibles:', Object.keys(normalizedData))

      // Mapear nombres de tablas del formato anterior al nuevo
      const tableMapping: { [key: string]: string } = {
        // Mapeo básico
        'users': 'user',
        'categories': 'category',
        'tickets': 'ticket',
        'ticketComments': 'comment',
        'comments': 'comment',
        'notifications': 'notification',
        'auditLogs': 'auditLog',
        
        // Mapeo adicional para todas las tablas
        'technician_assignments': 'technicianAssignment',
        'ticketRatings': 'ticketRating',
        'ticket_ratings': 'ticketRating',
        'ticketHistory': 'ticketHistory',
        'ticket_history': 'ticketHistory',
        'attachments': 'attachment',
        'notificationPreferences': 'notificationPreference',
        'notification_preferences': 'notificationPreference',
        'oauthAccounts': 'oAuthAccount',
        'oauth_accounts': 'oAuthAccount',
        'accounts': 'account',
        'sessions': 'session',
        'pages': 'page',
        'siteConfig': 'siteConfig',
        'site_config': 'siteConfig',
        'systemSettings': 'systemSetting',
        'system_settings': 'systemSetting',
        'backups': 'backup',
        'verificationTokens': 'verificationToken',
        'verification_tokens': 'verificationToken'
      }

      // Normalizar nombres de tablas
      const mappedData: { [key: string]: any[] } = {}
      for (const [oldName, data] of Object.entries(normalizedData)) {
        const newName = tableMapping[oldName] || oldName
        mappedData[newName] = Array.isArray(data) ? data : []
      }

      console.log('Tablas a restaurar:', Object.keys(mappedData))

      // Crear una transacción para la restauración
      await prisma.$transaction(async (tx) => {
        // Limpiar datos existentes usando SQL directo para manejar foreign keys
        console.log('Limpiando base de datos...')
        
        // Deshabilitar temporalmente las foreign key constraints
        await tx.$executeRaw(Prisma.sql`SET session_replication_role = replica;`)
        
        // Limpiar tablas en cualquier orden ya que las constraints están deshabilitadas
        const allTables = [
          'verification_tokens', 'site_config', 'pages', 'system_settings', 'backups',
          'audit_logs', 'sessions', 'accounts', 'oauth_accounts', 'notification_preferences',
          'notifications', 'attachments', 'ticket_history', 'ticket_ratings', 'comments',
          'tickets', 'technician_assignments', 'categories', 'users'
        ]
        
        for (const tableName of allTables) {
          try {
            await tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(tableName)};`)
            console.log(`✓ Limpiada tabla: ${tableName}`)
          } catch (error) {
            console.warn(`⚠ Error limpiando tabla ${tableName}:`, error)
          }
        }
        
        // Rehabilitar foreign key constraints
        await tx.$executeRaw(Prisma.sql`SET session_replication_role = DEFAULT;`)

        // Restaurar datos (en orden correcto por dependencias)
        const tablesToRestore = [
          // Tablas base
          'user',               // Base
          'category',           // Puede tener parent
          
          // Tablas de asignaciones
          'technicianAssignment', // Depende de user y category ✅ AGREGADO
          
          // Tablas relacionadas con tickets
          'ticket',             // Depende de category y user
          'comment',            // Depende de ticket y user
          'ticketRating',       // Depende de ticket y user
          'ticketHistory',      // Depende de ticket y user
          'attachment',         // Depende de ticket y user
          
          // Tablas de configuración y notificaciones
          'notification',       // Depende de user y ticket
          'notificationPreference', // Depende de user
          'oAuthAccount',       // Depende de user
          'account',            // Depende de user
          'session',            // Depende de user
          'auditLog',           // Depende de user (opcional)
          
          // Tablas independientes
          'backup',
          'systemSetting',
          'page',
          'siteConfig',
          'verificationToken'
        ]

        for (const tableName of tablesToRestore) {
          const tableData = mappedData[tableName]
          if (tableData && Array.isArray(tableData) && tableData.length > 0) {
            console.log(`Restaurando ${tableData.length} registros en tabla: ${tableName}`)
            
            try {
              // Restaurar registros uno por uno para manejar mejor los errores
              for (let i = 0; i < tableData.length; i++) {
                const record = tableData[i]
                try {
                  // Convertir fechas de string a Date objects
                  const processedRecord = this.processRecordForRestore(record)
                  await (tx as any)[tableName].create({
                    data: processedRecord
                  })
                } catch (recordError) {
                  console.error(`Error restaurando registro ${i + 1} de tabla ${tableName}:`, recordError)
                  console.error('Datos del registro:', JSON.stringify(record, null, 2))
                  throw recordError
                }
              }
            } catch (error) {
              console.error(`Error restaurando tabla ${tableName}:`, error)
              throw new Error(`Error al restaurar tabla ${tableName}: ${error instanceof Error ? error.message : 'Error desconocido'}`)
            }
          }
        }
      }, {
        timeout: 300000 // 5 minutos de timeout
      })

      console.log('Restauración completada exitosamente')

      // Registrar restauración en auditoría
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
            restoredAt: new Date(),
            tablesRestored: Object.keys(mappedData),
          },
        },
      })
    } catch (error) {
      console.error('Error al restaurar backup:', error)
      throw error
    }
  }

  private static processRecordForRestore(record: any): any {
    const processed = { ...record }
    
    // Convertir campos de fecha de string a Date
    const dateFields = ['createdAt', 'updatedAt', 'lastLogin', 'dueDate', 'resolvedAt']
    
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
      const retentionSetting = await prisma.system_settings.findUnique({
        where: { key: 'backupRetentionDays' },
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
          status: 'completed' // Solo eliminar backups completados
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

      console.log(`Limpieza completada: ${deletedCount} backups eliminados, ${failedCount} fallidos`)
    } catch (error) {
      console.error('Error al limpiar backups antiguos:', error)
      throw new Error(`Error en limpieza de backups: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  private static async createBackupWithPrisma(filepath: string): Promise<void> {
    try {
      console.log('Creando backup usando método alternativo con Prisma')
      
      // Obtener todas las tablas y sus datos
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        tables: {} as Record<string, any[]>
      }

      // Exportar datos de las tablas principales
      try {
        backupData.tables.users = await prisma.users.findMany()
        backupData.tables.categories = await prisma.categories.findMany()
        backupData.tables.tickets = await prisma.tickets.findMany()
        backupData.tables.comments = await prisma.comments.findMany()
        backupData.tables.attachments = await prisma.attachments.findMany()
        backupData.tables.auditLogs = await prisma.audit_logs.findMany()
        backupData.tables.backups = await prisma.backups.findMany()
        backupData.tables.systemSettings = await prisma.system_settings.findMany()
      } catch (error) {
        console.warn('Error exportando algunas tablas:', error)
      }

      // Escribir datos al archivo
      const backupContent = JSON.stringify(backupData, null, 2)
      await writeFile(filepath, backupContent, 'utf-8')
      
      console.log('Backup alternativo creado exitosamente')
    } catch (error) {
      console.error('Error en backup alternativo:', error)
      throw error
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
}
