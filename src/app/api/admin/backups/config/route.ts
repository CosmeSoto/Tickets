import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    // Obtener configuraciones de backup
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

    // Convertir a objeto de configuración
    const config = settings.reduce(
      (acc, setting) => {
        let value: any = setting.value

        // Convertir valores según el tipo
        if (
          setting.key === 'backupEnabled' ||
          setting.key === 'backupCompression' ||
          setting.key === 'backupEncryption' ||
          setting.key === 'backupCloudStorage' ||
          setting.key === 'backupNotifications' ||
          setting.key === 'backupVerifyIntegrity' ||
          setting.key === 'backupAllowRestore'
        ) {
          value = setting.value === 'true'
        } else if (
          setting.key === 'backupRetention' ||
          setting.key === 'backupMaxCount' ||
          setting.key === 'backupWeeklyFullDay'
        ) {
          value = parseInt(setting.value)
        } else if (setting.key === 'backupEmailNotifications') {
          value = setting.value ? JSON.parse(setting.value) : []
        }

        // Mapear nombres de configuración
        const keyMap: Record<string, string> = {
          backupEnabled: 'enabled',
          backupFrequency: 'frequency',
          backupRetention: 'retentionDays',
          backupMaxCount: 'maxBackups',
          backupCompression: 'compression',
          backupEncryption: 'encryption',
          backupCloudStorage: 'cloudStorage',
          backupCloudProvider: 'cloudProvider',
          backupNotifications: 'notifications',
          backupEmailNotifications: 'emailNotifications',
          backupVerifyIntegrity: 'verifyIntegrity',
          backupScheduleTime: 'scheduleTime',
          backupWeeklyFullDay: 'weeklyFullDay',
          backupAllowRestore: 'allowRestore',
        }

        const mappedKey = keyMap[setting.key] || setting.key
        acc[mappedKey] = value
        return acc
      },
      {} as Record<string, any>
    )

    // Valores por defecto
    const defaultConfig = {
      enabled: true,
      frequency: 'daily',
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

    // Informar al frontend si la clave de encriptación está configurada en el servidor.
    // Solo devolvemos un booleano — nunca exponemos la clave en sí.
    const encryptionKeyConfigured =
      typeof process.env.BACKUP_ENCRYPTION_KEY === 'string' &&
      process.env.BACKUP_ENCRYPTION_KEY.length >= 32

    return NextResponse.json({
      ...defaultConfig,
      ...config,
      encryptionKeyConfigured,
      cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    })
  } catch (error) {
    console.error('Error al obtener configuración de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// Etiquetas legibles para los campos de configuración de backup
const BACKUP_CONFIG_LABELS: Record<string, string> = {
  backupEnabled: 'Sistema de Backups',
  backupFrequency: 'Frecuencia',
  backupRetention: 'Retención (días)',
  backupMaxCount: 'Máximo de Backups',
  backupCompression: 'Compresión',
  backupEncryption: 'Encriptación',
  backupCloudStorage: 'Almacenamiento en Nube',
  backupCloudProvider: 'Proveedor de Nube',
  backupNotifications: 'Notificaciones',
  backupEmailNotifications: 'Emails de Notificación',
  backupVerifyIntegrity: 'Verificar Integridad',
  backupScheduleTime: 'Hora Programada',
  backupWeeklyFullDay: 'Día de Backup Full Semanal',
  backupAllowRestore: 'Permitir Restauración',
}

// Formatea un valor de configuración de backup para mostrarlo de forma legible
function formatBackupConfigValue(key: string, raw: string): string {
  switch (key) {
    case 'backupEnabled':
    case 'backupCompression':
    case 'backupEncryption':
    case 'backupCloudStorage':
    case 'backupNotifications':
    case 'backupVerifyIntegrity':
    case 'backupAllowRestore':
      return raw === 'true' ? 'Habilitado' : 'Deshabilitado'
    case 'backupFrequency': {
      const freq: Record<string, string> = {
        hourly: 'Cada hora',
        daily: 'Diario',
        weekly: 'Semanal',
        monthly: 'Mensual',
      }
      return freq[raw] ?? raw
    }
    case 'backupRetention':
      return `${raw} días`
    case 'backupMaxCount':
      return `${raw} backups`
    case 'backupWeeklyFullDay': {
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
      return days[parseInt(raw, 10)] ?? raw
    }
    case 'backupEmailNotifications':
      try {
        const arr = JSON.parse(raw)
        return Array.isArray(arr) && arr.length > 0 ? arr.join(', ') : 'Ninguno'
      } catch {
        return raw || 'Ninguno'
      }
    case 'backupCloudProvider':
      return raw || 'No configurado'
    default:
      return raw || '—'
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const config = await request.json()

    // Mapear configuración a settings de base de datos
    const settingsToUpdate = [
      { key: 'backupEnabled', value: config.enabled?.toString() || 'true' },
      { key: 'backupFrequency', value: config.frequency || 'daily' },
      { key: 'backupRetention', value: config.retentionDays?.toString() || '30' },
      { key: 'backupMaxCount', value: config.maxBackups?.toString() || '100' },
      { key: 'backupCompression', value: config.compression?.toString() || 'true' },
      { key: 'backupEncryption', value: config.encryption?.toString() || 'false' },
      { key: 'backupCloudStorage', value: config.cloudStorage?.toString() || 'false' },
      { key: 'backupCloudProvider', value: config.cloudProvider || '' },
      { key: 'backupNotifications', value: config.notifications?.toString() || 'true' },
      { key: 'backupEmailNotifications', value: JSON.stringify(config.emailNotifications || []) },
      { key: 'backupVerifyIntegrity', value: config.verifyIntegrity?.toString() || 'true' },
      { key: 'backupScheduleTime', value: config.scheduleTime || '02:00' },
      {
        key: 'backupWeeklyFullDay',
        value: String(config.weeklyFullDay ?? 0),
      },
      {
        key: 'backupAllowRestore',
        value: config.allowRestore?.toString() || 'false',
      },
    ]

    // Leer valores actuales ANTES de actualizar para registrar el diff
    const currentSettings = await prisma.system_settings.findMany({
      where: { key: { in: settingsToUpdate.map(s => s.key) } },
    })
    const currentMap = Object.fromEntries(currentSettings.map(s => [s.key, s.value]))

    // Construir diff: solo los campos que realmente cambiaron
    const changes: Record<string, { label: string; antes: string; despues: string }> = {}
    for (const setting of settingsToUpdate) {
      const oldRaw = currentMap[setting.key] ?? null
      if (oldRaw !== setting.value) {
        changes[setting.key] = {
          label: BACKUP_CONFIG_LABELS[setting.key] ?? setting.key,
          antes: oldRaw !== null ? formatBackupConfigValue(setting.key, oldRaw) : 'No configurado',
          despues: formatBackupConfigValue(setting.key, setting.value),
        }
      }
    }

    const summary =
      Object.keys(changes).length > 0
        ? Object.values(changes)
            .map(c => `${c.label}: ${c.antes} → ${c.despues}`)
            .join(' · ')
        : 'Sin cambios detectados (configuración re-guardada)'

    // Actualizar o crear configuraciones
    for (const setting of settingsToUpdate) {
      await prisma.system_settings.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          updatedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          key: setting.key,
          value: setting.value,
          description: `Configuración de backup: ${setting.key}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
    }

    // Registrar cambio en auditoría con diff completo (antes / después)
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_config_updated',
        entityType: 'System',
        entityId: 'backup_config',
        userId: session!.user.id,
        details: {
          changes,
          totalChanges: Object.keys(changes).length,
          summary,
        },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al guardar configuración de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
