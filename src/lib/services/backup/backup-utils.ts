import { exec } from 'child_process'
import { promisify } from 'util'
import { stat, unlink, createReadStream } from 'fs'
import { createHash, randomBytes } from 'crypto'
import { join } from 'path'
import prisma from '@/lib/prisma'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
import { BackupConfig, DatabaseConfig } from './backup-types'

const execAsync = promisify(exec)

export const BACKUP_DIR: string = (() => {
  if (process.env.BACKUP_DIR) {
    return process.env.BACKUP_DIR
  }
  return join(process.cwd(), 'backups')
})()

export const MAX_BACKUP_SIZE = 1024 * 1024 * 1024
export const COMPRESSION_LEVEL = 6

export async function hasPgTools(): Promise<boolean> {
  try {
    await execAsync('pg_dump --version')
    await execAsync('pg_restore --version')
    return true
  } catch {
    return false
  }
}

export function parseDatabaseUrl(): DatabaseConfig {
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

export async function getBackupConfig(): Promise<BackupConfig> {
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
            'backupWeeklyFullDay',
            'backupAllowRestore',
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
      weeklyFullDay:
        raw.backupWeeklyFullDay !== undefined ? parseInt(raw.backupWeeklyFullDay, 10) : 0,
      allowRestore:
        raw.backupAllowRestore !== undefined ? raw.backupAllowRestore === 'true' : false,
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
      weeklyFullDay: 0,
      allowRestore: false,
    }
  }
}

export async function sendBackupNotification(
  type: 'success' | 'error',
  data: { filename?: string; size?: number; type?: string; error?: string }
) {
  try {
    const emailSetting = await prisma.system_settings.findUnique({
      where: { key: 'backupEmailNotifications' },
    })

    if (!emailSetting?.value) {
      console.log(`[BACKUP] Notificación ${type} omitida (sin emails configurados)`)
      return
    }

    let emails: string[] = []
    try {
      const parsed = JSON.parse(emailSetting.value)
      emails = Array.isArray(parsed) ? parsed.filter((e: unknown) => typeof e === 'string') : []
    } catch {
      emails = []
    }
    if (!emails.length) {
      console.log(`[BACKUP] Notificación ${type} omitida (lista vacía)`)
      return
    }

    const { queueNotificationEmail } = await import(
      '@/lib/notifications/queue-notification-email'
    )
    const { getSystemBranding } = await import('@/lib/branding')
    const { systemName } = await getSystemBranding()

    const users = await prisma.users.findMany({
      where: {
        isActive: true,
        OR: emails.map(email => ({
          email: { equals: email, mode: 'insensitive' as const },
        })),
      },
      select: { id: true, email: true },
    })
    const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u.id]))

    const isError = type === 'error'
    const subject = isError
      ? `[${systemName}] Error en backup`
      : `[${systemName}] Backup completado`
    const sizeLabel =
      typeof data.size === 'number' ? `${(data.size / (1024 * 1024)).toFixed(2)} MB` : '—'
    const html = isError
      ? `<p>Falló un backup del sistema.</p>
         <ul>
           <li><strong>Archivo:</strong> ${data.filename || 'n/a'}</li>
           <li><strong>Tipo:</strong> ${data.type || 'n/a'}</li>
           <li><strong>Error:</strong> ${data.error || 'desconocido'}</li>
         </ul>
         <p>Revisa Admin → Backups.</p>`
      : `<p>Backup completado correctamente.</p>
         <ul>
           <li><strong>Archivo:</strong> ${data.filename || 'n/a'}</li>
           <li><strong>Tipo:</strong> ${data.type || 'n/a'}</li>
           <li><strong>Tamaño:</strong> ${sizeLabel}</li>
         </ul>`

    const recipients = emails
      .map(email => {
        const id = byEmail.get(email.toLowerCase())
        return id ? { userId: id, email } : null
      })
      .filter((r): r is { userId: string; email: string } => !!r)

    // Usuarios conocidos: respetan prefs (éxito = optional; fallo = important)
    if (recipients.length) {
      await queueNotificationEmail({
        to: recipients.map(r => r.email),
        recipients,
        subject,
        html,
        module: 'backups',
        event: isError ? 'backupFailure' : 'backupSuccess',
        priority: isError ? 'important' : 'optional',
      })
    }

    // Emails de la lista sin cuenta: solo en fallo (operativo)
    const orphanEmails = emails.filter(e => !byEmail.has(e.toLowerCase()))
    if (isError && orphanEmails.length) {
      await queueNotificationEmail({
        to: orphanEmails,
        subject,
        html,
        module: 'backups',
        event: 'backupFailure',
        priority: 'important',
      })
    }

    // Telegram: solo en fallos (critical) a usuarios con chatId vinculado
    if (isError && recipients.length) {
      queueTelegramNotification({
        recipients: recipients.map(r => ({ userId: r.userId })),
        title: 'Error en backup',
        body: `Falló un backup del sistema.\nArchivo: ${data.filename || 'n/a'}\nError: ${data.error || 'desconocido'}`,
        module: 'backups',
        event: 'backupFailure',
        priority: 'critical',
        link: '/admin/backups',
      }).catch(() => {})
    }
  } catch (error) {
    console.error('Error al enviar notificación de backup:', error)
  }
}

export async function calculateChecksum(filepath: string): Promise<string> {
  try {
    const stats = await promisify(stat)(filepath)
    if (stats.size > 50 * 1024 * 1024) {
      return calculateChecksumStream(filepath)
    }

    const { readFile } = await import('fs/promises')
    const data = await readFile(filepath)
    return createHash('sha256').update(data).digest('hex')
  } catch (error) {
    console.error('Error calculando checksum:', error)
    throw new Error('No se pudo calcular el checksum del archivo')
  }
}

export async function calculateChecksumStream(filepath: string): Promise<string> {
  const { createReadStream: fsCreateReadStream } = await import('fs')

  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fsCreateReadStream(filepath)

    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export async function encryptFile(filepath: string): Promise<string> {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY no configurada o demasiado corta (mínimo 32 caracteres). Genera una con: openssl rand -hex 32'
    )
  }

  const { createCipheriv, createHash: nodeCreateHash } = await import('crypto')
  const { createReadStream: fsCreateReadStream, createWriteStream } = await import('fs')
  const { pipeline } = await import('stream/promises')

  const keyBuffer = nodeCreateHash('sha256').update(key).digest()
  const iv = randomBytes(16)

  const encryptedPath = filepath + '.enc'
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv)

  await pipeline(fsCreateReadStream(filepath), cipher, createWriteStream(encryptedPath))

  const authTag = cipher.getAuthTag()

  const { readFile: fsReadFile, writeFile: fsWriteFile } = await import('fs/promises')
  const encryptedData = await fsReadFile(encryptedPath)

  const ivLenBuf = Buffer.alloc(4)
  ivLenBuf.writeUInt32BE(iv.length, 0)

  const finalBuffer = Buffer.concat([ivLenBuf, iv, authTag, encryptedData])
  await fsWriteFile(encryptedPath, finalBuffer)

  await promisify(unlink)(filepath)

  console.log(`Backup cifrado con AES-256-GCM: ${encryptedPath} (${finalBuffer.length} bytes)`)
  return encryptedPath
}

export async function decryptFile(encryptedPath: string): Promise<string> {
  const key = process.env.BACKUP_ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY no configurada. No se puede descifrar el backup. Asegúrate de que la variable de entorno esté definida con la misma clave usada al cifrar.'
    )
  }

  const { createDecipheriv, createHash: nodeCreateHash } = await import('crypto')
  const { createWriteStream } = await import('fs')
  const { pipeline } = await import('stream/promises')
  const { readFile: fsReadFile } = await import('fs/promises')

  const keyBuffer = nodeCreateHash('sha256').update(key).digest()

  const fileData = await fsReadFile(encryptedPath)

  const ivLen = fileData.readUInt32BE(0)
  const iv = fileData.subarray(4, 4 + ivLen)
  const authTag = fileData.subarray(4 + ivLen, 4 + ivLen + 16)
  const encryptedData = fileData.subarray(4 + ivLen + 16)

  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv)
  decipher.setAuthTag(authTag)

  const decryptedPath = encryptedPath.replace(/\.enc$/, '')
  const decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()])

  const { writeFile: fsWriteFile } = await import('fs/promises')
  await fsWriteFile(decryptedPath, decryptedData)

  console.log(`Backup descifrado: ${decryptedPath}`)
  return decryptedPath
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
