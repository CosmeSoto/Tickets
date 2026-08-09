import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * Endpoint para convertir un técnico a cliente
 * Valida que no tenga tickets pendientes ni asignaciones activas
 */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const params = await context.params
    const userId = params.id

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
    const scopeCheck = await assertAdminCanManageUser(
      session.user.id,
      viewer?.isSuperAdmin === true,
      userId
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json(
        { success: false, error: scopeCheck.error },
        { status: scopeCheck.status }
      )
    }

    // Verificar que el usuario existe y es técnico
    const user = await prisma.users.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, error: 'El usuario no es un técnico' },
        { status: 400 }
      )
    }

    // Validar que no tenga trabajo activo en ningún módulo habilitado
    try {
      const { UserModuleGuardService, ModuleDisableBlockedError } =
        await import('@/lib/services/user-module-guard.service')
      await UserModuleGuardService.assertCanChangeRole({
        userId,
        userName: user.name,
        currentRole: 'TECHNICIAN',
        newRole: 'CLIENT',
      })
    } catch (guardErr: any) {
      const { ModuleDisableBlockedError } = await import('@/lib/services/user-module-guard.service')
      if (guardErr instanceof ModuleDisableBlockedError) {
        return NextResponse.json(
          {
            success: false,
            error: `No se puede degradar a ${user.name}: tiene trabajo activo pendiente.`,
            blockers: guardErr.blockers,
            context: 'role',
          },
          { status: 422 }
        )
      }
      throw guardErr
    }

    // Convertir a cliente
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        role: 'CLIENT',
        updatedAt: new Date(),
      },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'user_demoted',
        entityType: 'User',
        entityId: userId,
        userId: session.user.id,
        details: {
          previousRole: 'TECHNICIAN',
          newRole: 'CLIENT',
          userName: user.name,
          userEmail: user.email,
        },
        createdAt: new Date(),
      },
    })

    // Invalidar cache de usuarios
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(['users:*'])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({
      success: true,
      message: `${user.name} ha sido convertido a cliente exitosamente`,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    })
  } catch (error) {
    console.error('[CRITICAL] Error demoting technician:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al convertir técnico a cliente',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
