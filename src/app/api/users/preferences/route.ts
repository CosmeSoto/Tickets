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

    // Obtener preferencias del usuario
    const userPrefs = await prisma.user_preferences.findUnique({
      where: { userId: session.user.id }
    })

    return NextResponse.json({
      success: true,
      preferences: {
        theme: userPrefs?.theme || 'system',
        timezone: userPrefs?.timezone || 'America/Guayaquil',
        language: userPrefs?.language || 'es'
      }
    })
  } catch (error) {
    console.error('[CRITICAL] Error fetching user preferences:', error)
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
    const { theme, timezone, language } = body

    // Actualizar o crear preferencias del usuario
    await prisma.user_preferences.upsert({
      where: { userId: session.user.id },
      update: {
        ...(theme && { theme }),
        ...(timezone && { timezone }),
        ...(language && { language }),
        updatedAt: new Date()
      },
      create: {
        id: randomUUID(),
        userId: session.user.id,
        theme: theme || 'system',
        timezone: 'America/Guayaquil',
        language: 'es',
        profileVisible: true,
        activityVisible: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Preferencias actualizadas exitosamente'
    })
  } catch (error) {
    console.error('[CRITICAL] Error updating user preferences:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}
