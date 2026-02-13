import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para configuraciones de usuario
const userSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  autoAssignEnabled: z.boolean().optional(),
  maxConcurrentTickets: z.number().min(1).max(50).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.enum(['es', 'en', 'fr', 'de']).optional(),
  timezone: z.string().optional()
})

/**
 * GET /api/user/settings
 * Obtiene la configuración del usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Buscar configuración existente
    let settings = await prisma.user_settings.findUnique({
      where: { userId }
    })

    // Si no existe, crear con valores por defecto
    if (!settings) {
      const now = new Date()
      settings = await prisma.user_settings.create({
        data: {
          id: randomUUID(),
          userId,
          emailNotifications: true,
          pushNotifications: true,
          autoAssignEnabled: true,
          maxConcurrentTickets: 10,
          theme: 'light',
          language: 'es',
          timezone: 'America/Guayaquil',
          updatedAt: now
        }
      })
    }

    return NextResponse.json({
      success: true,
      settings: {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        autoAssignEnabled: settings.autoAssignEnabled,
        maxConcurrentTickets: settings.maxConcurrentTickets,
        theme: settings.theme,
        language: settings.language,
        timezone: settings.timezone
      }
    })
  } catch (error) {
    console.error('[API-USER-SETTINGS] GET Error:', error)
    console.error('[API-USER-SETTINGS] Error details:', error instanceof Error ? error.message : String(error))
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
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
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
          details: validation.error.errors 
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Actualizar o crear configuración
    const settings = await prisma.user_settings.upsert({
      where: { userId },
      update: {
        emailNotifications: data.emailNotifications,
        pushNotifications: data.pushNotifications,
        autoAssignEnabled: data.autoAssignEnabled,
        maxConcurrentTickets: data.maxConcurrentTickets,
        theme: data.theme,
        language: data.language,
        timezone: data.timezone,
        updatedAt: new Date()
      },
      create: {
        id: randomUUID(),
        userId,
        emailNotifications: data.emailNotifications ?? true,
        pushNotifications: data.pushNotifications ?? true,
        autoAssignEnabled: data.autoAssignEnabled ?? true,
        maxConcurrentTickets: data.maxConcurrentTickets ?? 10,
        theme: data.theme ?? 'light',
        language: 'es',
        timezone: 'America/Guayaquil',
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      settings: {
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
        autoAssignEnabled: settings.autoAssignEnabled,
        maxConcurrentTickets: settings.maxConcurrentTickets,
        theme: settings.theme,
        language: settings.language,
        timezone: settings.timezone
      }
    })
  } catch (error) {
    console.error('[API-USER-SETTINGS] PUT Error:', error)
    console.error('[API-USER-SETTINGS] Error details:', error instanceof Error ? error.message : String(error))
    
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración' },
      { status: 500 }
    )
  }
}
