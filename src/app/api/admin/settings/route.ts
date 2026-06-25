import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const settingsSchema = z
  .object({
    systemName: z.string().max(100).optional(),
    systemDescription: z.string().max(500).optional(),
    supportEmail: z.string().email().optional().or(z.literal('')),
    maxTicketsPerUser: z.coerce.number().min(1).max(100).optional(),
    autoAssignmentEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.coerce.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    smtpSecure: z.boolean().optional(),
    emailFrom: z.string().email().optional().or(z.literal('')),
    notificationsEnabled: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    browserNotifications: z.boolean().optional(),
    sessionTimeout: z.coerce.number().min(5).max(1440).optional(),
    maxLoginAttempts: z.coerce.number().min(3).max(10).optional(),
    passwordMinLength: z.coerce.number().min(6).max(20).optional(),
    requirePasswordChange: z.boolean().optional(),
    maxFileSize: z.coerce.number().min(1).max(100).optional(),
    autoCloseDays: z.coerce.number().min(1).max(30).optional(),
    allowedFileTypes: z.array(z.string()).optional(),
    backupEnabled: z.boolean().optional(),
    backupFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
    backupRetention: z.coerce.number().min(7).max(365).optional(),
  })

const SENSITIVE_SETTING_KEYS = new Set(['smtpPassword'])

// Configuración por defecto
const defaultSettings = {
  systemName: 'Sistema de gestión',
  systemDescription: 'Gestión Integral de Operaciones',
  supportEmail: 'internet.freecom@gmail.com',
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
  autoCloseDays: 3, // Días para auto-cierre de tickets resueltos sin calificación
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

    // Caché 5 minutos — configuración del sistema cambia raramente
    const { withCache } = await import('@/lib/api-cache')
    const settings = await withCache('admin:settings', 300, async () => {
      const existingSettings = await prisma.system_settings.findMany()
      const result = { ...defaultSettings } as any

      existingSettings.forEach(setting => {
        const value = setting.value
        if (
          [
            'maxTicketsPerUser',
            'smtpPort',
            'sessionTimeout',
            'maxLoginAttempts',
            'passwordMinLength',
            'maxFileSize',
            'backupRetention',
            'autoCloseDays',
          ].includes(setting.key)
        ) {
          result[setting.key] = parseInt(value)
        } else if (
          [
            'autoAssignmentEnabled',
            'emailEnabled',
            'smtpSecure',
            'notificationsEnabled',
            'emailNotifications',
            'browserNotifications',
            'requirePasswordChange',
            'backupEnabled',
          ].includes(setting.key)
        ) {
          result[setting.key] = value === 'true'
        } else if (setting.key === 'allowedFileTypes') {
          result[setting.key] = JSON.parse(value)
        } else {
          result[setting.key] = value
        }
      })
      return result
    })

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const safeSettings = {
      ...settings,
      smtpPasswordConfigured: Boolean(settings.smtpPassword),
    }
    delete safeSettings.smtpPassword
    if (!isSuperAdmin) {
      for (const key of SENSITIVE_SETTING_KEYS) {
        delete safeSettings[key]
      }
    }

    return NextResponse.json(safeSettings, {
      headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=180' },
    })
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

    const requester = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!requester?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede modificar la configuración del sistema' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validation = settingsSchema.safeParse(body)

    if (!validation.success) {
      console.error('Error de validación:', validation.error.errors)
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const validatedData = validation.data

    // Actualizar configuraciones en la base de datos
    const updatePromises = Object.entries(validatedData)
      .map(([key, value]) => {
        let stringValue: string

        if (typeof value === 'boolean') {
          stringValue = value.toString()
        } else if (typeof value === 'number') {
          stringValue = value.toString()
        } else if (Array.isArray(value)) {
          stringValue = JSON.stringify(value)
        } else if (value === null || value === undefined) {
          return null // Skip null/undefined values
        } else {
          stringValue = value as string
        }

        const promises: any[] = []

        // Actualizar la configuración general
        promises.push(
          prisma.system_settings.upsert({
            where: { key },
            update: { value: stringValue, updatedAt: new Date() },
            create: {
              id: randomUUID(),
              key,
              value: stringValue,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        )

        // Si es supportEmail o systemName, también actualizar la configuración de ayuda
        if (key === 'supportEmail') {
          promises.push(
            prisma.system_settings.upsert({
              where: { key: 'help.support_email' },
              update: { value: stringValue, updatedAt: new Date() },
              create: {
                id: randomUUID(),
                key: 'help.support_email',
                value: stringValue,
                description: 'Email de contacto para soporte técnico',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })
          )
        }

        if (key === 'systemName') {
          promises.push(
            prisma.system_settings.upsert({
              where: { key: 'help.company_name' },
              update: { value: stringValue, updatedAt: new Date() },
              create: {
                id: randomUUID(),
                key: 'help.company_name',
                value: stringValue,
                description: 'Nombre de la empresa',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            })
          )
        }

        return promises
      })
      .flat()
      .filter(Boolean) // Remove null entries

    await Promise.all(updatePromises)

    // Sincronizar también con la landing page
    const landingPageUpdates: any = {}
    if (validatedData.supportEmail !== undefined) {
      landingPageUpdates.contactEmail = validatedData.supportEmail
    }
    if (validatedData.systemName !== undefined) {
      landingPageUpdates.companyName = validatedData.systemName
    }

    if (Object.keys(landingPageUpdates).length > 0) {
      await prisma.landing_page_content.upsert({
        where: { id: 'default' },
        update: landingPageUpdates,
        create: {
          id: 'default',
          heroTitle: 'Gestión Integral de Operaciones',
          heroSubtitle: 'Tickets, inventario, rondas en una sola plataforma',
          heroCtaPrimary: 'Crear Ticket de Soporte',
          heroCtaPrimaryUrl: '/login',
          heroCtaSecondary: 'Ver Servicios',
          heroCtaSecondaryUrl: '#servicios',
          servicesTitle: 'Nuestros Servicios',
          servicesSubtitle: 'Ofrecemos soporte técnico integral',
          servicesEnabled: true,
          companyName: landingPageUpdates.companyName || 'Sistema de Tickets',
          companyTagline: 'Gestión Integral de Operaciones',
          footerText: `© ${new Date().getFullYear()} ${landingPageUpdates.companyName || 'Sistema de Tickets'}`,
          metaTitle: 'Sistema de Tickets - Soporte Técnico',
          metaDescription: 'Sistema profesional de gestión de tickets',
          ...landingPageUpdates,
        },
      })
    }

    // NUEVO: Limpiar caché de configuración de seguridad
    try {
      const { SecurityConfigService } = await import('@/lib/services/security-config-service')
      SecurityConfigService.clearCache()
    } catch (error) {
      console.warn('No se pudo limpiar caché de seguridad:', error)
    }

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

    // Invalidar caché de settings afectados
    try {
      const { invalidateSettings, invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([
        invalidateCache('admin:settings'),
        invalidateCache('config:session-timeout'),
        invalidateCache('landing:page'),
        invalidateSettings(Object.keys(validatedData)),
      ])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error al actualizar configuración:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Error interno del servidor',
          message: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
