import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * Restablecer contraseña con token
 */
export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Token y contraseña requeridos' },
        { status: 400 }
      )
    }

    // Validar longitud de contraseña
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: 'La contraseña debe tener al menos 8 caracteres' },
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
      return NextResponse.json(
        { success: false, message: 'Token inválido' },
        { status: 400 }
      )
    }

    // Verificar si ya fue usado
    if (resetToken.used) {
      return NextResponse.json(
        { success: false, message: 'Este enlace ya fue utilizado' },
        { status: 400 }
      )
    }

    // Verificar si expiró
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { success: false, message: 'Este enlace ha expirado' },
        { status: 400 }
      )
    }

    // Hash de la nueva contraseña
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Actualizar contraseña del usuario
    await prisma.users.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        updatedAt: new Date()
      }
    })

    // Marcar token como usado
    await prisma.password_reset_tokens.update({
      where: { id: resetToken.id },
      data: { used: true }
    })

    // Invalidar todas las sesiones activas del usuario por seguridad
    await prisma.sessions.deleteMany({
      where: { userId: resetToken.userId }
    })

    // Registrar en auditoría
    await AuditServiceComplete.logAction({
      userId: resetToken.userId,
      action: AuditActionsComplete.PASSWORD_RESET,
      entityType: 'user',
      entityId: resetToken.userId,
      details: {
        email: resetToken.users.email,
        method: 'email_reset'
      }
    })

    console.log(`[RESET PASSWORD] Contraseña restablecida para: ${resetToken.users.email}`)

    return NextResponse.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    })

  } catch (error) {
    console.error('[RESET PASSWORD] Error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
