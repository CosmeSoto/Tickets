import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { SecurityConfigService } from '@/lib/services/security-config-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * POST /api/user/change-password
 * Cambia la contraseña del usuario actual y marca passwordChangedAt.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const secCfg = await SecurityConfigService.getConfig()
    const minLength = secCfg.passwordMinLength || 8

    const changePasswordSchema = z
      .object({
        currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
        newPassword: z
          .string()
          .min(minLength, `La nueva contraseña debe tener al menos ${minLength} caracteres`),
        confirmPassword: z.string().min(1, 'Confirma la nueva contraseña'),
      })
      .refine(data => data.newPassword === data.confirmPassword, {
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      })

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
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.oauthProvider && !user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: `No puedes cambiar la contraseña porque iniciaste sesión con ${user.oauthProvider}. Gestiona tu contraseña desde tu cuenta de ${user.oauthProvider}.`,
        },
        { status: 400 }
      )
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'No tienes una contraseña configurada. Contacta al administrador.',
        },
        { status: 400 }
      )
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      )
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, error: 'La nueva contraseña debe ser diferente a la actual' },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    const now = new Date()

    await prisma.users.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordChangedAt: now,
        updatedAt: now,
      },
    })

    // Invalidar caché de sesión/auth para que el JWT re-evalúe mustChangePassword
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(`auth:user:${user.id}`)
    } catch {
      // caché opcional
    }

    try {
      await AuditServiceComplete.log({
        action: AuditActionsComplete.USER_PASSWORD_CHANGED,
        entityType: 'user',
        entityId: user.id,
        userId: user.id,
        details: {
          email: user.email,
          method: 'self_service',
          forced: (session.user as { mustChangePassword?: boolean }).mustChangePassword === true,
        },
      })
    } catch (auditErr) {
      console.warn('[CHANGE-PASSWORD] No se pudo auditar:', auditErr)
    }

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
