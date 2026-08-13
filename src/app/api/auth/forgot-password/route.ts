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
      return NextResponse.json({ success: false, message: 'Email requerido' }, { status: 400 })
    }

    // Buscar usuario
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        name: true,
        email: true,
        oauthProvider: true,
        passwordHash: true,
      },
    })

    // Por seguridad, siempre retornar éxito aunque el usuario no exista
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'Si el email existe, recibirás un link de recuperación',
      })
    }

    // Si el usuario solo tiene OAuth, informar
    if (user.oauthProvider && !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: 'Esta cuenta usa OAuth. Inicia sesión con Google o Microsoft.',
          hasOAuth: true,
          provider: user.oauthProvider,
        },
        { status: 400 }
      )
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
        createdAt: new Date(),
      },
    })

    // Construir URL de reseteo
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`

    // Enviar email — directo (no encolar) porque es evento crítico de seguridad.
    // Un email encolado depende de un cron externo; para reseteo de contraseña
    // el usuario necesita el link de inmediato.
    let emailSent = false
    let emailError = ''
    try {
      const { getEmailBranding } = await import('@/lib/services/email/email-branding')
      const { systemName } = await getEmailBranding()

      emailSent = await EmailService.sendEmail({
        to: user.email,
        subject: `Restablecer contraseña — ${systemName}`,
        template: 'password-reset',
        templateData: {
          userName: user.name,
          resetUrl,
          expiryTime: '1 hora',
        },
      })

      if (emailSent) {
        console.log(`[FORGOT PASSWORD] Email enviado directamente a: ${user.email}`)
      } else {
        emailError = 'sendEmail devolvió false — revisar logs SMTP'
        console.error(`[FORGOT PASSWORD] Error: ${emailError}`)
      }
    } catch (emailErr) {
      emailError = emailErr instanceof Error ? emailErr.message : String(emailErr)
      console.error('[FORGOT PASSWORD] Error enviando email:', emailError)
    }

    // Si el email falló, eliminar el token para evitar tokens huérfanos
    // y devolver un error claro al usuario en lugar de silenciar el fallo.
    if (!emailSent) {
      await prisma.password_reset_tokens
        .deleteMany({ where: { token: resetToken } })
        .catch(() => {})
      return NextResponse.json(
        {
          success: false,
          message:
            'No se pudo enviar el email de recuperación. Verifica la configuración SMTP en Admin → Configuración → Email.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Si el email existe, recibirás un link de recuperación',
    })
  } catch (error) {
    console.error('[FORGOT PASSWORD] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
