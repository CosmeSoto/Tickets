import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { buildCacheKey } from '@/lib/api-cache'
const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT']),
  departmentId: z.string().optional(),
  department: z.string().optional(), // Deprecated, usar departmentId
  phone: z.string().optional(),
  isSuperAdmin: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    // SECURITY: clientes no pueden listar usuarios
    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')
    const departmentId = searchParams.get('departmentId')
    const department = searchParams.get('department')
    const familyId = searchParams.get('familyId')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const canManageInventory = searchParams.get('canManageInventory')
    const patrolsEnabled = searchParams.get('patrolsEnabled')
    const isSuperAdmin = searchParams.get('isSuperAdmin')

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

    if (patrolsEnabled !== null) {
      where.patrolsEnabled = patrolsEnabled === 'true'
    }

    if (isSuperAdmin !== null) {
      where.isSuperAdmin = isSuperAdmin === 'true'
    }

    if (departmentId) {
      where.departmentId = departmentId
    } else if (department) {
      // Compatibilidad con filtro antiguo por nombre
      where.departments = {
        name: department,
      }
    }

    // Filtrar técnicos por familia: los que tienen asignación activa O cuyo departamento pertenece a esa familia
    if (familyId) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            // Asignación explícita en technician_family_assignments
            { technicianFamilyAssignments: { some: { familyId, isActive: true } } },
            // Técnico cuyo departamento pertenece a la familia (asignación nativa)
            { departments: { familyId } },
          ],
        },
      ]
    }

    // Búsqueda por nombre o email
    if (search) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
    }

    // Intentar servir desde caché (solo para listas sin búsqueda de texto)
    if (!search) {
      const cacheKey = buildCacheKey('users:list', {
        role: role ?? 'all',
        isActive: isActive ?? 'all',
        departmentId: departmentId ?? '',
        familyId: familyId ?? '',
        canManageInventory: canManageInventory ?? '',
        patrolsEnabled: patrolsEnabled ?? '',
        isSuperAdmin: isSuperAdmin ?? '',
        limit: limit ?? '500',
      })
      try {
        const { getCached } = await import('@/lib/redis')
        const cached = await getCached<any>(cacheKey)
        if (cached) return NextResponse.json(cached)
      } catch {
        // Redis no disponible — continuar sin caché
      }
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
          },
        },
        technicianFamilyAssignments:
          role === 'TECHNICIAN'
            ? {
                where: { isActive: true },
                select: {
                  familyId: true,
                  family: { select: { id: true, name: true, code: true, color: true } },
                },
              }
            : false,
        phone: true,
        avatar: true,
        isActive: true,
        canManageInventory: true,
        ticketsEnabled: true,
        inventoryEnabled: true,
        patrolsEnabled: true,
        isSuperAdmin: true,
        createdAt: true,
        lastLogin: true,
        _count: {
          select: {
            tickets_tickets_createdByIdTousers: true,
            tickets_tickets_assigneeIdTousers: true,
            technician_assignments: true,
          },
        },
        technician_assignments:
          role === 'TECHNICIAN'
            ? {
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
                      level: true,
                    },
                  },
                },
                where: {
                  isActive: true,
                },
              }
            : false,
      },
      orderBy: {
        name: 'asc',
      },
      // Aplicar límite si se especifica
      take: limit ? Math.min(parseInt(limit), 500) : undefined,
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
              levelName:
                assignment.categories.level === 1
                  ? 'Principal'
                  : assignment.categories.level === 2
                    ? 'Subcategoría'
                    : assignment.categories.level === 3
                      ? 'Especialidad'
                      : 'Detalle',
            },
          })),
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
          category: assignment.categories, // Cambiar categories a category (singular)
        })),
      }
      delete normalizedUser.departments // Eliminar departments
      delete normalizedUser.technician_assignments // Eliminar snake_case

      if (user.role === 'TECHNICIAN') {
        const canDelete =
          user._count.tickets_tickets_assigneeIdTousers === 0 &&
          user._count.technician_assignments === 0
        return { ...normalizedUser, canDelete }
      }
      return normalizedUser
    })

    const responseData = {
      success: true,
      data: usersWithCanDelete,
      meta: {
        total: users.length,
        filters: { role, isActive, departmentId, department },
      },
    }

    // Cache 30s para listas sin búsqueda de texto (se invalida en POST/PUT/DELETE)
    if (!search) {
      const cacheKey = buildCacheKey('users:list', {
        role: role ?? 'all',
        isActive: isActive ?? 'all',
        departmentId: departmentId ?? '',
        familyId: familyId ?? '',
        canManageInventory: canManageInventory ?? '',
        patrolsEnabled: patrolsEnabled ?? '',
        isSuperAdmin: isSuperAdmin ?? '',
        limit: limit ?? '500',
      })
      try {
        const { setCache } = await import('@/lib/redis')
        await setCache(cacheKey, responseData, 30)
      } catch {
        // Redis no disponible — continuar sin caché
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar los usuarios',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Validar datos de entrada
    const validatedData = createUserSchema.parse(body)

    // Solo un Super Admin puede crear otro Super Admin
    if (validatedData.isSuperAdmin && !(session.user as any).isSuperAdmin) {
      validatedData.isSuperAdmin = false
    }

    // Verificar si el departamento existe (si se proporciona departmentId)
    if (validatedData.departmentId) {
      const department = await prisma.departments.findUnique({
        where: { id: validatedData.departmentId },
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

    // Invalidar cache de lista de usuarios
    void import('@/lib/api-cache').then(({ invalidateCache }) => invalidateCache('users:list:*'))

    return NextResponse.json({
      success: true,
      data: user,
      message: 'Usuario creado exitosamente',
    })
  } catch (error) {
    console.error('Error creating user:', error)

    // Error de validación Zod — devolver el primer mensaje en español
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0]
      const fieldLabels: Record<string, string> = {
        email: 'Email',
        name: 'Nombre',
        password: 'Contraseña',
        role: 'Rol',
        departmentId: 'Departamento',
        phone: 'Teléfono',
      }
      const field = firstIssue.path[0] ? String(firstIssue.path[0]) : ''
      const fieldLabel = fieldLabels[field] || field
      const message = fieldLabel ? `${fieldLabel}: ${firstIssue.message}` : firstIssue.message

      return NextResponse.json(
        {
          success: false,
          error: message,
          details: error.issues.map(i => ({
            path: i.path,
            message: i.message,
          })),
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
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
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
