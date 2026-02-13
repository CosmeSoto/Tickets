/**
 * @deprecated Use /api/user/settings instead
 * This endpoint uses deprecated tables (user_preferences + notification_preferences)
 * and will be removed in a future version.
 * 
 * Migration path: Use /api/user/settings which uses the consolidated user_settings table
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener preferencias de notificación del usuario
    const notificationPrefs = await prisma.notification_preferences.findUnique({
      where: { userId: session.user.id }
    })

    // Obtener preferencias generales del usuario
    const userPrefs = await prisma.user_preferences.findUnique({
      where: { userId: session.user.id }
    })

    // Configuración completa con valores por defecto
    const settings = {
      notifications: {
        email: notificationPrefs?.emailEnabled ?? true,
        push: notificationPrefs?.inAppEnabled ?? true,
        ticketUpdates: notificationPrefs?.ticketUpdated ?? true,
        systemAlerts: true,
        weeklyReport: false
      },
      privacy: {
        profileVisible: userPrefs?.profileVisible ?? true,
        activityVisible: userPrefs?.activityVisible ?? true
      },
      preferences: {
        theme: userPrefs?.theme || 'system',
        timezone: 'America/Guayaquil'
      }
    }

    return NextResponse.json({
      success: true,
      settings
    })
  } catch (error) {
    console.error('[CRITICAL] Error fetching user settings:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { notifications, privacy, preferences } = body

    // Actualizar preferencias de notificación
    if (notifications) {
      await prisma.notification_preferences.upsert({
        where: { userId: session.user.id },
        update: {
          emailEnabled: notifications.email ?? true,
          inAppEnabled: notifications.push ?? true,
          ticketUpdated: notifications.ticketUpdates ?? true,
          ticketCreated: notifications.ticketUpdates ?? true,
          ticketAssigned: notifications.ticketUpdates ?? true,
          ticketResolved: notifications.ticketUpdates ?? true,
          commentAdded: notifications.ticketUpdates ?? true
        },
        create: {
          userId: session.user.id,
          emailEnabled: notifications.email ?? true,
          inAppEnabled: notifications.push ?? true,
          ticketUpdated: notifications.ticketUpdates ?? true,
          ticketCreated: notifications.ticketUpdates ?? true,
          ticketAssigned: notifications.ticketUpdates ?? true,
          ticketResolved: notifications.ticketUpdates ?? true,
          commentAdded: notifications.ticketUpdates ?? true
        }
      })
    }

    // Actualizar preferencias generales del usuario
    if (privacy || preferences) {
      await prisma.user_preferences.upsert({
        where: { userId: session.user.id },
        update: {
          ...(privacy && {
            profileVisible: privacy.profileVisible ?? true,
            activityVisible: privacy.activityVisible ?? true
          }),
          ...(preferences && {
            theme: preferences.theme || 'system',
            timezone: 'America/Guayaquil'
          }),
          updatedAt: new Date()
        },
        create: {
          id: randomUUID(),
          userId: session.user.id,
          theme: preferences?.theme || 'system',
          timezone: 'America/Guayaquil',
          language: 'es',
          profileVisible: privacy?.profileVisible ?? true,
          activityVisible: privacy?.activityVisible ?? true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada exitosamente'
    })
  } catch (error) {
    console.error('[CRITICAL] Error updating user settings:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}
