import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
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
  isSuperAdmin: z.boolean().optional(),
  assignedCategories: z.array(z.object({
    categoryId: z.string(),
    priority: z.number().min(1).max(10),
    maxTickets: z.number().min(1).optional(),
    autoAssign: z.boolean().optional().default(true),
  })).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Los usuarios pueden ver su propio perfil, los admins pueden ver cualquiera
    if (session.user.role !== 'ADMIN' && session.user.id !== (await params).id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const user = await UserService.getUserById((await params).id)

    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuario no encontrado' 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
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

    const body = await request.json()

    // Validar datos de entrada
    const validatedData = updateUserSchema.parse(body)

    // Obtener datos del usuario antes de la actualización para comparar cambios
    const currentUser = await UserService.getUserById((await params).id)
    if (!currentUser) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuario no encontrado' 
      }, { status: 404 })
    }

    // Si no es admin, no puede cambiar rol o estado activo
    if (session.user.role !== 'ADMIN') {
      delete validatedData.role
      delete validatedData.isActive
      delete validatedData.assignedCategories // Solo admins pueden asignar categorías
    }

    const targetId = (await params).id
    const isSelf = session.user.id === targetId

    // Un admin no puede desactivar su propia cuenta
    if (isSelf && validatedData.isActive === false) {
      return NextResponse.json({ 
        success: false,
        error: 'No puedes desactivar tu propia cuenta' 
      }, { status: 400 })
    }

    // Un admin no puede cambiar su propio rol (evita auto-degradación accidental)
    if (isSelf && validatedData.role && validatedData.role !== session.user.role) {
      return NextResponse.json({ 
        success: false,
        error: 'No puedes cambiar tu propio rol' 
      }, { status: 400 })
    }

    // Solo un super admin puede cambiar el flag isSuperAdmin de otro usuario
    if (validatedData.isSuperAdmin !== undefined && !(session.user as any).isSuperAdmin) {
      delete validatedData.isSuperAdmin
    }

    // Actualizar el usuario
    const user = await UserService.updateUser(targetId, validatedData)

    // Registrar auditoría de cambios
    try {
      // Detectar cambios importantes comparando valores anteriores con nuevos
      const changes: Record<string, { old: any, new: any }> = {}
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
          new: IdResolverService.getRoleDisplayName(validatedData.role)
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
          const newDeptName = await IdResolverService.resolveDepartmentId(validatedData.departmentId)
          
          changes.departmentId = { old: oldDeptName, new: newDeptName }
          oldValues.departmentId = currentDeptId
          newValues.departmentId = validatedData.departmentId
        }
      }
      
      if (validatedData.phone !== undefined && validatedData.phone !== currentUser.phone) {
        changes.phone = { old: currentUser.phone || 'Sin teléfono', new: validatedData.phone || 'Sin teléfono' }
        oldValues.phone = currentUser.phone
        newValues.phone = validatedData.phone
      }
      
      if (validatedData.isActive !== undefined && validatedData.isActive !== currentUser.isActive) {
        changes.isActive = { 
          old: IdResolverService.getBooleanDisplayName(currentUser.isActive), 
          new: IdResolverService.getBooleanDisplayName(validatedData.isActive)
        }
        oldValues.isActive = currentUser.isActive
        newValues.isActive = validatedData.isActive

        // Si se desactiva el usuario, notificarle para que cierre sesión
        if (!validatedData.isActive) {
          NotificationEvents.emit(targetId, { type: 'session_refresh', reason: 'account_deactivated' })
        }
      }

      // Si cambia canManageInventory, notificar para refrescar sesión
      if ((validatedData as any).canManageInventory !== undefined &&
          (validatedData as any).canManageInventory !== (currentUser as any).canManageInventory) {
        NotificationEvents.emit(targetId, { type: 'session_refresh', reason: 'permissions_changed' })
      }

      // Si cambia isSuperAdmin, registrar acción específica y notificar
      if (validatedData.isSuperAdmin !== undefined &&
          validatedData.isSuperAdmin !== (currentUser as any).isSuperAdmin) {
        changes.isSuperAdmin = {
          old: (currentUser as any).isSuperAdmin ? 'Super Admin' : 'Admin normal',
          new: validatedData.isSuperAdmin ? 'Super Admin' : 'Admin normal',
        }
        oldValues.isSuperAdmin = (currentUser as any).isSuperAdmin
        newValues.isSuperAdmin = validatedData.isSuperAdmin
        NotificationEvents.emit(targetId, { type: 'session_refresh', reason: 'permissions_changed' })
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
            changes
          },
          oldValues,
          newValues,
          metadata: {
            userAgent: request.headers.get('user-agent') || 'Unknown',
            ip: request.headers.get('x-forwarded-for') || 'Unknown'
          }
        })
      }
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
      // No fallar la actualización por errores de auditoría
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuario actualizado correctamente'
    })
  } catch (error) {
    console.error('Error updating user:', error)

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json({ 
          success: false,
          error: 'Datos inválidos', 
          details: (error as any).errors 
        }, { status: 400 })
      }

      if (error.message.includes('Usuario no encontrado')) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 404 })
      }

      if (error.message.includes('Ya existe un usuario')) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 409 })
      }
    }

    
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        success: false,
        error: 'No autorizado' 
      }, { status: 401 })
    }

    // No permitir que el admin se elimine a sí mismo
    if (session.user.id === (await params).id) {
      return NextResponse.json({ 
        success: false,
        error: 'No puedes eliminar tu propia cuenta' 
      }, { status: 400 })
    }

    // Obtener datos del usuario antes de eliminarlo para las notificaciones
    const userToDelete = await UserService.getUserById((await params).id)
    if (!userToDelete) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuario no encontrado' 
      }, { status: 404 })
    }

    await UserService.deleteUser((await params).id)

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
        deletedBy: session.user.name
      },
      request: request
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
      message: 'Usuario eliminado exitosamente' 
    })
  } catch (error) {
    console.error('Error deleting user:', error)

    if (error instanceof Error) {
      if (error.message.includes('Usuario no encontrado')) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 404 })
      }

      if (error.message.includes('tickets asignados')) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 400 })
      }

      // Exponer el error real para diagnóstico
      return NextResponse.json({ 
        success: false,
        error: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}
