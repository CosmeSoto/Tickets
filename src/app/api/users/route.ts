import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UserService } from '@/lib/services/user-service'
import { z } from 'zod'
import { buildCacheKey } from '@/lib/api-cache'
const createUserSchemaBase = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  password: z.string().max(100, 'La contraseña es demasiado larga'),
  role: z.enum(['ADMIN', 'TECHNICIAN', 'CLIENT']),
  departmentId: z.string().optional(),
  department: z.string().optional(), // Deprecated, usar departmentId
  phone: z.string().optional(),
  isSuperAdmin: z.boolean().optional(),
  ticketsEnabled: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
  patrolsEnabled: z.boolean().optional(),
  newsEnabled: z.boolean().optional(),
  canManageInventory: z.boolean().optional(),
  canRequestAssets: z.boolean().optional(),
  canAccessKnowledge: z.boolean().optional(),
  credentialsEnabled: z.boolean().optional(),
  canManageCredentials: z.boolean().optional(),
  processesEnabled: z.boolean().optional(),
  canManageProcesses: z.boolean().optional(),
  accessEnabled: z.boolean().optional(),
  canManageAccess: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    // SECURITY: solo ADMIN puede listar usuarios sin restricción.
    // CLIENT/TECHNICIAN pueden listar si tienen canManageNews o canManageForms
    // (necesario para el selector de visibilidad en noticias y documentos)
    if (session.user.role === 'CLIENT') {
      const currentUser = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true, canManageForms: true },
      })
      if (!currentUser?.canManageNews && !currentUser?.canManageForms) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
      }
    }

    // TECHNICIAN: igual que CLIENT
    if (session.user.role === 'TECHNICIAN') {
      const currentUser = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true, canManageForms: true },
      })
      if (!currentUser?.canManageNews && !currentUser?.canManageForms) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)

    const role = searchParams.get('role')
    const rolesParam = searchParams.get('roles') // ej: TECHNICIAN,ADMIN
    const purpose = searchParams.get('purpose') // categoryResolvers
    const isActive = searchParams.get('isActive')
    const departmentId = searchParams.get('departmentId')
    const department = searchParams.get('department')
    const familyId = searchParams.get('familyId')
    const patrolFamilyId = searchParams.get('patrolFamilyId')
    const search = searchParams.get('search')
    const limit = searchParams.get('limit')
    const canManageInventory = searchParams.get('canManageInventory')
    const patrolsEnabled = searchParams.get('patrolsEnabled')
    const isSuperAdmin = searchParams.get('isSuperAdmin')
    const formsEnabled = searchParams.get('formsEnabled')
    const newsEnabled = searchParams.get('newsEnabled')

    const isCategoryResolvers = purpose === 'categoryResolvers'
    const rolesList =
      rolesParam
        ?.split(',')
        .map(r => r.trim())
        .filter(Boolean) ?? null

    // Construir filtros para Prisma
    const where: any = {}

    if (isCategoryResolvers || (rolesList && rolesList.length > 0)) {
      // Técnicos + admins que pueden resolver / asignarse a categorías
      where.role = { in: rolesList && rolesList.length > 0 ? rolesList : ['TECHNICIAN', 'ADMIN'] }
    } else if (role) {
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

    if (formsEnabled !== null) {
      where.formsEnabled = formsEnabled === 'true'
    }

    if (newsEnabled !== null) {
      where.newsEnabled = newsEnabled === 'true'
    }

    if (departmentId) {
      where.departmentId = departmentId
    } else if (department) {
      // Compatibilidad con filtro antiguo por nombre
      where.departments = {
        name: department,
      }
    }

    // Filtro por familia del área de la categoría (resolutores)
    if (familyId && isCategoryResolvers) {
      // Elegibles: nativa del área, Super Admin, o cualquier usuario (Admin o
      // Técnico) con grant de tickets concedido a esa familia. Antes esta
      // última rama solo aplicaba a Admins, lo que excluía a los Técnicos con
      // acceso concedido (no nativo) a la familia de la categoría.
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            { departments: { familyId } },
            { isSuperAdmin: true },
            {
              userFamilyAccess: {
                some: { familyId, module: 'tickets', isActive: true },
              },
            },
          ],
        },
      ]
    } else if (familyId) {
      // Filtrar técnicos por familia NATIVA (resolutores del área).
      where.AND = [...(where.AND ?? []), { departments: { familyId } }]
    }

    // Filtrar por familia de rondas: grants patrols O departamento nativo
    if (patrolFamilyId) {
      where.AND = [
        ...(where.AND ?? []),
        {
          OR: [
            {
              userFamilyAccess: {
                some: { familyId: patrolFamilyId, module: 'patrols', isActive: true },
              },
            },
            { departments: { familyId: patrolFamilyId } },
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

    // ADMIN normal: solo ver usuarios de sus familias (nativa + asignadas)
    const requesterIsSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const cacheScopeKey =
      session.user.role === 'ADMIN'
        ? requesterIsSuperAdmin
          ? 'super'
          : `admin:${session.user.id}`
        : session.user.role

    if (session.user.role === 'ADMIN' && !requesterIsSuperAdmin) {
      if (isCategoryResolvers) {
        // Scope por familias (nativa + asignadas), no solo departmentId:
        // permite ver admins/super con assignment o nativa en esas familias.
        const { getTicketConsumerFamilyIds } = await import('@/lib/auth/family-scope')
        const allowedFamilies = await getTicketConsumerFamilyIds(session.user.id, 'ADMIN', false)
        // undefined = sin límite (edge admin sin familias activas); [] = sin acceso
        if (Array.isArray(allowedFamilies) && allowedFamilies.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            meta: { total: 0, filters: { purpose, familyId, roles: rolesList } },
          })
        }
        if (Array.isArray(allowedFamilies)) {
          if (familyId && !allowedFamilies.includes(familyId)) {
            return NextResponse.json({
              success: true,
              data: [],
              meta: { total: 0, filters: { purpose, familyId, roles: rolesList } },
            })
          }
          const effectiveFamilyIds = familyId ? [familyId] : allowedFamilies
          where.AND = [
            ...(where.AND ?? []),
            {
              OR: [
                { departments: { familyId: { in: effectiveFamilyIds } } },
                { isSuperAdmin: true },
                // Acceso concedido (no nativo) a esa familia para tickets:
                // aplica a cualquier rol (Admin o Técnico), no solo Admin.
                {
                  userFamilyAccess: {
                    some: {
                      familyId: { in: effectiveFamilyIds },
                      module: 'tickets',
                      isActive: true,
                    },
                  },
                },
              ],
            },
          ]
        }
      } else {
        const { getAdminUnionDepartmentIds } = await import('@/lib/auth/admin-scope')
        const deptIds = await getAdminUnionDepartmentIds(session.user.id, false)

        if (!deptIds || deptIds.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            meta: {
              total: 0,
              filters: { role, isActive, departmentId, department },
            },
          })
        }

        where.AND = [
          ...(where.AND ?? []),
          { departmentId: { in: deptIds } },
          { isSuperAdmin: false },
        ]
      }
    } else if (session.user.role !== 'ADMIN') {
      const { getUserFamilyScope, getDepartmentIdsForScope } =
        await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, session.user.role, false)
      const deptIds = await getDepartmentIdsForScope(scope)
      if (!deptIds || deptIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: {
            total: 0,
            filters: { role, isActive, departmentId, department },
          },
        })
      }
      where.AND = [...(where.AND ?? []), { departmentId: { in: deptIds } }]
    }

    // Intentar servir desde caché (solo para listas sin búsqueda de texto)
    if (!search) {
      const cacheKey = buildCacheKey('users:list', {
        scope: cacheScopeKey,
        role: role ?? 'all',
        roles: rolesList?.join(',') ?? '',
        purpose: purpose ?? '',
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
    const includeTechAssignments =
      role === 'TECHNICIAN' || isCategoryResolvers || (rolesList?.includes('TECHNICIAN') ?? false)
    const technicianInclude = includeTechAssignments
      ? {
          userFamilyAccess: {
            where: { module: 'tickets', isActive: true },
            select: {
              familyId: true,
              family: { select: { id: true, name: true, code: true, color: true } },
            },
          },
          technician_assignments: {
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
          },
        }
      : {
          userFamilyAccess: false as const,
          technician_assignments: false as const,
        }

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
            family: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
              },
            },
          },
        },
        ...technicianInclude,
        phone: true,
        avatar: true,
        isActive: true,
        canManageInventory: true,
        canRequestAssets: true,
        canApproveDecommission: true,
        canAccessKnowledge: true,
        ticketsEnabled: true,
        inventoryEnabled: true,
        patrolsEnabled: true,
        newsEnabled: true,
        canManageNews: true,
        formsEnabled: true,
        canManageForms: true,
        credentialsEnabled: true,
        canManageCredentials: true,
        processesEnabled: true,
        canManageProcesses: true,
        accessEnabled: true,
        canManageAccess: true,
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
      },
      orderBy: {
        name: 'asc',
      },
      ...(limit ? { take: Math.min(parseInt(limit, 10) || 500, 500) } : {}),
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
        department: user.departments,
        technicianAssignments: user.technician_assignments?.map((assignment: any) => ({
          ...assignment,
          category: assignment.categories,
        })),
        technicianFamilyAssignments: (user as any).userFamilyAccess?.map((a: any) => ({
          familyId: a.familyId,
          family: a.family,
        })),
      }
      delete normalizedUser.departments
      delete normalizedUser.technician_assignments
      delete normalizedUser.userFamilyAccess

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
        scope: cacheScopeKey,
        role: role ?? 'all',
        roles: rolesList?.join(',') ?? '',
        purpose: purpose ?? '',
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

    const { SecurityConfigService } = await import('@/lib/services/security-config-service')
    const securityConfig = await SecurityConfigService.getConfig()
    const createUserSchema = createUserSchemaBase.superRefine((data, ctx) => {
      if (data.password.length < securityConfig.passwordMinLength) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: securityConfig.passwordMinLength,
          type: 'string',
          inclusive: true,
          message: `La contraseña debe tener al menos ${securityConfig.passwordMinLength} caracteres`,
          path: ['password'],
        })
      }
    })

    // Validar datos de entrada
    const validatedData = createUserSchema.parse(body)

    // Solo un Super Admin puede crear otro Super Admin
    if (validatedData.isSuperAdmin && !(session.user as any).isSuperAdmin) {
      validatedData.isSuperAdmin = false
    }

    const requesterIsSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    if (validatedData.role === 'ADMIN' && !requesterIsSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Solo un Super Administrador puede crear usuarios administradores',
        },
        { status: 403 }
      )
    }

    // Verificar si el departamento existe y está en el ámbito del admin
    if (validatedData.departmentId) {
      const department = await prisma.departments.findUnique({
        where: { id: validatedData.departmentId },
        select: { id: true, familyId: true },
      })

      if (!department) {
        return NextResponse.json(
          { success: false, error: 'Departamento no encontrado' },
          { status: 400 }
        )
      }

      if (!requesterIsSuperAdmin && department.familyId) {
        const { assertAdminCanAccessFamily } = await import('@/lib/auth/admin-scope')
        const familyScope = await assertAdminCanAccessFamily(
          session.user.id,
          false,
          department.familyId
        )
        if (!familyScope.allowed) {
          return NextResponse.json(
            { success: false, error: 'No puedes crear usuarios fuera de tu ámbito de familias' },
            { status: 403 }
          )
        }
      }
    } else if (!requesterIsSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Debes asignar un departamento al crear usuarios en tu ámbito' },
        { status: 400 }
      )
    }

    // Crear el usuario usando el servicio
    const user = await UserService.createUser(validatedData, session.user.id)

    // Registrar auditoría de creación
    try {
      const { AuditServiceComplete, AuditActionsComplete } =
        await import('@/lib/services/audit-service-complete')
      await AuditServiceComplete.log({
        action: AuditActionsComplete.USER_CREATED,
        entityType: 'user',
        entityId: (user as any).id,
        userId: session.user.id,
        newValues: {
          name: validatedData.name,
          email: validatedData.email,
          role: validatedData.role,
          departmentId: validatedData.departmentId ?? null,
        },
        request,
      })
    } catch {
      // La auditoría no debe bloquear la creación
    }

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
