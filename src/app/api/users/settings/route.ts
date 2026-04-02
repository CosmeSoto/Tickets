/**
 * @deprecated Use /api/user/settings instead
 * Redirige a /api/user/settings que usa la tabla consolidada user_settings.
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

    const notificationPrefs = await prisma.notification_preferences.findUnique({
      where: { userId: session.user.id }
    })

    const userSettings = await prisma.user_settings.findUnique({
      where: { userId: session.user.id },
      select: { theme: true, timezone: true, language: true }
    })

    return NextResponse.json({
      success: true,
      settings: {
        notifications: {
          email: notificationPrefs?.emailEnabled ?? true,
          push: notificationPrefs?.inAppEnabled ?? true,
          ticketUpdates: notificationPrefs?.ticketUpdated ?? true,
          systemAlerts: true,
          weeklyReport: false
        },
        privacy: {
          profileVisible: true,
          activityVisible: true
        },
        preferences: {
          theme: userSettings?.theme || 'system',
          timezone: userSettings?.timezone || 'America/Guayaquil'
        }
      }
    })
  } catch (error) {
    console.error('[CRITICAL] Error fetching user settings:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { notifications, preferences } = body

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

    if (preferences) {
      await prisma.user_settings.upsert({
        where: { userId: session.user.id },
        update: {
          ...(preferences.theme && { theme: preferences.theme }),
          updatedAt: new Date()
        },
        create: {
          id: randomUUID(),
          userId: session.user.id,
          theme: preferences.theme || 'light',
          timezone: 'America/Guayaquil',
          language: 'es',
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({ success: true, message: 'Configuración actualizada exitosamente' })
  } catch (error) {
    console.error('[CRITICAL] Error updating user settings:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 })
  }
}
