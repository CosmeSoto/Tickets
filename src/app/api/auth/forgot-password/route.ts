import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { EmailService } from '@/lib/services/email/email-service'

/**
 * Solicitar recuperación de contraseña
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
        name: true,
        email: true,
        oauthProvider: true,
        passwordHash: true
      }
    })

    // Por seguridad, siempre retornar éxito aunque el usuario no exista
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Si el email existe, recibirás un link de recuperación'
      })
    }

    // Si el usuario solo tiene OAuth, informar
    if (user.oauthProvider && !user.passwordHash) {
      return NextResponse.json({
        success: false,
        message: 'Esta cuenta usa OAuth. Inicia sesión con Google o Microsoft.',
        hasOAuth: true,
        provider: user.oauthProvider
      }, { status: 400 })
    }

    // Generar token de recuperación
    const resetToken = randomUUID()
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    // Guardar token en la base de datos
    await prisma.password_reset_tokens.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        token: resetToken,
        expiresAt: resetTokenExpiry,
        createdAt: new Date()
      }
    })

    // Construir URL de reseteo
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Enviar email
    try {
      await EmailService.queueEmail({
        to: user.email,
        subject: 'Recuperación de Contraseña - Sistema de Tickets',
        template: 'password-reset',
        templateData: {
          userName: user.name,
          resetUrl,
          expiryTime: '1 hora'
        }
      }, 'system')

      console.log(`[FORGOT PASSWORD] Email de recuperación enviado a: ${user.email}`)
    } catch (emailError) {
      console.error('[FORGOT PASSWORD] Error enviando email:', emailError)
      // No fallar la solicitud si el email falla
    }

    return NextResponse.json({
      success: true,
      message: 'Si el email existe, recibirás un link de recuperación'
    })

  } catch (error) {
    console.error('[FORGOT PASSWORD] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
