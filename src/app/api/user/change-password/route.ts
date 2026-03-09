import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

/**
 * POST /api/user/change-password
 * Cambia la contraseña del usuario actual
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validation = changePasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error.errors[0].message,
          details: validation.error.errors,
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Obtener usuario con contraseña
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        oauthProvider: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar si el usuario usa OAuth (no tiene contraseña local)
    if (user.oauthProvider) {
      return NextResponse.json(
        {
          success: false,
          error: `No puedes cambiar la contraseña porque iniciaste sesión con ${user.oauthProvider}. Gestiona tu contraseña desde tu cuenta de ${user.oauthProvider}.`,
        },
        { status: 400 }
      )
    }

    // Verificar si el usuario tiene contraseña
    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes una contraseña configurada. Contacta al administrador.',
        },
        { status: 400 }
      )
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      )
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Actualizar contraseña
    await prisma.users.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
    })

    console.log('[CHANGE-PASSWORD] Contraseña actualizada para usuario:', user.email)

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    })
  } catch (error) {
    console.error('[CHANGE-PASSWORD] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al cambiar la contraseña' },
      { status: 500 }
    )
  }
}
