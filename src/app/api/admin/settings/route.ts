import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const settingsSchema = z.object({
  systemName: z.string().min(1).max(100),
  systemDescription: z.string().max(500),
  supportEmail: z.string().email(),
  maxTicketsPerUser: z.number().min(1).max(100),
  autoAssignmentEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean(),
  emailFrom: z.string().email().optional(),
  notificationsEnabled: z.boolean(),
  emailNotifications: z.boolean(),
  browserNotifications: z.boolean(),
  sessionTimeout: z.number().min(5).max(1440),
  maxLoginAttempts: z.number().min(3).max(10),
  passwordMinLength: z.number().min(6).max(20),
  requirePasswordChange: z.boolean(),
  maxFileSize: z.number().min(1).max(100),
  allowedFileTypes: z.array(z.string()),
  backupEnabled: z.boolean(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly']),
  backupRetention: z.number().min(7).max(365),
})

// Configuración por defecto
const defaultSettings = {
  systemName: 'Sistema de Tickets',
  systemDescription: 'Sistema de gestión de tickets de soporte técnico',
  supportEmail: 'soporte@empresa.com',
  maxTicketsPerUser: 10,
  autoAssignmentEnabled: true,
  emailEnabled: false,
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpSecure: true,
  emailFrom: '',
  notificationsEnabled: true,
  emailNotifications: true,
  browserNotifications: true,
  sessionTimeout: 1440, // 24 horas
  maxLoginAttempts: 5,
  passwordMinLength: 8,
  requirePasswordChange: false,
  maxFileSize: 10, // MB
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  backupEnabled: false,
  backupFrequency: 'daily' as const,
  backupRetention: 30,
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar configuración existente
    const existingSettings = await prisma.system_settings.findMany()

    // Convertir array de configuraciones a objeto
    const settings = { ...defaultSettings }

    existingSettings.forEach(setting => {
      const value = setting.value

      // Convertir tipos según sea necesario
      if (
        setting.key === 'maxTicketsPerUser' ||
        setting.key === 'smtpPort' ||
        setting.key === 'sessionTimeout' ||
        setting.key === 'maxLoginAttempts' ||
        setting.key === 'passwordMinLength' ||
        setting.key === 'maxFileSize' ||
        setting.key === 'backupRetention'
      ) {
        ;(settings as any)[setting.key] = parseInt(value)
      } else if (
        setting.key === 'autoAssignmentEnabled' ||
        setting.key === 'emailEnabled' ||
        setting.key === 'smtpSecure' ||
        setting.key === 'notificationsEnabled' ||
        setting.key === 'emailNotifications' ||
        setting.key === 'browserNotifications' ||
        setting.key === 'requirePasswordChange' ||
        setting.key === 'backupEnabled'
      ) {
        ;(settings as any)[setting.key] = value === 'true'
      } else if (setting.key === 'allowedFileTypes') {
        ;(settings as any)[setting.key] = JSON.parse(value)
      } else {
        ;(settings as any)[setting.key] = value
      }
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error al obtener configuración:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = settingsSchema.parse(body)

    // Actualizar configuraciones en la base de datos
    const updatePromises = Object.entries(validatedData).map(([key, value]) => {
      let stringValue: string

      if (typeof value === 'boolean') {
        stringValue = value.toString()
      } else if (typeof value === 'number') {
        stringValue = value.toString()
      } else if (Array.isArray(value)) {
        stringValue = JSON.stringify(value)
      } else {
        stringValue = value as string
      }

      return prisma.system_settings.upsert({
        where: { key },
        update: { value: stringValue, updatedAt: new Date() },
        create: { 
          id: randomUUID(),
          key, 
          value: stringValue,
          createdAt: new Date(),
          updatedAt: new Date()
        },
      })
    })

    await Promise.all(updatePromises)

    // Crear entrada en el historial de auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'settings_updated',
        entityType: 'SystemSettings',
        entityId: 'system',
        userId: session.user.id,
        details: {
          updatedSettings: Object.keys(validatedData),
        },
        createdAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    console.error('Error al actualizar configuración:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
