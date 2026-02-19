import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const updateUserSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT']).optional(),
  departmentId: z.string().nullable().optional(),
  department: z.string().optional(), // Deprecated, usar departmentId
  phone: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
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
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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

    // Validación de seguridad: el usuario no puede desactivar su propia cuenta
    if (session.user.id === (await params).id && validatedData.isActive === false) {
      return NextResponse.json({ 
        success: false,
        error: 'No puedes desactivar tu propia cuenta' 
      }, { status: 400 })
    }

    console.log('📤 [API-USERS] Actualizando usuario:', (await params).id)
    console.log('📤 [API-USERS] Datos validados:', validatedData)

    // Actualizar el usuario
    const user = await UserService.updateUser((await params).id, validatedData)

    // Enviar notificaciones de usuario actualizado
    try {
      // Detectar cambios importantes
      const changes: Record<string, any> = {}
      if (validatedData.name && validatedData.name !== currentUser.name) changes.name = validatedData.name
      if (validatedData.email && validatedData.email !== currentUser.email) changes.email = validatedData.email
      if (validatedData.role && validatedData.role !== currentUser.role) changes.role = validatedData.role
      if (validatedData.departmentId !== undefined) changes.departmentId = validatedData.departmentId
      if (validatedData.phone !== undefined && validatedData.phone !== currentUser.phone) changes.phone = validatedData.phone
      if (validatedData.isActive !== undefined && validatedData.isActive !== currentUser.isActive) changes.isActive = validatedData.isActive

      // Solo enviar notificaciones si hay cambios significativos (log para auditoría)
      if (Object.keys(changes).length > 0) {
        console.log(`[INFO] User updated: ${(await params).id} by user ${session.user.id}`)
        
        // Log especial para cambio de rol
        if (changes.role && changes.role !== currentUser.role) {
          console.log(`[INFO] Role changed for user ${(await params).id}: ${currentUser.role} -> ${changes.role} by ${session.user.id}`)
        }

        // Log específico para técnicos
        if (currentUser.role === 'TECHNICIAN' || validatedData.role === 'TECHNICIAN') {
          console.log(`[INFO] Technician updated: ${(await params).id} by user ${session.user.id}`)
        }
      }
    } catch (notificationError) {
      console.error('Error enviando notificaciones de usuario actualizado:', notificationError)
      // No fallar la actualización por errores de notificación
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
    }

    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}
