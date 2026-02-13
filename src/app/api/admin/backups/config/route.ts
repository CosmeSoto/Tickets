import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
            'backupScheduleTime'
          ]
        }
      }
    })

    // Convertir a objeto de configuración
    const config = settings.reduce((acc, setting) => {
      let value: any = setting.value

      // Convertir valores según el tipo
      if (setting.key === 'backupEnabled' || 
          setting.key === 'backupCompression' || 
          setting.key === 'backupEncryption' || 
          setting.key === 'backupCloudStorage' || 
          setting.key === 'backupNotifications' || 
          setting.key === 'backupVerifyIntegrity') {
        value = setting.value === 'true'
      } else if (setting.key === 'backupRetention' || setting.key === 'backupMaxCount') {
        value = parseInt(setting.value)
      } else if (setting.key === 'backupEmailNotifications') {
        value = setting.value ? JSON.parse(setting.value) : []
      }

      // Mapear nombres de configuración
      const keyMap: Record<string, string> = {
        'backupEnabled': 'enabled',
        'backupFrequency': 'frequency',
        'backupRetention': 'retentionDays',
        'backupMaxCount': 'maxBackups',
        'backupCompression': 'compression',
        'backupEncryption': 'encryption',
        'backupCloudStorage': 'cloudStorage',
        'backupCloudProvider': 'cloudProvider',
        'backupNotifications': 'notifications',
        'backupEmailNotifications': 'emailNotifications',
        'backupVerifyIntegrity': 'verifyIntegrity',
        'backupScheduleTime': 'scheduleTime'
      }

      const mappedKey = keyMap[setting.key] || setting.key
      acc[mappedKey] = value
      return acc
    }, {} as Record<string, any>)

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
      scheduleTime: '02:00'
    }

    return NextResponse.json({ ...defaultConfig, ...config })
  } catch (error) {
    console.error('Error al obtener configuración de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
      { key: 'backupScheduleTime', value: config.scheduleTime || '02:00' }
    ]

    // Actualizar o crear configuraciones
    for (const setting of settingsToUpdate) {
      await prisma.system_settings.upsert({
        where: { key: setting.key },
        update: { 
          value: setting.value,
          updatedAt: new Date()
        },
        create: {
          id: randomUUID(),
          key: setting.key,
          value: setting.value,
          description: `Configuración de backup: ${setting.key}`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    // Registrar cambio en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_config_updated',
        entityType: 'System',
        entityId: 'backup_config',
        userId: session.user.id,
        details: {
          updatedSettings: settingsToUpdate.map(s => s.key),
          timestamp: new Date()
        },
        createdAt: new Date()
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al guardar configuración de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}