import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  LOCKOUT_DURATION_MINUTES,
  SecurityConfigService,
} from '@/lib/services/security-config-service'

function failedLoginKey(email: string): string {
  return `failed_login:${email.toLowerCase()}`
}

async function isUserLoginLocked(email: string): Promise<boolean> {
  const config = await SecurityConfigService.getConfig()
  const record = await prisma.system_settings.findUnique({
    where: { key: failedLoginKey(email) },
  })
  if (!record) return false

  const data = JSON.parse(record.value as string)
  const lockoutMs = LOCKOUT_DURATION_MINUTES * 60 * 1000
  if (Date.now() - (data.lastAttempt || 0) > lockoutMs) {
    await prisma.system_settings.delete({ where: { key: failedLoginKey(email) } }).catch(() => {})
    return false
  }

  return (data.attempts || 0) >= config.maxLoginAttempts
}

// GET: Verificar si el usuario está bloqueado por intentos fallidos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ isLocked: false }, { status: 401 })
    }

    const { id } = await params

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
    const scopeCheck = await assertAdminCanManageUser(
      session.user.id,
      viewer?.isSuperAdmin === true,
      id
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

    const user = await prisma.users.findUnique({ where: { id }, select: { email: true } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const isLocked = await isUserLoginLocked(user.email)

    return NextResponse.json({ isLocked })
  } catch (error) {
    console.error('Error checking lock status:', error)
    return NextResponse.json({ isLocked: false })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
    const scopeCheck = await assertAdminCanManageUser(
      session.user.id,
      viewer?.isSuperAdmin === true,
      id
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

    const body = await request.json()
    const { newPassword } = body

    const passwordCheck = await SecurityConfigService.validatePasswordLength(newPassword ?? '')
    if (!passwordCheck.valid) {
      return NextResponse.json({ error: passwordCheck.message }, { status: 400 })
    }

    const user = await prisma.users.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    const secCfg = await SecurityConfigService.getConfig()
    await prisma.users.update({
      where: { id },
      data: {
        passwordHash,
        updatedAt: new Date(),
        // Si hay política de cambio, marcar como cumplida tras reset admin
        ...(secCfg.requirePasswordChange ? { passwordChangedAt: new Date() } : {}),
      },
    })

    await SecurityConfigService.unlockAccount(user.email)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.USER_UPDATED,
      entityType: 'user',
      entityId: id,
      userId: session.user.id,
      details: {
        userName: user.name,
        userEmail: user.email,
        action: 'password_reset',
        resetBy: session.user.name,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Contraseña de ${user.name} actualizada y bloqueos de acceso eliminados`,
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE: Solo limpiar bloqueos de login sin cambiar contraseña
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
    const scopeCheck = await assertAdminCanManageUser(
      session.user.id,
      viewer?.isSuperAdmin === true,
      id
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

    const user = await prisma.users.findUnique({
      where: { id },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    await SecurityConfigService.unlockAccount(user.email)

    return NextResponse.json({
      success: true,
      message: `Bloqueos de acceso eliminados para ${user.name}`,
    })
  } catch (error) {
    console.error('Error clearing login blocks:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
