import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

// GET: Verificar si el usuario está bloqueado por intentos fallidos
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const user = await prisma.users.findUnique({ where: { id }, select: { email: true } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Buscar cualquier registro de bloqueo para este email
    const lockRecords = await prisma.system_settings.findMany({
      where: { key: { startsWith: `failed_login:${user.email}:` } },
    })

    const { SecurityConfigService } = await import('@/lib/services/security-config-service')
    const config = await SecurityConfigService.getConfig()

    let isLocked = false
    const LOCKOUT_DURATION = 30 * 60 * 1000
    const now = Date.now()

    for (const record of lockRecords) {
      const data = JSON.parse(record.value as string)
      const expired = now - (data.lastAttempt || 0) > LOCKOUT_DURATION
      if (!expired && data.attempts >= config.maxLoginAttempts) {
        isLocked = true
        break
      }
    }

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
    const body = await request.json()
    const { newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const user = await prisma.users.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await prisma.users.update({
      where: { id },
      data: { passwordHash, updatedAt: new Date() },
    })

    // Limpiar intentos fallidos de login para este usuario (todas las IPs)
    await prisma.system_settings.deleteMany({
      where: { key: { startsWith: `failed_login:${user.email}:` } },
    })

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
    const user = await prisma.users.findUnique({ where: { id }, select: { id: true, name: true, email: true } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Limpiar todos los intentos fallidos de login para este usuario
    const deleted = await prisma.system_settings.deleteMany({
      where: { key: { startsWith: `failed_login:${user.email}:` } },
    })

    return NextResponse.json({
      success: true,
      message: `Bloqueos de acceso eliminados para ${user.name} (${deleted.count} registros)`,
    })
  } catch (error) {
    console.error('Error clearing login blocks:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
