import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT']),
  departmentId: z.string().optional(),
  department: z.string().optional(), // Deprecated, usar departmentId
  phone: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parámetros de consulta
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')
    const departmentId = searchParams.get('departmentId')
    const department = searchParams.get('department') // Deprecated, usar departmentId
    const familyId = searchParams.get('familyId') // Filtrar técnicos por familia asignada
    const search = searchParams.get('search') // Búsqueda por nombre o email
    const limit = searchParams.get('limit') // Límite de resultados
    const canManageInventory = searchParams.get('canManageInventory') // Filtrar por permiso de gestión

    // Construir filtros para Prisma
    const where: any = {}

    if (role) {
      where.role = role
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (canManageInventory !== null) {
      where.canManageInventory = canManageInventory === 'true'
    }

    if (departmentId) {
      where.departmentId = departmentId
    } else if (department) {
      // Compatibilidad con filtro antiguo por nombre
      where.departments = {
        name: department
      }
    }

    // Filtrar técnicos por familia: solo los que tienen asignación activa a esa familia
    if (familyId) {
      where.technicianFamilyAssignments = {
        some: { familyId, isActive: true }
      }
    }

    // Búsqueda por nombre o email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Obtener usuarios con conteo de tickets y relación con departamento
    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true,
            familyId: true,
          }
        },
        technicianFamilyAssignments: role === 'TECHNICIAN' ? {
          where: { isActive: true },
          select: {
            familyId: true,
            family: { select: { id: true, name: true, code: true, color: true } }
          }
        } : false,
        phone: true,
        avatar: true,
        isActive: true,
        canManageInventory: true,
        isSuperAdmin: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true
          }
        },
        technician_assignments: role === 'TECHNICIAN' ? {
          select: {
            id: true,
            priority: true,
            maxTickets: true,
            autoAssign: true,
            categories: {
              select: {
                id: true,
                name: true,
                color: true,
                level: true
              }
            }
          },
          where: {
            isActive: true
          }
        } : false
      },
      orderBy: {
        name: 'asc'
      },
      // Aplicar límite si se especifica
      take: limit ? parseInt(limit) : undefined
    })

    // Agregar levelName a las categorías de técnicos
    const usersWithLevelNames = users.map(user => {
      if (user.technician_assignments) {
        return {
          ...user,
          technician_assignments: user.technician_assignments.map((assignment: any) => ({
            ...assignment,
            categories: {
              ...assignment.categories,
              levelName: assignment.categories.level === 1 ? 'Principal' : 
                        assignment.categories.level === 2 ? 'Subcategoría' :
                        assignment.categories.level === 3 ? 'Especialidad' : 'Detalle'
            }
          }))
        }
      }
      return user
    })

    // Calcular si se puede eliminar (solo para técnicos) y normalizar department
    const usersWithCanDelete = usersWithLevelNames.map(user => {
      // Normalizar departments -> department y technician_assignments -> technicianAssignments
      const normalizedUser: any = {
        ...user,
        department: user.departments, // Cambiar departments a department
        technicianAssignments: user.technician_assignments?.map((assignment: any) => ({
          ...assignment,
          category: assignment.categories // Cambiar categories a category (singular)
        }))
      }
      delete normalizedUser.departments // Eliminar departments
      delete normalizedUser.technician_assignments // Eliminar snake_case
      
      if (user.role === 'TECHNICIAN') {
        const canDelete = 
          (user._count.tickets_tickets_assigneeIdTousers === 0) && 
          (user._count.technician_assignments === 0)
        return { ...normalizedUser, canDelete }
      }
      return normalizedUser
    })

    return NextResponse.json({
      success: true,
      data: usersWithCanDelete,
      meta: {
        total: users.length,
        filters: {
          role,
          isActive,
          departmentId,
          department
        }
      }
    })
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar los usuarios',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validar datos de entrada
    const validatedData = createUserSchema.parse(body)

    // Verificar si el departamento existe (si se proporciona departmentId)
    if (validatedData.departmentId) {
      const department = await prisma.departments.findUnique({
        where: { id: validatedData.departmentId }
      })
      
      if (!department) {
        return NextResponse.json(
          { success: false, error: 'Departamento no encontrado' },
          { status: 400 }
        )
      }
    }

    // Crear el usuario usando el servicio
    const user = await UserService.createUser(validatedData, session.user.id)

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuario creado exitosamente'
    })
  } catch (error) {
    console.error('Error creating user:', error)

    if (error instanceof Error) {
      if (error.name === 'ZodError') {
        return NextResponse.json({ 
          success: false,
          error: 'Datos inválidos', 
          details: (error as any).errors 
        }, { status: 400 })
      }

      if (error.message.includes('Ya existe un usuario')) {
        return NextResponse.json({ 
          success: false,
          error: error.message 
        }, { status: 409 })
      }
    }

    
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}