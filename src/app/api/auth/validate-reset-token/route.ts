import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Validar token de recuperación de contraseña
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { valid: false, message: 'Token requerido' },
        { status: 400 }
      )
    }

    // Buscar token en la base de datos
    const resetToken = await prisma.password_reset_tokens.findUnique({
      where: { token },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    })

    if (!resetToken) {
      return NextResponse.json({
        valid: false,
        message: 'Token inválido'
      })
    }

    // Verificar si ya fue usado
    if (resetToken.used) {
      return NextResponse.json({
        valid: false,
        message: 'Este enlace ya fue utilizado'
      })
    }

    // Verificar si expiró
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({
        valid: false,
        message: 'Este enlace ha expirado'
      })
    }

    return NextResponse.json({
      valid: true,
      user: {
        email: resetToken.users.email,
        name: resetToken.users.name
      }
    })

  } catch (error) {
    console.error('[VALIDATE RESET TOKEN] Error:', error)
    return NextResponse.json(
      { valid: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
