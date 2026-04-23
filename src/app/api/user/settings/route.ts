import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { withCache, invalidateCache } from '@/lib/api-cache'

// Schema de validación extendido para todas las preferencias de notificaciones
const userSettingsSchema = z.object({
  // Notificaciones básicas
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),

  // Notificaciones intermedias
  ticketUpdates: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  weeklyReport: z.boolean().optional(),

  // Notificaciones avanzadas
  soundEnabled: z.boolean().optional(),
  ticketCreated: z.boolean().optional(),
  ticketAssigned: z.boolean().optional(),
  statusChanged: z.boolean().optional(),
  newComments: z.boolean().optional(),
  ticketUpdated: z.boolean().optional(),

  // Horarios silenciosos
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),

  // Configuraciones de técnico
  autoAssignEnabled: z.boolean().optional(),
  maxConcurrentTickets: z.number().min(1).max(50).optional(),

  // Preferencias generales
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['es', 'en', 'fr', 'de']).optional(),
  timezone: z.string().optional(),

  // Privacidad
  profileVisible: z.boolean().optional(),
  activityVisible: z.boolean().optional(),
})

/**
 * GET /api/user/settings
 * Obtiene la configuración completa del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id

    // Caché 3 minutos por usuario — settings cambian raramente
    const cached = await withCache(`user:settings:${userId}`, 180, async () => {
      // Verificar que el usuario existe en la BD
      const userExists = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true },
      })

      if (!userExists) {
        // Usuario no existe en BD — sesión huérfana, devolver defaults sin error 404
        return {
          success: true,
          settings: {
            emailNotifications: true,
            pushNotifications: true,
            ticketUpdates: true,
            systemAlerts: true,
            weeklyReport: false,
            soundEnabled: true,
            ticketCreated: true,
            ticketAssigned: true,
            statusChanged: true,
            newComments: true,
            ticketUpdated: true,
            quietHours: { enabled: false, startTime: '22:00', endTime: '08:00' },
            autoAssignEnabled: true,
            maxConcurrentTickets: 10,
            theme: 'light',
            language: 'es',
            timezone: 'America/Guayaquil',
            profileVisible: true,
            activityVisible: true,
          },
        }
      }

      // Buscar configuración existente — con manejo de registros corruptos
      let settings = await prisma.user_settings
        .findUnique({
          where: { userId },
        })
        .catch(() => null) // Si falla la deserialización (campos null), tratar como no existente

      // Si no existe o falló la lectura, crear/reparar con upsert completo
      if (!settings) {
        const now = new Date()
        settings = await prisma.user_settings.upsert({
          where: { userId },
          update: {
            theme: 'light',
            language: 'es',
            timezone: 'America/Guayaquil',
            systemAlerts: true,
            weeklyReport: false,
            soundEnabled: true,
            ticketUpdates: true,
            ticketCreated: true,
            ticketAssigned: true,
            statusChanged: true,
            newComments: true,
            ticketUpdated: true,
            autoAssignEnabled: true,
            maxConcurrentTickets: 10,
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            updatedAt: now,
          },
          create: {
            id: randomUUID(),
            userId,
            emailNotifications: true,
            pushNotifications: true,
            ticketUpdates: true,
            systemAlerts: true,
            weeklyReport: false,
            soundEnabled: true,
            ticketCreated: true,
            ticketAssigned: true,
            statusChanged: true,
            newComments: true,
            ticketUpdated: true,
            quietHoursEnabled: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00',
            autoAssignEnabled: true,
            maxConcurrentTickets: 10,
            theme: 'light',
            language: 'es',
            timezone: 'America/Guayaquil',
            updatedAt: now,
          },
        })
      }

      // Reparar registros con campos null (creados con schema incompleto o updatedAt null)
      const needsRepair =
        !settings.theme || !settings.language || !settings.timezone || !settings.updatedAt
      if (needsRepair) {
        settings = await prisma.user_settings.update({
          where: { userId },
          data: {
            theme: settings.theme ?? 'light',
            language: settings.language ?? 'es',
            timezone: settings.timezone ?? 'America/Guayaquil',
            systemAlerts: settings.systemAlerts ?? true,
            weeklyReport: settings.weeklyReport ?? false,
            soundEnabled: settings.soundEnabled ?? true,
            ticketUpdates: settings.ticketUpdates ?? true,
            ticketCreated: settings.ticketCreated ?? true,
            ticketAssigned: settings.ticketAssigned ?? true,
            statusChanged: settings.statusChanged ?? true,
            newComments: settings.newComments ?? true,
            ticketUpdated: settings.ticketUpdated ?? true,
            autoAssignEnabled: settings.autoAssignEnabled ?? true,
            maxConcurrentTickets: settings.maxConcurrentTickets ?? 10,
            quietHoursEnabled: settings.quietHoursEnabled ?? false,
            quietHoursStart: settings.quietHoursStart ?? '22:00',
            quietHoursEnd: settings.quietHoursEnd ?? '08:00',
            updatedAt: new Date(),
          },
        })
      }

      return {
        success: true,
        settings: {
          emailNotifications: settings.emailNotifications,
          pushNotifications: settings.pushNotifications,
          ticketUpdates: settings.ticketUpdates,
          systemAlerts: settings.systemAlerts,
          weeklyReport: settings.weeklyReport,
          soundEnabled: settings.soundEnabled,
          ticketCreated: settings.ticketCreated,
          ticketAssigned: settings.ticketAssigned,
          statusChanged: settings.statusChanged,
          newComments: settings.newComments,
          ticketUpdated: settings.ticketUpdated,
          quietHours: {
            enabled: settings.quietHoursEnabled,
            startTime: settings.quietHoursStart,
            endTime: settings.quietHoursEnd,
          },
          autoAssignEnabled: settings.autoAssignEnabled,
          maxConcurrentTickets: settings.maxConcurrentTickets,
          theme: settings.theme,
          language: settings.language,
          timezone: settings.timezone,
          profileVisible: true,
          activityVisible: true,
        },
      }
    }) // fin withCache

    return NextResponse.json(cached)
  } catch (error) {
    console.error('[API-USER-SETTINGS] GET Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener configuración' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/settings
 * Actualiza la configuración del usuario actual
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()

    // Validar datos de entrada
    const validation = userSettingsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Preparar datos para actualización (solo campos definidos)
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Notificaciones básicas
    if (data.emailNotifications !== undefined)
      updateData.emailNotifications = data.emailNotifications
    if (data.pushNotifications !== undefined) updateData.pushNotifications = data.pushNotifications

    // Notificaciones intermedias
    if (data.ticketUpdates !== undefined) updateData.ticketUpdates = data.ticketUpdates
    if (data.systemAlerts !== undefined) updateData.systemAlerts = data.systemAlerts
    if (data.weeklyReport !== undefined) updateData.weeklyReport = data.weeklyReport

    // Notificaciones avanzadas
    if (data.soundEnabled !== undefined) updateData.soundEnabled = data.soundEnabled
    if (data.ticketCreated !== undefined) updateData.ticketCreated = data.ticketCreated
    if (data.ticketAssigned !== undefined) updateData.ticketAssigned = data.ticketAssigned
    if (data.statusChanged !== undefined) updateData.statusChanged = data.statusChanged
    if (data.newComments !== undefined) updateData.newComments = data.newComments
    if (data.ticketUpdated !== undefined) updateData.ticketUpdated = data.ticketUpdated

    // Horarios silenciosos
    if (data.quietHoursEnabled !== undefined) updateData.quietHoursEnabled = data.quietHoursEnabled
    if (data.quietHoursStart !== undefined) updateData.quietHoursStart = data.quietHoursStart
    if (data.quietHoursEnd !== undefined) updateData.quietHoursEnd = data.quietHoursEnd

    // Configuraciones de técnico
    if (data.autoAssignEnabled !== undefined) updateData.autoAssignEnabled = data.autoAssignEnabled
    if (data.maxConcurrentTickets !== undefined)
      updateData.maxConcurrentTickets = data.maxConcurrentTickets

    // Preferencias generales
    if (data.theme !== undefined) updateData.theme = data.theme
    if (data.language !== undefined) updateData.language = data.language
    if (data.timezone !== undefined) updateData.timezone = data.timezone

    // Actualizar o crear configuración de notificaciones
    const settings = await prisma.user_settings.upsert({
      where: { userId },
      update: updateData,
      create: {
        id: randomUUID(),
        userId,
        emailNotifications: data.emailNotifications ?? true,
        pushNotifications: data.pushNotifications ?? true,
        ticketUpdates: data.ticketUpdates ?? true,
        systemAlerts: data.systemAlerts ?? true,
        weeklyReport: data.weeklyReport ?? false,
        soundEnabled: data.soundEnabled ?? true,
        ticketCreated: data.ticketCreated ?? true,
        ticketAssigned: data.ticketAssigned ?? true,
        statusChanged: data.statusChanged ?? true,
        newComments: data.newComments ?? true,
        ticketUpdated: data.ticketUpdated ?? true,
        quietHoursEnabled: data.quietHoursEnabled ?? false,
        quietHoursStart: data.quietHoursStart ?? '22:00',
        quietHoursEnd: data.quietHoursEnd ?? '08:00',
        autoAssignEnabled: data.autoAssignEnabled ?? true,
        maxConcurrentTickets: data.maxConcurrentTickets ?? 10,
        theme: data.theme ?? 'light',
        language: 'es',
        timezone: 'America/Guayaquil',
        updatedAt: new Date(),
      },
    })

    // Invalidar caché del usuario
    try {
      await invalidateCache(`user:settings:${session.user.id}`)
    } catch {}

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      settings: {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        ticketUpdates: settings.ticketUpdates,
        systemAlerts: settings.systemAlerts,
        weeklyReport: settings.weeklyReport,
        soundEnabled: settings.soundEnabled,
        ticketCreated: settings.ticketCreated,
        ticketAssigned: settings.ticketAssigned,
        statusChanged: settings.statusChanged,
        newComments: settings.newComments,
        ticketUpdated: settings.ticketUpdated,
        quietHours: {
          enabled: settings.quietHoursEnabled,
          startTime: settings.quietHoursStart,
          endTime: settings.quietHoursEnd,
        },
        autoAssignEnabled: settings.autoAssignEnabled,
        maxConcurrentTickets: settings.maxConcurrentTickets,
        theme: settings.theme,
        language: settings.language,
        timezone: settings.timezone,
        profileVisible: data.profileVisible ?? true,
        activityVisible: data.activityVisible ?? true,
      },
    })
  } catch (error) {
    console.error('[API-USER-SETTINGS] PUT Error:', error)

    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    )
  }
}
