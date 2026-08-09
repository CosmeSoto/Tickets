import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { IdResolverService } from '@/lib/services/id-resolver-service'
import { NotificationEvents } from '@/lib/notification-events'

const updateUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT']).optional(),
  departmentId: z.string().nullable().optional(),
  department: z.string().optional(), // Deprecated, usar departmentId
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  canManageInventory: z.boolean().optional(),
  canRequestAssets: z.boolean().optional(),
  canAccessKnowledge: z.boolean().optional(),
  ticketsEnabled: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
  patrolsEnabled: z.boolean().optional(),
  newsEnabled: z.boolean().optional(),
  canManageNews: z.boolean().optional(),
  formsEnabled: z.boolean().optional(),
  canManageForms: z.boolean().optional(),
  credentialsEnabled: z.boolean().optional(),
  canManageCredentials: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
  assignedCategories: z
    .array(
      z.object({
        categoryId: z.string(),
        priority: z.number().min(1).max(10),
        maxTickets: z.number().min(1).optional(),
        autoAssign: z.boolean().optional().default(true),
      })
    )
    .optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Los usuarios pueden ver su propio perfil, los admins pueden ver usuarios en su ámbito
    const targetId = (await params).id
    if (session.user.role !== 'ADMIN' && session.user.id !== targetId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (session.user.role === 'ADMIN' && session.user.id !== targetId) {
      const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
      const scopeCheck = await assertAdminCanManageUser(
        session.user.id,
        (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
        targetId
      )
      if (!scopeCheck.allowed) {
        return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
      }
    }

    const user = await UserService.getUserById(targetId)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user,
    })
  } catch (error) {
    console.error('Error al obtener usuario:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Solo admins pueden editar usuarios, excepto su propio perfil
    if (session.user.role !== 'ADMIN' && session.user.id !== (await params).id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const targetId = (await params).id
    const isSelf = session.user.id === targetId

    if (session.user.role === 'ADMIN' && !isSelf) {
      const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
      const scopeCheck = await assertAdminCanManageUser(
        session.user.id,
        (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
        targetId
      )
      if (!scopeCheck.allowed) {
        return NextResponse.json(
          { success: false, error: scopeCheck.error },
          { status: scopeCheck.status }
        )
      }
    }

    const body = await request.json()

    // Validar datos de entrada
    const validatedData = updateUserSchema.parse(body)

    // Obtener datos del usuario antes de la actualización para comparar cambios
    const currentUser = await UserService.getUserById(targetId)
    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado',
        },
        { status: 404 }
      )
    }

    // Si no es admin, o edita su propio perfil: solo campos de perfil (sin privilegios)
    if (session.user.role !== 'ADMIN' || isSelf) {
      delete validatedData.role
      delete validatedData.isActive
      delete validatedData.assignedCategories
      delete validatedData.departmentId
      delete validatedData.department
      delete validatedData.isSuperAdmin
      delete validatedData.canRequestAssets
      delete validatedData.canAccessKnowledge
      delete validatedData.canManageInventory
      delete validatedData.ticketsEnabled
      delete validatedData.inventoryEnabled
      delete validatedData.patrolsEnabled
      delete validatedData.newsEnabled
      delete validatedData.canManageNews
      delete validatedData.formsEnabled
      delete validatedData.canManageForms
      delete validatedData.credentialsEnabled
      delete validatedData.canManageCredentials
    }

    // Un admin no puede desactivar su propia cuenta
    if (isSelf && validatedData.isActive === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'No puedes desactivar tu propia cuenta',
        },
        { status: 400 }
      )
    }

    // Un admin no puede cambiar su propio rol (evita auto-degradación accidental)
    if (isSelf && validatedData.role && validatedData.role !== session.user.role) {
      return NextResponse.json(
        {
          success: false,
          error: 'No puedes cambiar tu propio rol',
        },
        { status: 400 }
      )
    }

    // Solo un super admin puede cambiar el flag isSuperAdmin de otro usuario
    if (validatedData.isSuperAdmin !== undefined && !(session.user as any).isSuperAdmin) {
      delete validatedData.isSuperAdmin
    }

    // Crear/elevar a ADMIN: solo Super Admin
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (validatedData.role === 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo un Super Administrador puede asignar el rol de administrador',
        },
        { status: 403 }
      )
    }

    // ── Solo Super Admin puede cambiar el departamento ────────────────────────
    // El departamento es el vínculo nativo del usuario a su familia.
    // Un admin normal no puede reasignarlo — solo el super admin puede hacerlo.
    if (
      validatedData.departmentId !== undefined &&
      validatedData.departmentId !== currentUser.departmentId &&
      !isSuperAdmin
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Solo un Super Administrador puede cambiar el departamento de un usuario. El departamento define la familia nativa del usuario y no puede modificarse por un administrador normal.',
        },
        { status: 403 }
      )
    }

    // ── Guardia de desactivación de módulos ───────────────────────────────────
    // Solo aplica cuando el admin está desactivando módulos (flag true → false).
    // Bloquea si el usuario tiene trabajo activo que depende del módulo.
    if (session.user.role === 'ADMIN') {
      try {
        const { UserModuleGuardService, ModuleDisableBlockedError } =
          await import('@/lib/services/user-module-guard.service')
        await UserModuleGuardService.assertCanDisableModules({
          userId: targetId,
          userName: currentUser.name,
          current: {
            ticketsEnabled: (currentUser as any).ticketsEnabled ?? true,
            inventoryEnabled: (currentUser as any).inventoryEnabled ?? false,
            canManageInventory: (currentUser as any).canManageInventory ?? false,
            patrolsEnabled: (currentUser as any).patrolsEnabled ?? false,
            newsEnabled: (currentUser as any).newsEnabled ?? false,
            formsEnabled: (currentUser as any).formsEnabled ?? false,
            canManageForms: (currentUser as any).canManageForms ?? false,
            credentialsEnabled: (currentUser as any).credentialsEnabled ?? false,
            canManageCredentials: (currentUser as any).canManageCredentials ?? false,
            canRequestAssets: (currentUser as any).canRequestAssets ?? false,
          },
          incoming: {
            ticketsEnabled: validatedData.ticketsEnabled,
            inventoryEnabled: validatedData.inventoryEnabled,
            canManageInventory: validatedData.canManageInventory,
            patrolsEnabled: validatedData.patrolsEnabled,
            newsEnabled: validatedData.newsEnabled,
            formsEnabled: validatedData.formsEnabled,
            canManageForms: validatedData.canManageForms,
            credentialsEnabled: validatedData.credentialsEnabled,
            canManageCredentials: validatedData.canManageCredentials,
            canRequestAssets: (validatedData as any).canRequestAssets,
          },
        })
      } catch (guardErr: any) {
        const { ModuleDisableBlockedError } =
          await import('@/lib/services/user-module-guard.service')
        if (guardErr instanceof ModuleDisableBlockedError) {
          return NextResponse.json(
            {
              success: false,
              error: `No se pueden desactivar los módulos de ${guardErr.userName}: hay trabajo activo pendiente.`,
              blockers: guardErr.blockers,
            },
            { status: 422 }
          )
        }
        throw guardErr
      }
    }

    // ── Guardia de cambio de rol ──────────────────────────────────────────────
    // Si el rol cambia, verificar que el usuario no tenga trabajo activo en
    // ningún módulo habilitado antes de permitir el cambio.
    if (
      session.user.role === 'ADMIN' &&
      validatedData.role &&
      validatedData.role !== currentUser.role
    ) {
      try {
        const { UserModuleGuardService, ModuleDisableBlockedError } =
          await import('@/lib/services/user-module-guard.service')
        await UserModuleGuardService.assertCanChangeRole({
          userId: targetId,
          userName: currentUser.name,
          currentRole: currentUser.role,
          newRole: validatedData.role,
        })
      } catch (guardErr: any) {
        const { ModuleDisableBlockedError } =
          await import('@/lib/services/user-module-guard.service')
        if (guardErr instanceof ModuleDisableBlockedError) {
          return NextResponse.json(
            {
              success: false,
              error: `No se puede cambiar el rol de ${guardErr.userName}: tiene trabajo activo pendiente.`,
              blockers: guardErr.blockers,
              context: 'role',
            },
            { status: 422 }
          )
        }
        throw guardErr
      }
    }

    // Actualizar el usuario
    const user = await UserService.updateUser(targetId, validatedData)

    // Invalidar caché ANTES de emitir eventos SSE para evitar race conditions
    // (el usuario recibe session_refresh, hace reload, y el cache ya está limpio)
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([
        invalidateCache(`auth:user:${targetId}`),
        invalidateCache(`perm:inv:${targetId}`),
        invalidateCache(`user:settings:${targetId}`),
        invalidateCache(`user:modules:${targetId}`),
        invalidateCache(`inv:families:*`),
        invalidateCache(`users:list:*`),
      ])
    } catch {
      /* Redis no disponible */
    }

    // Registrar auditoría de cambios y emitir notificaciones SSE
    try {
      // Detectar cambios importantes comparando valores anteriores con nuevos
      const changes: Record<string, { old: any; new: any }> = {}
      const oldValues: Record<string, any> = {}
      const newValues: Record<string, any> = {}

      if (validatedData.name && validatedData.name !== currentUser.name) {
        changes.name = { old: currentUser.name, new: validatedData.name }
        oldValues.name = currentUser.name
        newValues.name = validatedData.name
      }

      if (validatedData.email && validatedData.email !== currentUser.email) {
        changes.email = { old: currentUser.email, new: validatedData.email }
        oldValues.email = currentUser.email
        newValues.email = validatedData.email
      }

      if (validatedData.role && validatedData.role !== currentUser.role) {
        changes.role = {
          old: IdResolverService.getRoleDisplayName(currentUser.role),
          new: IdResolverService.getRoleDisplayName(validatedData.role),
        }
        oldValues.role = currentUser.role
        newValues.role = validatedData.role

        // Notificar al usuario afectado para que refresque su sesión inmediatamente
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'role_changed',
          newRole: validatedData.role,
        })
      }

      if (validatedData.departmentId !== undefined) {
        const currentDeptId = currentUser.departmentId
        if (validatedData.departmentId !== currentDeptId) {
          // Obtener nombres de departamentos para auditoría legible
          const oldDeptName = await IdResolverService.resolveDepartmentId(currentDeptId)
          const newDeptName = await IdResolverService.resolveDepartmentId(
            validatedData.departmentId
          )

          changes.departmentId = { old: oldDeptName, new: newDeptName }
          oldValues.departmentId = currentDeptId
          newValues.departmentId = validatedData.departmentId
        }
      }

      if (validatedData.phone !== undefined && validatedData.phone !== currentUser.phone) {
        changes.phone = {
          old: currentUser.phone || 'Sin teléfono',
          new: validatedData.phone || 'Sin teléfono',
        }
        oldValues.phone = currentUser.phone
        newValues.phone = validatedData.phone
      }

      if (validatedData.isActive !== undefined && validatedData.isActive !== currentUser.isActive) {
        changes.isActive = {
          old: IdResolverService.getBooleanDisplayName(currentUser.isActive),
          new: IdResolverService.getBooleanDisplayName(validatedData.isActive),
        }
        oldValues.isActive = currentUser.isActive
        newValues.isActive = validatedData.isActive

        // Si se desactiva el usuario, notificarle para que cierre sesión
        if (!validatedData.isActive) {
          NotificationEvents.emit(targetId, {
            type: 'session_refresh',
            reason: 'account_deactivated',
          })
        }
      }

      // Si cambia canManageInventory, notificar para refrescar sesión
      if (
        (validatedData as any).canManageInventory !== undefined &&
        (validatedData as any).canManageInventory !== (currentUser as any).canManageInventory
      ) {
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'permissions_changed',
        })
      }

        // Si cambia canRequestAssets, notificar para refrescar sesión
      if (
        (validatedData as any).canRequestAssets !== undefined &&
        (validatedData as any).canRequestAssets !== (currentUser as any).canRequestAssets
      ) {
        changes.canRequestAssets = {
          old: (currentUser as any).canRequestAssets ? 'Puede solicitar' : 'No puede solicitar',
          new: (validatedData as any).canRequestAssets ? 'Puede solicitar' : 'No puede solicitar',
        }
        oldValues.canRequestAssets = (currentUser as any).canRequestAssets
        newValues.canRequestAssets = (validatedData as any).canRequestAssets
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'permissions_changed',
        })
      }

      if (
        (validatedData as any).canAccessKnowledge !== undefined &&
        (validatedData as any).canAccessKnowledge !== (currentUser as any).canAccessKnowledge
      ) {
        changes.canAccessKnowledge = {
          old: (currentUser as any).canAccessKnowledge !== false ? 'KB activa' : 'KB desactivada',
          new: (validatedData as any).canAccessKnowledge ? 'KB activa' : 'KB desactivada',
        }
        oldValues.canAccessKnowledge = (currentUser as any).canAccessKnowledge ?? true
        newValues.canAccessKnowledge = (validatedData as any).canAccessKnowledge
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'permissions_changed',
        })
      }

      // Si cambian ticketsEnabled, inventoryEnabled, patrolsEnabled, newsEnabled, formsEnabled o canManageForms
      // notificar SOLO si realmente hubo un cambio (evitar reloads innecesarios)
      const modulesActuallyChanged =
        (validatedData.ticketsEnabled !== undefined &&
          validatedData.ticketsEnabled !== (currentUser as any).ticketsEnabled) ||
        (validatedData.inventoryEnabled !== undefined &&
          validatedData.inventoryEnabled !== (currentUser as any).inventoryEnabled) ||
        (validatedData.patrolsEnabled !== undefined &&
          validatedData.patrolsEnabled !== (currentUser as any).patrolsEnabled) ||
        (validatedData.newsEnabled !== undefined &&
          validatedData.newsEnabled !== (currentUser as any).newsEnabled) ||
        ((validatedData as any).formsEnabled !== undefined &&
          (validatedData as any).formsEnabled !== (currentUser as any).formsEnabled) ||
        ((validatedData as any).canManageForms !== undefined &&
          (validatedData as any).canManageForms !== (currentUser as any).canManageForms) ||
        (validatedData.credentialsEnabled !== undefined &&
          validatedData.credentialsEnabled !== (currentUser as any).credentialsEnabled) ||
        (validatedData.canManageCredentials !== undefined &&
          validatedData.canManageCredentials !== (currentUser as any).canManageCredentials)

      if (modulesActuallyChanged) {
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'modules_changed',
        })
      }

      // Si cambia isSuperAdmin, registrar acción específica y notificar
      if (
        validatedData.isSuperAdmin !== undefined &&
        validatedData.isSuperAdmin !== (currentUser as any).isSuperAdmin
      ) {
        changes.isSuperAdmin = {
          old: (currentUser as any).isSuperAdmin ? 'Super Admin' : 'Admin normal',
          new: validatedData.isSuperAdmin ? 'Super Admin' : 'Admin normal',
        }
        oldValues.isSuperAdmin = (currentUser as any).isSuperAdmin
        newValues.isSuperAdmin = validatedData.isSuperAdmin
        NotificationEvents.emit(targetId, {
          type: 'session_refresh',
          reason: 'permissions_changed',
        })
      }

      // Registrar en auditoría si hay cambios
      if (Object.keys(changes).length > 0) {
        await AuditServiceComplete.log({
          userId: session.user.id,
          action: AuditActionsComplete.USER_UPDATED,
          entityType: 'user',
          entityId: (await params).id,
          details: {
            userName: currentUser.name,
            userEmail: currentUser.email,
            changes,
          },
          oldValues,
          newValues,
          metadata: {
            userAgent: request.headers.get('user-agent') || 'Unknown',
            ip: request.headers.get('x-forwarded-for') || 'Unknown',
          },
        })
      }
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuario actualizado correctamente',
    })
  } catch (error) {
    console.error('Error al actualizar usuario:', error)

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          {
            success: false,
            error: 'Datos inválidos',
            details: (error as any).errors,
          },
          { status: 400 }
        )
      }

      if (error.message.includes('Usuario no encontrado')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        )
      }

      if (error.message.includes('Ya existe un usuario')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'No autorizado',
        },
        { status: 401 }
      )
    }

    // No permitir que el admin se elimine a sí mismo
    const targetId = (await params).id
    if (session.user.id === targetId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No puedes eliminar tu propia cuenta',
        },
        { status: 400 }
      )
    }

    const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
    const scopeCheck = await assertAdminCanManageUser(
      session.user.id,
      (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
      targetId
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json(
        { success: false, error: scopeCheck.error },
        { status: scopeCheck.status }
      )
    }

    // Obtener datos del usuario antes de eliminarlo para las notificaciones
    const userToDelete = await UserService.getUserById(targetId)
    if (!userToDelete) {
      return NextResponse.json(
        {
          success: false,
          error: 'Usuario no encontrado',
        },
        { status: 404 }
      )
    }

    await UserService.deleteUser((await params).id)

    // Invalidar caché del usuario eliminado
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      const deletedId = (await params).id
      await Promise.all([
        invalidateCache(`auth:user:${deletedId}`),
        invalidateCache(`perm:inv:${deletedId}`),
        invalidateCache(`user:settings:${deletedId}`),
        invalidateCache(`user:modules:${deletedId}`),
        invalidateCache(`users:list:*`), // Invalidar todas las listas de usuarios
      ])
    } catch {
      /* Redis no disponible */
    }

    // ⭐ AUDITORÍA: Registrar eliminación de usuario
    await AuditServiceComplete.log({
      action: AuditActionsComplete.USER_DELETED,
      entityType: 'user',
      entityId: (await params).id,
      userId: session.user.id,
      details: {
        userName: userToDelete.name,
        userEmail: userToDelete.email,
        userRole: userToDelete.role,
        deletedBy: session.user.name,
      },
      request: request,
    })

    // Enviar notificaciones de usuario eliminado (log para auditoría)
    try {
      console.log(`[INFO] User deleted: ${(await params).id} by user ${session.user.id}`)

      // Log específico para técnicos
      if (userToDelete.role === 'TECHNICIAN') {
        console.log(`[INFO] Technician deleted: ${(await params).id} by user ${session.user.id}`)
      }
    } catch (notificationError) {
      console.error('Error enviando notificaciones de usuario eliminado:', notificationError)
      // No fallar la eliminación por errores de notificación
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
    })
  } catch (error) {
    console.error('Error al eliminar usuario:', error)

    if (error instanceof Error) {
      if (error.message.includes('Usuario no encontrado')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 404 }
        )
      }

      if (error.message.includes('tickets asignados')) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 400 }
        )
      }

      // Exponer el error real para diagnóstico
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
