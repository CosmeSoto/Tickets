import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Verificar si un usuario tiene OAuth configurado
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email requerido' },
        { status: 400 }
      )
    }

    // Buscar usuario
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        oauthProvider: true,
        oauthId: true,
        passwordHash: true
      }
    })

    if (!user) {
      // No revelar si el usuario existe o no por seguridad
      return NextResponse.json({
        success: true,
        hasOAuth: false,
        provider: null
      })
    }

    // Verificar si tiene OAuth configurado
    const hasOAuth = !!(user.oauthProvider && user.oauthId)

    return NextResponse.json({
      success: true,
      hasOAuth,
      provider: hasOAuth ? user.oauthProvider : null,
      hasPassword: !!user.passwordHash
    })

  } catch (error) {
    console.error('[CHECK OAUTH] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
